/**
 * Bidding Engine — 7-step pipeline per team per player.
 * Orchestrates opponent AI decisions using static persona values (Phase 1).
 * LLM inputs slot into steps 4–6 in Phase 2 without changing the interface.
 *
 * Step 1: Static franchise intent check (role/nationality/preferences)
 * Step 2: Rule Engine hard validation (squad slot, purse, overseas cap)
 * Step 3: Safe bid limit (reserved purse protection)
 * Step 4: Squad need score (how badly does this team need this player?)
 * Step 5: Emotion score (loyalty, triggers, situational urgency)
 * Step 6: Max bid calculation (blended score × purse capacity)
 * Step 7: Bid or pass decision
 */

import type { GameState, BidState } from '@/types/game'
import type { AuctionDataset } from '@/types/dataset'
import type { TeamId, TeamState, FranchisePersona } from '@/types/team'
import type { PlayerRecord } from '@/types/player'
import { validateBid, getSafeBidLimit } from '@/engine/ruleEngine'
import { getBidIncrement, getPlayersInSet } from '@/dataset/datasetLoader'
import { getPersona } from '@/personas/index'

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface BidDecision {
  teamId: TeamId
  action: 'bid' | 'pass'
  bidAmount?: number      // set when action === 'bid'
  interestScore: number   // 0–100, used for logging/UI
  reasoning: string       // short internal note — not shown to user in Phase 1
}

// Injected LLM result (Phase 2). Phase 1 passes null and pipeline uses static fallback.
export interface LLMPersonaResult {
  interestLevel: number       // 0–100
  personalCeiling: number     // franchise's true max — LLM is authoritative when present
  jumpBid: number | null      // optional jump bid above minimum increment
  emotionalTriggers: string[]
  ownerComment: string        // shown in auction room UI
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs the full 7-step bidding pipeline for one opponent team.
 * Returns a BidDecision. The caller applies it to game state only after
 * Rule Engine has been consulted (validateBid is called inside).
 */
export function runBiddingPipeline(
  state: GameState,
  dataset: AuctionDataset,
  teamId: TeamId,
  currentPlayer: PlayerRecord,
  llmResult: LLMPersonaResult | null = null,
): BidDecision {
  const persona = getPersona(teamId)
  const teamState = state.teamStates[teamId]
  const bidState = state.currentBidState!

  // ── Step 1: Static franchise intent ───────────────────────────────────────
  // Threshold 40: keeps only genuinely interested teams in each auction.
  // In real IPL most players attract 2–4 bidders, not all 9 opponents.
  const staticInterest = computeStaticInterest(persona, teamState, currentPlayer, dataset)
  if (staticInterest < 40) {
    return pass(teamId, staticInterest, 'Insufficient franchise interest')
  }

  // ── Step 2: Rule Engine hard gate ─────────────────────────────────────────
  const nextBid = getNextBidAmount(dataset, bidState, currentPlayer.basePrice)
  const ruleCheck = validateBid(state, dataset, teamId, nextBid)
  if (!ruleCheck.valid) {
    return pass(teamId, 0, `Rule Engine blocked: ${ruleCheck.reason}`)
  }

  // ── Step 3: Safe bid limit ────────────────────────────────────────────────
  const currentSetName = dataset.auctionSets[state.currentSetIndex] ?? ''
  const safeBidLimit = getSafeBidLimit(teamState, dataset, currentSetName, state.currentSetIndex)
  if (safeBidLimit <= 0 || nextBid > safeBidLimit) {
    return pass(teamId, staticInterest, 'Insufficient safe purse to bid')
  }

  // ── Step 4: Squad need score ──────────────────────────────────────────────
  const needScore = computeNeedScore(persona, teamState, currentPlayer, dataset)

  // ── Step 5: Emotion score ─────────────────────────────────────────────────
  const emotionScore = computeEmotionScore(persona, teamState, currentPlayer, llmResult)

  // ── Step 6: Max bid calculation ───────────────────────────────────────────
  const blendedScore = blendScores(staticInterest, needScore, emotionScore, llmResult)

  // Emotional star bonus: former franchise players and capped stars drive 30% higher ceilings
  // This models the real IPL phenomenon where teams go crazy for their own players
  const isEmotionalTarget = currentPlayer.previousTeam === persona.teamId ||
                            currentPlayer.rtmEligibleFor === persona.teamId
  const isCapStar = currentPlayer.cappedStatus === 'capped' &&
                    (currentPlayer.marketValue ?? 0) >= 14
  const emotionalMultiplier = isEmotionalTarget ? 1.30 : isCapStar ? 1.10 : 1.0

  const maxBid = computeMaxBid(blendedScore, currentPlayer.basePrice, safeBidLimit, persona, llmResult, currentPlayer.marketValue, currentPlayer) * emotionalMultiplier

  // ── Step 7: Bid or pass ───────────────────────────────────────────────────
  if (nextBid > maxBid) {
    return pass(teamId, blendedScore, `Next bid ₹${nextBid.toFixed(2)} exceeds max ₹${maxBid.toFixed(2)}`)
  }

  // Jump bid: LLM signals dominance by bidding above minimum increment
  let finalBid = nextBid
  if (llmResult?.jumpBid != null && llmResult.jumpBid > nextBid && llmResult.jumpBid <= maxBid) {
    finalBid = llmResult.jumpBid
    console.log(`[LLM] JUMP BID: ${teamId} ₹${finalBid.toFixed(1)}Cr (min was ₹${nextBid.toFixed(1)}Cr)`)
  }

  return {
    teamId,
    action: 'bid',
    bidAmount: finalBid,
    interestScore: blendedScore,
    reasoning: `Interest ${blendedScore.toFixed(0)}/100 — bidding ₹${finalBid.toFixed(2)} (max ₹${maxBid.toFixed(2)})`,
  }
}

/**
 * Runs the pipeline for all opponent teams (not user's franchise, not teams that passed).
 * Returns decisions in a randomised order to add auction realism.
 */
export function runAllOpponentDecisions(
  state: GameState,
  dataset: AuctionDataset,
  userTeamId: TeamId,
  currentPlayer: PlayerRecord,
  llmResults: Map<TeamId, LLMPersonaResult> = new Map(),
): BidDecision[] {
  const bidState = state.currentBidState!
  const eligibleTeams = (Object.keys(state.teamStates) as TeamId[]).filter(
    id =>
      id !== userTeamId &&
      !bidState.teamsPassed.includes(id) &&
      bidState.currentLeader !== id,
  )

  // Shuffle for realistic bid ordering
  const shuffled = [...eligibleTeams].sort(() => Math.random() - 0.5)

  return shuffled.map(teamId =>
    runBiddingPipeline(state, dataset, teamId, currentPlayer, llmResults.get(teamId) ?? null),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Step 1 — Static interest based on persona config and player profile.
 * Returns 0–100. Below 40 = immediate pass — this threshold is the primary
 * mechanism that keeps most teams out of most auctions, producing realistic
 * unsold rates and bid counts (2–4 active teams per player, not 9).
 */
function computeStaticInterest(
  persona: FranchisePersona,
  teamState: TeamState,
  player: PlayerRecord,
  dataset: AuctionDataset,
): number {
  // Hard guards — no interest possible
  if (player.isOverseas && teamState.overseasCount >= dataset.overseasLimit) return 0
  if (teamState.squad.length >= dataset.maximumSquadSize) return 0

  const squad = teamState.squad
  const roleCounts = { BAT: 0, BWL: 0, AR: 0, WK: 0 }
  for (const p of squad) { if (p.role in roleCounts) roleCounts[p.role as keyof typeof roleCounts]++ }
  const thisRoleCount = roleCounts[player.role] ?? 0

  // ── Role saturation: biggest single filter ────────────────────────────────
  // If a team already has enough of this role, they step aside. In real IPL
  // franchises routinely skip entire sets because they're already covered.
  const saturationMultiplier =
    player.role === 'WK'
      ? (thisRoleCount === 0 ? 1.0 : thisRoleCount === 1 ? 0.50 : 0.08)
      : thisRoleCount <= 2 ? 1.0
      : thisRoleCount <= 4 ? 0.70
      : thisRoleCount <= 6 ? 0.35
      :                      0.12

  // ── Overseas slot conservation ────────────────────────────────────────────
  // Teams plan their overseas slots across the auction — they don't fill up
  // on the first set and leave themselves short for elite overseas players later.
  let overseasMult = 1.0
  if (player.isOverseas) {
    const slotsLeft = dataset.overseasLimit - teamState.overseasCount
    // Elite overseas (₹6 Cr+ market value) are worth using a precious slot on —
    // teams don't conserve slots past the point where a Josh Inglis is on the block.
    const isEliteOverseas = (player.marketValue ?? 0) >= 6 || player.basePrice >= 2
    overseasMult = slotsLeft >= 4 ? 1.0
                 : slotsLeft === 3 ? 0.80
                 : slotsLeft === 2 ? (isEliteOverseas ? 0.62 : 0.45)
                 : slotsLeft === 1 ? (isEliteOverseas ? 0.48 : 0.25)
                 :                   0.0   // full — already caught by guard above
  }

  // ── Tier baseline — tighter range so threshold is meaningful ─────────────
  // Low base (₹0.2–0.5) → 30, ₹2 Cr → 42, ₹10 Cr+ → 55
  const tierBonus = Math.min(25, Math.log10(Math.max(player.basePrice, 0.2) + 1) * 30)
  let score = 30 + tierBonus

  // Capped international adds genuine multi-team competition — but not guaranteed
  if (player.cappedStatus === 'capped') score += 10
  if (player.basePrice >= 10) score += 8   // elite marquee
  else if (player.basePrice >= 4) score += 4

  // Role weight by persona
  const roleWeight = persona.roleWeights[player.role] ?? 0.75
  score *= roleWeight

  // Capped/uncapped preference — small bonus only
  if (player.cappedStatus === 'capped' && persona.prefersCapped) score += 5
  if (player.cappedStatus === 'uncapped' && !persona.prefersCapped) score += 3

  // Nationality fit
  if (!player.isOverseas && persona.prefersIndian) score += 4
  if (player.isOverseas && !persona.prefersIndian) score += 4
  if (player.isOverseas && persona.overseasCaution > 0) score -= persona.overseasCaution * 10

  // Former player loyalty — meaningful pull but capped
  if (player.previousTeam === persona.teamId) score += persona.loyaltyBonus * 40

  // Per-player non-determinism: each franchise has a random affinity [-8, +12]
  // seeded on (teamId + playerId) so it's stable across the same player
  const affinityHash = (persona.teamId + player.playerId).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
  const affinity = ((Math.abs(affinityHash) % 20) - 8)   // -8 to +11
  score += affinity

  // Apply role saturation and overseas conservation
  score *= saturationMultiplier * overseasMult

  // ── Star / recency appeal (applied AFTER saturation) ─────────────────────
  // Elite proven players always attract more bidders regardless of role coverage.
  // A team with a WK won't completely ignore Ishan Kishan or Josh Inglis — they
  // watch the bidding and may engage if the price is right. This models "auction
  // spotlight" for big-name players.
  const mv = player.marketValue ?? 0
  if (player.cappedStatus === 'capped') {
    const starAppeal = mv >= 15 ? 20     // elite marquee (Pant, Gill tier)
                     : mv >= 8  ? 14     // top international (Ishan, Inglis tier)
                     : mv >= 5  ? 9      // quality capped (reliable internationals)
                     : mv >= 2  ? 5      // solid capped (proven but not headline)
                     : player.basePrice >= 2 ? 4   // high base = expected quality
                     : 0
    score += starAppeal
  } else if (player.cappedStatus === 'uncapped' && mv >= 3) {
    // Breakout uncapped players (Suryavanshi etc.) get some buzz too
    score += mv >= 8 ? 10 : mv >= 5 ? 6 : 3
  }

  // ── Uncapped player potential ──────────────────────────────────────────────
  if (player.cappedStatus === 'uncapped' && player.potential != null && player.age != null) {
    const potential = player.potential
    const age = player.age
    const pw = persona.potentialWeight
    const youthCutoff = persona.youthThreshold

    const ageMult = age <= youthCutoff     ? 1.5
                  : age <= youthCutoff + 2 ? 1.2
                  : age <= youthCutoff + 4 ? 1.0
                  : age <= youthCutoff + 6 ? 0.80
                  :                          0.60

    const potentialBonus = (potential - 1) / 9 * 40 * pw * ageMult
    const tierSpark = player.prospectTier === 'elite'     ? 12 * pw
                    : player.prospectTier === 'promising' ? 6 * pw
                    :                                        0
    score += potentialBonus + tierSpark
  }

  return Math.min(100, Math.max(0, score))
}

/**
 * Step 4 — How much does this team actually need this player?
 * Analyses current squad composition gaps.
 */
function computeNeedScore(
  _persona: FranchisePersona,
  teamState: TeamState,
  player: PlayerRecord,
  dataset: AuctionDataset,
): number {
  const squad = teamState.squad
  const totalSlots = dataset.maximumSquadSize

  // Count roles in squad
  const roleCounts = { BAT: 0, BWL: 0, AR: 0, WK: 0 }
  for (const p of squad) {
    if (p.role in roleCounts) roleCounts[p.role as keyof typeof roleCounts]++
  }

  // Basic need heuristics — sharper drop-off to reflect real franchise selectivity
  const roleCount = roleCounts[player.role]
  let needScore = 50

  if (player.role === 'WK') {
    needScore = roleCount === 0 ? 90 : roleCount === 1 ? 55 : 10
  } else {
    needScore = roleCount <= 1 ? 80
              : roleCount <= 3 ? 60
              : roleCount <= 5 ? 35
              : roleCount <= 7 ? 15
              :                   5
  }

  // Urgency rises as squad fills (fewer slots = must pick now)
  const fillRatio = squad.length / totalSlots
  needScore *= (1 + fillRatio * 0.25)

  // Overseas scarcity bonus when only 1 slot left — they really need to use it
  if (player.isOverseas) {
    const overseasLeft = dataset.overseasLimit - teamState.overseasCount
    if (overseasLeft === 1) needScore *= 1.15
  }

  // Tight purse = more selective about every bid
  if (teamState.currentPurse < 15) needScore *= 0.85
  if (teamState.currentPurse < 8)  needScore *= 0.70

  return Math.min(100, Math.max(0, needScore))
}

/**
 * Step 5 — Emotional score based on persona triggers and situational factors.
 */
function computeEmotionScore(
  persona: FranchisePersona,
  _teamState: TeamState,
  player: PlayerRecord,
  _llmResult: LLMPersonaResult | null,
): number {
  let score = 40 // neutral baseline

  // Former player loyalty triggers strong emotion
  if (player.previousTeam === persona.teamId) score += 25
  if (player.rtmEligibleFor === persona.teamId) score += 20

  // LLM-provided emotional triggers (Phase 2) — not used in new architecture
  // (personalCeiling already incorporates emotional factors)

  // Auction style modifiers
  if (persona.auctionStyle === 'aggressive') score *= 1.15
  if (persona.auctionStyle === 'emotional') score *= 1.25
  if (persona.auctionStyle === 'analytical') score *= 0.85
  if (persona.auctionStyle === 'moneyball') score *= 0.80
  if (persona.auctionStyle === 'calculated') score *= 0.90

  return Math.min(100, Math.max(0, score))
}

/**
 * Step 6 helper — Blend static, need, and emotion scores into a single interest score.
 */
function blendScores(
  staticInterest: number,
  needScore: number,
  emotionScore: number,
  llmResult: LLMPersonaResult | null,
): number {
  if (llmResult) {
    // Phase 2: LLM interest takes significant weight
    return (
      staticInterest * 0.20 +
      llmResult.interestLevel * 0.45 +
      needScore * 0.20 +
      emotionScore * 0.15
    )
  }
  // Phase 1: static blend
  return staticInterest * 0.40 + needScore * 0.35 + emotionScore * 0.25
}

/**
 * Step 6 — Calculate the maximum this team will bid.
 *
 * When LLM result is present: personalCeiling IS the max — LLM is authoritative.
 * When no LLM (fallback path): formula-based estimate using base price + blended score.
 */
function computeMaxBid(
  blendedScore: number,
  basePrice: number,
  safeBidLimit: number,
  persona: FranchisePersona,
  llmResult: LLMPersonaResult | null,
  marketValue?: number | null,
  currentPlayer?: PlayerRecord | null,
): number {
  // Absolute hard ceiling — only Rishabh Pant (₹27 Cr) has ever come close
  const ABSOLUTE_CAP = 28

  if (llmResult && llmResult.personalCeiling > 0) {
    const variance = 0.95 + Math.random() * 0.10
    const ceiling = llmResult.personalCeiling * variance
    return Math.min(ceiling, safeBidLimit, ABSOLUTE_CAP)
  }

  // marketValue = actual 2025 auction result — primary anchor for formula path
  // desireFraction scales how much of market value a team is willing to pay,
  // persona multiplier adds the 'overpay' character (RCB/MI pay more than RR/DC)
  // Only use marketValue as anchor when it's meaningfully above base price.
  // If marketValue ≈ basePrice the player went unsold or at base price — using it
  // as the multiplier anchor produces a max bid BELOW base price (desireFraction × tiny number),
  // which silently blocks all AI bids in the second half of the auction.
  if (marketValue && marketValue > basePrice * 1.2) {
    const desireFraction = blendedScore / 100
    let maxBid = marketValue * desireFraction * persona.maxBidMultiplier
    maxBid *= 0.90 + Math.random() * 0.20
    // Star floor: proven high-value players shouldn't sell for pennies even when
    // bidders are few. A team drawn in by star appeal should at least bid
    // proportionally to the player's established market value.
    if (currentPlayer?.cappedStatus === 'capped' && marketValue >= 5) {
      const starFloor = marketValue * 0.30 * (0.7 + persona.maxBidMultiplier * 0.2)
      maxBid = Math.max(maxBid, Math.min(starFloor, safeBidLimit))
    }
    return Math.min(maxBid, safeBidLimit, ABSOLUTE_CAP)
  }

  // Pure formula fallback (no real price known)
  let realisticCap = basePrice < 1  ? Math.min(basePrice * 6,  4)
                   : basePrice < 2  ? Math.min(basePrice * 5,  8)
                   : basePrice < 5  ? Math.min(basePrice * 4, 14)
                   : basePrice < 10 ? Math.min(basePrice * 2.5, 18)
                   :                  Math.min(basePrice * 1.8, 24)

  // Uncapped players with high potential can trigger bidding wars above formula
  if (currentPlayer?.cappedStatus === 'uncapped' && currentPlayer.potential != null) {
    const potential = currentPlayer.potential
    const potentialCap = potential >= 8 ? 6
                       : potential >= 6 ? 3
                       : potential >= 4 ? 1.5
                       :                  realisticCap
    realisticCap = Math.max(realisticCap, potentialCap * persona.potentialWeight)
  }

  const desireFraction = blendedScore / 100
  const effectiveMultiplier = Math.min(persona.maxBidMultiplier, 1.4)
  let maxBid = realisticCap * desireFraction * effectiveMultiplier
  maxBid *= 0.85 + Math.random() * 0.25
  // No floor — genuinely disinterested teams drop out, player may go unsold
  return Math.min(maxBid, safeBidLimit, ABSOLUTE_CAP)
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function getNextBidAmount(dataset: AuctionDataset, bidState: BidState, basePrice: number): number {
  if (bidState.currentBid === 0) return basePrice
  return bidState.currentBid + getBidIncrement(dataset, bidState.currentBid)
}

function pass(teamId: TeamId, interestScore: number, reasoning: string): BidDecision {
  return { teamId, action: 'pass', interestScore, reasoning }
}

/**
 * Returns the current player up for auction, or null if the auction indices are invalid.
 * Merges released retained players into the appropriate set alongside regular players.
 */
export function getCurrentAuctionPlayer(
  state: GameState,
  dataset: AuctionDataset,
): PlayerRecord | null {
  // Re-auction phase: serve players from reauctionPool
  if (state.isReauction) {
    return state.reauctionPool?.[state.reauctionIndex] ?? null
  }

  const setName = dataset.auctionSets[state.currentSetIndex]
  if (!setName) return null

  const shuffledIds = state.setPlayerOrder?.[setName]
  if (shuffledIds) {
    const playerId = shuffledIds[state.currentPlayerIndex]
    if (!playerId) return null
    const allInSet = getPlayersInSet(dataset, setName, state.releasedRetainedPlayers ?? [])
    return allInSet.find(p => p.playerId === playerId) ?? null
  }

  // Fallback: unshuffled (first set before shuffle is generated)
  const players = getPlayersInSet(dataset, setName, state.releasedRetainedPlayers ?? [])
  return players[state.currentPlayerIndex] ?? null
}
