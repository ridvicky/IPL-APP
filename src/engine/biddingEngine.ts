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
  const staticInterest = computeStaticInterest(persona, teamState, currentPlayer, dataset)
  if (staticInterest < 10) {
    return pass(teamId, staticInterest, 'No franchise interest in this player profile')
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
 * Returns 0–100. Below 10 = immediate pass (no LLM call wasted in Phase 2).
 */
function computeStaticInterest(
  persona: FranchisePersona,
  teamState: TeamState,
  player: PlayerRecord,
  dataset: AuctionDataset,
): number {
  // Overseas check — skip if no slot
  if (player.isOverseas && teamState.overseasCount >= dataset.overseasLimit) return 0

  // Squad full — no interest at all
  if (teamState.squad.length >= dataset.maximumSquadSize) return 0

  // Tier baseline — ₹0.3Cr → 50, ₹2Cr → 68, ₹10Cr+ → 82
  const tierBonus = Math.min(32, Math.log10(Math.max(player.basePrice, 0.3) + 1) * 35)
  let score = 50 + tierBonus

  // Capped star players drive intense multi-team bidding wars
  if (player.cappedStatus === 'capped') score += 15

  // Players with high base price are known stars — every team wants them
  if (player.basePrice >= 10) score += 12   // elite bracket (retained/star price)
  else if (player.basePrice >= 4) score += 6  // solid international

  // Role weight
  const roleWeight = persona.roleWeights[player.role] ?? 0.75
  score *= roleWeight

  // Capped/uncapped preference
  if (player.cappedStatus === 'capped' && persona.prefersCapped) score += 6
  if (player.cappedStatus === 'uncapped' && !persona.prefersCapped) score += 4

  // Nationality preference
  if (!player.isOverseas && persona.prefersIndian) score += 5
  if (player.isOverseas && !persona.prefersIndian) score += 5
  if (player.isOverseas && persona.overseasCaution > 0) score -= persona.overseasCaution * 8

  // Former player loyalty — strong emotional pull, drives bidding wars
  if (player.previousTeam === persona.teamId) score += persona.loyaltyBonus * 50

  // ── Uncapped player potential ──────────────────────────────────────────────
  // Potential replaces the tier bonus for uncapped players — a high-rated 19-year-old
  // matters far more than their ₹0.20 Cr base price suggests.
  if (player.cappedStatus === 'uncapped' && player.potential != null && player.age != null) {
    const potential = player.potential                     // 1–10
    const age = player.age
    const pw = persona.potentialWeight                     // 0–1 per franchise
    const youthCutoff = persona.youthThreshold             // e.g. 22

    // Age multiplier: peaks below youthCutoff, fades steadily after
    const ageMult = age <= youthCutoff        ? 1.5
                  : age <= youthCutoff + 2    ? 1.2
                  : age <= youthCutoff + 4    ? 1.0
                  : age <= youthCutoff + 6    ? 0.80
                  :                             0.60

    // potentialBonus = 0 for potential:1 up to +40 for potential:10 × franchise weight × age curve
    const potentialBonus = (potential - 1) / 9 * 40 * pw * ageMult

    // Prospect tier gives an additional bidding-war spark for elite names
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

  // Basic need heuristics
  const roleCount = roleCounts[player.role]
  let needScore = 50

  // More need if short on this role
  if (player.role === 'WK' && roleCount === 0) needScore = 90
  else if (player.role === 'WK' && roleCount === 1) needScore = 60
  else if (player.role === 'WK' && roleCount >= 2) needScore = 20

  if (player.role !== 'WK') {
    if (roleCount <= 2) needScore = 75
    else if (roleCount <= 4) needScore = 55
    else if (roleCount <= 6) needScore = 35
    else needScore = 20
  }

  // Urgency rises as auction progresses and slots fill up
  const fillRatio = squad.length / totalSlots
  needScore *= (1 + fillRatio * 0.3)

  // Overseas slot urgency
  if (player.isOverseas) {
    const overseasLeft = dataset.overseasLimit - teamState.overseasCount
    if (overseasLeft <= 1) needScore *= 1.2
  }

  // Purse efficiency — if purse is very tight, be more selective
  if (teamState.currentPurse < 10) needScore *= 0.85

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
    // Floor at base price so a team with positive interest always bids at least the base
    return Math.max(basePrice, Math.min(maxBid, safeBidLimit, ABSOLUTE_CAP))
  }

  // Pure formula fallback (no real price known) — tighter caps, multiplier capped at 1.5
  // desireFraction × realisticCap × bounded multiplier produces realistic ranges
  let realisticCap = basePrice < 1  ? Math.min(basePrice * 8,  6)
                   : basePrice < 2  ? Math.min(basePrice * 6, 10)
                   : basePrice < 5  ? Math.min(basePrice * 5, 16)
                   : basePrice < 10 ? Math.min(basePrice * 3, 22)
                   :                  Math.min(basePrice * 2, 26)

  // Uncapped players with high potential get a lifted ceiling — elite prospects can trigger
  // bidding wars well above the base-price formula (Suryavanshi-type scenarios).
  if (currentPlayer?.cappedStatus === 'uncapped' && currentPlayer.potential != null) {
    const potential = currentPlayer.potential  // 1–10
    // elite (8–10): up to ₹6 Cr cap; promising (6–7): up to ₹3 Cr; domestic: no lift
    const potentialCap = potential >= 8 ? 6
                       : potential >= 6 ? 3
                       : potential >= 4 ? 1.5
                       :                  realisticCap
    realisticCap = Math.max(realisticCap, potentialCap * persona.potentialWeight)
  }

  const desireFraction = blendedScore / 100
  const effectiveMultiplier = Math.min(persona.maxBidMultiplier, 1.5)
  let maxBid = realisticCap * desireFraction * effectiveMultiplier
  maxBid *= 0.85 + Math.random() * 0.25
  return Math.max(basePrice, Math.min(maxBid, safeBidLimit, ABSOLUTE_CAP))
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
