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
import { FRANCHISE_TARGETS } from '@/data/franchiseTargets'
import { AR_BOWLING_TYPES } from '@/data/arBowlingTypes'
import { BATTING_POSITIONS } from '@/data/battingPositions'
import { CAPTAIN_CANDIDATES, getCaptainScore } from '@/data/captainCandidates'

// ─────────────────────────────────────────────────────────────────────────────
// Session salt — randomises per-team affinity each auction so no two runs feel identical
// ─────────────────────────────────────────────────────────────────────────────
const SESSION_SALT = Math.floor(Math.random() * 99991).toString()

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

  const squadSize = teamState.squad.length
  const maxSquad = dataset.maximumSquadSize   // 25
  const slotsRemaining = maxSquad - squadSize

  // ── Re-auction hard override: squad < 19 → force bid, bypass reserve checks ──
  // Teams MUST reach minimum 19 players. The normal reserve check (slotsNeeded × ₹0.20)
  // blocks bids when purse is tight because it assumes full base prices — but re-auction
  // players cost 50% base, so the reserve is too conservative. Bypass it entirely and
  // only block on: already passed, already leading, squad full, overseas limit, raw purse.
  const REAUCTION_MIN_SQUAD = 19
  if (state.isReauction && squadSize < REAUCTION_MIN_SQUAD) {
    // Role-aware check: only force-bid if this role fills a genuine gap OR squad is critically thin
    const roleCounts = { BAT: 0, BWL: 0, AR: 0, WK: 0 }
    for (const p of teamState.squad) {
      if (p.role in roleCounts) roleCounts[p.role as keyof typeof roleCounts]++
    }
    const ROLE_MINIMUM = { BAT: 4, BWL: 4, AR: 2, WK: 1 }
    const roleMin = ROLE_MINIMUM[currentPlayer.role as keyof typeof ROLE_MINIMUM] ?? 3
    const roleCount = roleCounts[currentPlayer.role as keyof typeof roleCounts] ?? 0
    const roleNeeded = roleCount < roleMin
    const criticallyThin = squadSize < 15  // below 15 — bid on anything affordable

    if (roleNeeded || criticallyThin) {
      const nextBidForced = getNextBidAmount(dataset, bidState, currentPlayer.basePrice)
      if (bidState.teamsPassed.includes(teamId)) return pass(teamId, 0, 'Already passed')
      if (bidState.currentLeader === teamId && !bidState.rtmPending) return pass(teamId, 0, 'Already leading')
      if (squadSize >= maxSquad) return pass(teamId, 0, 'Squad full')
      if (currentPlayer.isOverseas && teamState.overseasCount >= dataset.overseasLimit) return pass(teamId, 0, 'Overseas limit')
      if (teamState.currentPurse < nextBidForced) return pass(teamId, 0, 'Insufficient purse')
      return { action: 'bid', teamId, bidAmount: nextBidForced, interestScore: 100, reasoning: 'Re-auction squad minimum override' }
    }
    // Role not needed AND squad not critically thin — fall through to normal pipeline
  }

  // ── Step 1: Static franchise intent ───────────────────────────────────────
  const staticInterest = computeStaticInterest(persona, teamState, currentPlayer, dataset, state.currentSetIndex, bidState)

  // Squad-thin floor: scales against max squad size (25), not a hard-coded 20.
  // Starts earlier (set 8+) and becomes very aggressive when the squad is critically thin.
  // A team with 10 players in set 25 should be bidding on almost everything it can afford.
  let squadFloor = 0
  if (slotsRemaining >= 15) {
    squadFloor = slotsRemaining * 2.5          // critically thin — up to +37 at 15 slots short
  } else if (slotsRemaining >= 10 && state.currentSetIndex >= 8) {
    squadFloor = slotsRemaining * 2.0          // very thin
  } else if (slotsRemaining >= 5 && state.currentSetIndex >= 12) {
    squadFloor = slotsRemaining * 1.5          // thin — original behaviour
  }

  const effectiveInterest = staticInterest + squadFloor

  // Pass threshold drops progressively through the auction and with squad thinness.
  // A thin squad late in the auction should almost never pass on an affordable player.
  let passThreshold = state.currentSetIndex >= 25 ? 22
                    : state.currentSetIndex >= 20 ? 28
                    : state.currentSetIndex >= 15 ? 33
                    :                               40
  if (slotsRemaining >= 15) passThreshold -= 12   // critically thin — desperate mode
  else if (slotsRemaining >= 10) passThreshold -= 6

  // Wire auctionStyle into pass threshold — selective teams bid less often, aggressive teams more
  const styleModifier = persona.auctionStyle === 'calculated' ?  +5
                      : persona.auctionStyle === 'analytical' ?  +4
                      : persona.auctionStyle === 'moneyball'  ?  +3
                      : persona.auctionStyle === 'aggressive' ?  -5
                      : persona.auctionStyle === 'emotional'  ?  -3
                      : 0
  passThreshold += styleModifier

  if (effectiveInterest < passThreshold) {
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
  const safeBidLimit = getSafeBidLimit(teamState, dataset, currentSetName, state.currentSetIndex, state.isReauction)
  if (safeBidLimit <= 0 || nextBid > safeBidLimit) {
    return pass(teamId, staticInterest, 'Insufficient safe purse to bid')
  }

  // ── Step 4: Squad need score ──────────────────────────────────────────────
  const needScore = computeNeedScore(persona, teamState, currentPlayer, dataset, state.currentSetIndex, state.auctionLog ?? [])

  // ── Step 5: Emotion score ─────────────────────────────────────────────────
  const emotionScore = computeEmotionScore(persona, teamState, currentPlayer, llmResult, state.auctionLog ?? [])

  // ── Step 6: Max bid calculation ───────────────────────────────────────────
  const blendedScore = blendScores(staticInterest, needScore, emotionScore, llmResult)

  // Emotional star bonus: former franchise players and marquee stars push ceilings up.
  // Only truly elite players (MV ≥ ₹18 Cr) can reach the ₹25 Cr+ tier —
  // otherwise the emotional bonus is capped to avoid inflating mid-tier stars.
  const isEmotionalTarget = currentPlayer.previousTeam === persona.teamId ||
                            currentPlayer.rtmEligibleFor === persona.teamId
  const mv = currentPlayer.marketValue ?? 0
  const isTrulyMarquee = currentPlayer.cappedStatus === 'capped' && mv >= 18  // Pant / Gill tier
  const emotionalMultiplier = isEmotionalTarget
    ? (isTrulyMarquee ? 1.25 : 1.15)  // loyalty bonus scaled to player tier
    : isTrulyMarquee ? 1.08            // genuine marquee — tiny premium only
    : 1.0                              // everyone else: no emotional inflation

  // Hard absolute cap — enforced AFTER all multipliers so it truly holds.
  // Real IPL record is Rishabh Pant ₹27 Cr. ₹25+ Cr bids are rare (3–9 players per mega auction).
  const AUCTION_HARD_CAP = 28
  const rawMaxBid = computeMaxBid(blendedScore, currentPlayer.basePrice, safeBidLimit, persona, llmResult, currentPlayer.marketValue, currentPlayer, bidState) * emotionalMultiplier
  const maxBid = Math.min(rawMaxBid, safeBidLimit, AUCTION_HARD_CAP)

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

// ─────────────────────────────────────────────────────────────────────────────
// Player classification helpers
// ─────────────────────────────────────────────────────────────────────────────

function getPlayerTier(player: PlayerRecord): 'prime' | 'reliable' | 'depth' {
  const mv = player.marketValue ?? 0
  if (player.cappedStatus === 'capped') {
    if (mv >= 8 || player.basePrice >= 2)   return 'prime'
    if (mv >= 2.5 || player.basePrice >= 1) return 'reliable'
    return 'depth'
  }
  const pot = player.potential ?? 0
  if (pot >= 8 || player.prospectTier === 'elite')     return 'prime'
  if (pot >= 6 || player.prospectTier === 'promising') return 'reliable'
  return 'depth'
}

function getARArchetype(player: PlayerRecord): string | null {
  if (player.role !== 'AR') return null
  const bowlType = (player as PlayerRecord & { bowlingType?: string }).bowlingType
    ?? AR_BOWLING_TYPES[player.playerId]
  const batPos = getBattingPosition(player)
  if (!bowlType || !batPos) return null
  return `${bowlType}-${batPos}`  // e.g. 'spin-middleOrder', 'pace-finisher'
}

function getBattingPosition(player: PlayerRecord): 'opener' | 'middleOrder' | 'finisher' | null {
  if (BATTING_POSITIONS[player.playerId]) return BATTING_POSITIONS[player.playerId]
  const set = player.auctionSet?.toLowerCase() ?? ''
  if (set.includes('batters 1') || set.includes('marquee')) return 'opener'
  if (set.includes('batters 2')) return 'middleOrder'
  if (set.includes('batters 3') || set.includes('batters 4')) return 'finisher'
  return null
}

/**
 * Assembles live context for LLM prompt — squad snapshot, purse, current bid, player profile.
 * The persona's llmPersonaPrompt provides character; this provides the live situation.
 */
export function buildLLMContext(
  persona: FranchisePersona,
  teamState: TeamState,
  player: PlayerRecord,
  bidState: BidState,
  currentSetIndex: number,
  dataset: AuctionDataset,
): string {
  const roleCounts = { BAT: 0, BWL: 0, AR: 0, WK: 0 }
  for (const p of teamState.squad) {
    if (p.role in roleCounts) roleCounts[p.role as keyof typeof roleCounts]++
  }
  const recentBuys = teamState.squad
    .slice(-5)
    .map(p => `${p.name} (${p.role})`)
    .join(', ') || 'None yet'

  const hasCaptain = teamState.squad.some(p => {
    const profile = CAPTAIN_CANDIDATES[(p as PlayerRecord).playerId]
    return profile && getCaptainScore(profile) >= 55
  })

  const playerTier = getPlayerTier(player)
  const batPos = getBattingPosition(player)
  const bowlingType = (player as PlayerRecord & { bowlingType?: string }).bowlingType
    ?? (player.role === 'AR' ? AR_BOWLING_TYPES[player.playerId] : undefined)

  return `[AUCTION — Set ${currentSetIndex + 1}]
Team: ${persona.displayName} | Purse: ₹${teamState.currentPurse.toFixed(1)} Cr | Squad: ${teamState.squad.length} players
Role counts — BAT:${roleCounts.BAT} BWL:${roleCounts.BWL} AR:${roleCounts.AR} WK:${roleCounts.WK}
Has captain figure in squad: ${hasCaptain ? 'Yes' : 'No — actively seeking'}
Overseas slots: ${teamState.overseasCount}/${dataset.overseasLimit} used
Recent buys: ${recentBuys}

Current player: ${player.name} | Role: ${player.role}${batPos ? ` (${batPos})` : ''}${bowlingType ? ` | ${bowlingType} bowler` : ''}
Status: ${player.cappedStatus} | Tier: ${playerTier} | Base: ₹${player.basePrice} Cr | Market value: ₹${player.marketValue ?? '?'} Cr
Current bid: ₹${bidState.currentBid > 0 ? bidState.currentBid.toFixed(1) : player.basePrice.toFixed(1)} Cr | Leader: ${bidState.currentLeader ?? 'None'}

Respond ONLY with valid JSON:
{
  "bid": true | false,
  "ownerComment": "1–2 sentence in-character comment referencing the player by name and your squad situation",
  "reasoning": "1 sentence internal reasoning",
  "jumpBid": null
}`
}

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
  currentSetIndex = 0,
  bidState?: BidState | null,
): number {
  // Hard guards — no interest possible
  if (player.isOverseas && teamState.overseasCount >= dataset.overseasLimit) return 0
  if (teamState.squad.length >= dataset.maximumSquadSize) return 0

  const squad = teamState.squad
  const roleCounts = { BAT: 0, BWL: 0, AR: 0, WK: 0 }
  for (const p of squad) { if (p.role in roleCounts) roleCounts[p.role as keyof typeof roleCounts]++ }
  const thisRoleCount = roleCounts[player.role] ?? 0

  // ── Role saturation: biggest single filter ────────────────────────────────
  // Raised floor from 0.12 → 0.22 so deep-squad teams still consider depth picks.
  // WK stays strict (you never need 3 WKs) but non-WK roles need 7-8 players in a 25-man squad.
  const saturationMultiplier =
    player.role === 'WK'
      ? (thisRoleCount === 0 ? 1.0 : thisRoleCount === 1 ? 0.50 : 0.08)
      : thisRoleCount <= 2 ? 1.0
      : thisRoleCount <= 4 ? 0.72
      : thisRoleCount <= 6 ? 0.42
      : thisRoleCount <= 8 ? 0.28
      :                      0.18

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
  // SESSION_SALT changes every app launch — same player draws different interest each auction
  const affinityHash = (SESSION_SALT + persona.teamId + player.playerId).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
  const affinity = ((Math.abs(affinityHash) % 22) - 9)   // -9 to +12 per session
  score += affinity

  // Rivalry escalation: more active bidders validate the player's worth → FOMO kicks in
  if (bidState) {
    const bidderTeams = new Set((bidState.bids ?? []).map(b => b.teamId))
    const activeBidderCount = [...bidderTeams].filter(t => !bidState.teamsPassed.includes(t as TeamId)).length
    if (activeBidderCount >= 3) score += 8
    if (activeBidderCount >= 5) score += 8
    if (activeBidderCount >= 7) score += 6
  }

  // Apply role saturation and overseas conservation.
  // Late auction relief scales with both set index AND how thin the squad is —
  // a team with 10 players should be almost fully relieved of saturation penalties.
  const slotsShort = Math.max(0, dataset.maximumSquadSize - teamState.squad.length)
  const thinSquadRelief = slotsShort >= 15 ? 0.55
                        : slotsShort >= 10 ? 0.40
                        : slotsShort >= 5  ? 0.20
                        : 0
  const lateSaturationRelief = currentSetIndex >= 20 ? 0.35
                              : currentSetIndex >= 15 ? 0.20
                              : currentSetIndex >= 10 ? 0.10
                              : 0
  const adjustedSaturation = Math.min(1.0, saturationMultiplier + lateSaturationRelief + thinSquadRelief)
  score *= adjustedSaturation * overseasMult

  // ── Post-saturation bonuses (all applied AFTER saturation so they aren't suppressed) ──

  // Franchise targeting: a team pursuing their real-world target ignores role coverage
  const targetBonus = (FRANCHISE_TARGETS[player.playerId] ?? []).includes(persona.teamId) ? 22 : 0
  score += targetBonus

  // ── Session unpredictability: surprise bidder + cold room ─────────────────
  // Reduced cold room to 4% (was 8%) — too frequent at 8%, caused squads to stall.
  // Surprise bidder stays at 7% — adds excitement without blocking completion.
  // Cold room is also suppressed when squad is critically thin (team can't afford to skip).
  const surpriseHash = Math.abs((SESSION_SALT + persona.teamId + player.playerId + currentSetIndex)
    .split('').reduce((h, c) => (h * 37 + c.charCodeAt(0)) | 0, 0))
  const surpriseRoll = surpriseHash % 100
  if (surpriseRoll < 7) {
    score += 14   // surprise bidder
  } else if (surpriseRoll >= 92 && slotsShort < 10) {
    // Cold room only fires when squad isn't critically thin (4% chance)
    score -= 10
  }

  // ── Star / recency appeal ─────────────────────────────────────────────────
  // Elite proven players always attract more bidders regardless of role coverage.
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
    score += mv >= 8 ? 10 : mv >= 5 ? 6 : 3
  }

  // ── AR archetype affinity (unified bowling × batting style for All-Rounders) ──
  if (player.role === 'AR') {
    const archetype = getARArchetype(player)
    if (archetype) {
      score *= persona.arArchetypeAffinity[archetype] ?? 1.0
    } else {
      // Unknown archetype — fall back to generic bowling affinity
      const bowlType = (player as PlayerRecord & { bowlingType?: 'pace' | 'spin' }).bowlingType
        ?? AR_BOWLING_TYPES[player.playerId]
      if (bowlType) score *= persona.bowlingAffinity[bowlType]
    }
  }

  // ── Bowling type affinity — pure bowlers only (ARs handled above) ─────────
  if (player.role === 'BWL') {
    const bowlingType = (player as PlayerRecord & { bowlingType?: 'pace' | 'spin' }).bowlingType
    if (bowlingType) score *= persona.bowlingAffinity[bowlingType]
  }

  // ── Batting position affinity — BAT and WK only (ARs handled above) ───────
  if (player.role === 'BAT' || player.role === 'WK') {
    const batPos = getBattingPosition(player)
    if (batPos) score *= persona.battingPositionAffinity[batPos]
  }

  // ── Captaincy premium ──────────────────────────────────────────────────────
  const captainProfile = CAPTAIN_CANDIDATES[player.playerId]
  if (captainProfile) {
    const captainScore = getCaptainScore(captainProfile)
    const hasCaptainInSquad = squad.some(p => {
      const profile = CAPTAIN_CANDIDATES[(p as PlayerRecord).playerId]
      return profile && getCaptainScore(profile) >= 55
    })
    if (!hasCaptainInSquad) {
      score += (captainScore / 100) * 20 * persona.captaincyWeight
    } else if (captainScore >= 70) {
      score += (captainScore / 100) * 8 * persona.captaincyWeight
    }
  }

  // ── Player type affinity (stars / youth / value) ──────────────────────────
  const { stars, youth, value } = persona.playerTypeAffinity
  const bp = player.basePrice
  if (player.cappedStatus === 'capped' && mv >= 8) {
    score *= stars   // RCB ×1.30 on marquee stars, RR ×0.80
  }
  if (player.cappedStatus === 'uncapped' && (player.potential ?? 0) >= 7) {
    score *= youth   // GT ×1.25, CSK ×0.60
  }
  if (mv > 0 && bp > 0 && mv / bp >= 3) {
    score *= value   // RR ×1.30 on value buys, RCB ×0.70
  }

  // ── Stage squad-size ceiling: penalise over-acquisition per stage ────────────
  // Prevents teams from hoarding 8+ players in marquee sets and starving later sets.
  const stageMaxSquad = currentSetIndex <= 2  ? 7
                      : currentSetIndex <= 9  ? 12
                      : currentSetIndex <= 15 ? 18
                      : dataset.maximumSquadSize
  const overQuota = squad.length - stageMaxSquad
  if (overQuota > 0) {
    score -= Math.min(overQuota * 12, 48)
  }

  // ── Uncapped quota nudge ───────────────────────────────────────────────────
  // Teams aim for 2 minimum and ~5 typically. This is a nudge, not a mandate —
  // team affinity, player potential, and player worth still do most of the filtering.
  // A low-potential wrong-fit player won't clear the threshold; a good-fit prospect will.
  if (player.cappedStatus === 'uncapped' && currentSetIndex >= 16) {
    const uncappedInSquad = squad.filter(p => (p as PlayerRecord).cappedStatus === 'uncapped').length
    if (uncappedInSquad < 2) {
      score += 12
    } else if (uncappedInSquad < 5) {
      score += 10
    } else if (uncappedInSquad < 8) {
      score += 8
    } else if (uncappedInSquad < 11) {
      score += 8
    }
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
  persona: FranchisePersona,
  teamState: TeamState,
  player: PlayerRecord,
  dataset: AuctionDataset,
  currentSetIndex = 0,
  auctionLog: string[] = [],
): number {
  const squad = teamState.squad
  const totalSlots = dataset.maximumSquadSize
  const tierTargets = persona.squadTierTargets

  const roleCounts = { BAT: 0, BWL: 0, AR: 0, WK: 0 }
  for (const p of squad) {
    if (p.role in roleCounts) roleCounts[p.role as keyof typeof roleCounts]++
  }

  // Tier-specific need: how many of this role+tier does the team have vs their target?
  const playerTier = getPlayerTier(player)
  const roleKey = player.role as 'BAT' | 'BWL' | 'AR' | 'WK'
  const tierTarget = tierTargets[roleKey]?.[playerTier] ?? 2

  let tierCount = squad.filter(p =>
    p.role === player.role && getPlayerTier(p as PlayerRecord) === playerTier
  ).length

  // AR duality: ARs count toward BAT need (0.5×) and BWL need (0.6×)
  if (player.role === 'BAT') {
    const arSameTier = squad.filter(p => p.role === 'AR' && getPlayerTier(p as PlayerRecord) === playerTier).length
    const wkSameTier = squad.filter(p => p.role === 'WK' && getPlayerTier(p as PlayerRecord) === playerTier).length
    tierCount += arSameTier * 0.50 + wkSameTier * 0.50
  }
  if (player.role === 'BWL') {
    const arSameTier = squad.filter(p => p.role === 'AR' && getPlayerTier(p as PlayerRecord) === playerTier).length
    tierCount += arSameTier * 0.60
  }

  const tierGap = Math.max(0, tierTarget - tierCount)
  const tierGapRatio = tierGap / Math.max(tierTarget, 1)

  let needScore: number
  if (player.role === 'WK') {
    if (playerTier === 'prime')      needScore = tierGapRatio > 0 ? 85 : 15
    else if (playerTier === 'reliable') needScore = tierGapRatio > 0 ? 55 : 20
    else                              needScore = tierGapRatio > 0 ? 35 : 10
  } else {
    needScore = 20 + tierGapRatio * 70   // 20 (saturated) → 90 (tier empty)
  }

  // Dynamic pivot: if team recently missed a player of the same role, urgency rises
  if (tierGapRatio > 0 && auctionLog.length > 0) {
    const recentLog = auctionLog.slice(-8)
    const teamRecentLoss = recentLog.some(entry =>
      entry.includes(`[${persona.teamId}]`) &&
      entry.toLowerCase().includes('pass') &&
      entry.toLowerCase().includes(player.role.toLowerCase())
    )
    if (teamRecentLoss) needScore *= 1.18
  }

  // Batting position need bonus — does the team need an opener vs middleOrder vs finisher?
  if (player.role === 'BAT' || player.role === 'WK' || player.role === 'AR') {
    const playerPos = getBattingPosition(player)
    if (playerPos) {
      const POSITION_TARGETS = { opener: 3, middleOrder: 4, finisher: 3 } as const
      const posCount = squad.filter(p =>
        (p.role === 'BAT' || p.role === 'WK' || p.role === 'AR') &&
        getBattingPosition(p as PlayerRecord) === playerPos
      ).length
      const posGap = Math.max(0, POSITION_TARGETS[playerPos] - posCount)
      if (posGap > 0) needScore *= (1 + posGap * 0.08)
    }
  }

  // AR bowling-type need: reduce need when team already has >60% of ARs in the same bowling style
  if (player.role === 'AR') {
    const archetype = getARArchetype(player)
    if (archetype) {
      const bowlType = archetype.startsWith('pace') ? 'pace' : 'spin'
      const totalARs = squad.filter(p => p.role === 'AR').length
      if (totalARs >= 3) {
        const sameBowlTypeARs = squad.filter(p => {
          if (p.role !== 'AR') return false
          const arch = getARArchetype(p as PlayerRecord)
          return arch ? arch.startsWith(bowlType) : false
        }).length
        if (sameBowlTypeARs / totalARs > 0.60) needScore *= 0.75
      }
    }
  }

  // Urgency rises as squad fills
  const fillRatio = squad.length / totalSlots
  needScore *= (1 + fillRatio * 0.25)

  // Overseas scarcity
  if (player.isOverseas) {
    const overseasLeft = dataset.overseasLimit - teamState.overseasCount
    if (overseasLeft === 1) needScore *= 1.15
  }

  // Tight purse
  if (teamState.currentPurse < 15) needScore *= 0.85
  if (teamState.currentPurse < 8)  needScore *= 0.70

  // Late-auction desperation
  if (currentSetIndex >= 12 && squad.length < 23) {
    needScore *= 1.0 + (23 - squad.length) * 0.07
  }

  return Math.min(100, Math.max(0, needScore))
}

function computeMomentumAdjustment(persona: FranchisePersona, auctionLog: string[], player: PlayerRecord): number {
  if (auctionLog.length === 0) return 0
  const recentEntries = auctionLog.slice(-6)
  let momentumScore = 0

  // Team just spent big → cautious about next purchase
  const justSpentBig = recentEntries.some(e => {
    if (!e.includes('SOLD:') || !e.includes(persona.teamId)) return false
    const match = e.match(/₹(\d+\.?\d*)/)
    return match ? parseFloat(match[1]) >= 10 : false
  })
  if (justSpentBig) momentumScore -= 8

  // Team won 2 recent lots → confident momentum
  const teamWins = recentEntries.filter(e => e.includes('SOLD:') && e.includes(persona.teamId)).length
  if (teamWins >= 2) momentumScore += 6

  // Team got outbid repeatedly on same role → frustrated aggression
  const roleStr = player.role.toLowerCase()
  const recentRoleLosses = recentEntries.filter(e =>
    e.includes(`[${persona.teamId}]`) &&
    e.toLowerCase().includes('pass') &&
    e.toLowerCase().includes(roleStr)
  ).length
  if (recentRoleLosses >= 2) momentumScore += 10

  // Style amplifiers
  if (persona.auctionStyle === 'emotional')   momentumScore *= 1.4
  if (persona.auctionStyle === 'aggressive')  momentumScore *= 1.2
  if (persona.auctionStyle === 'analytical')  momentumScore *= 0.6
  if (persona.auctionStyle === 'moneyball')   momentumScore *= 0.4

  return Math.max(-15, Math.min(20, momentumScore))
}

/**
 * Step 5 — Emotional score based on persona triggers and situational factors.
 */
function computeEmotionScore(
  persona: FranchisePersona,
  _teamState: TeamState,
  player: PlayerRecord,
  _llmResult: LLMPersonaResult | null,
  auctionLog: string[] = [],
): number {
  let score = 40 // neutral baseline

  // Former player loyalty triggers strong emotion
  if (player.previousTeam === persona.teamId) score += 25
  if (player.rtmEligibleFor === persona.teamId) score += 20

  // Auction style modifiers
  if (persona.auctionStyle === 'aggressive') score *= 1.15
  if (persona.auctionStyle === 'emotional') score *= 1.25
  if (persona.auctionStyle === 'analytical') score *= 0.85
  if (persona.auctionStyle === 'moneyball') score *= 0.80
  if (persona.auctionStyle === 'calculated') score *= 0.90

  // Momentum adjustment based on recent auction events
  score += computeMomentumAdjustment(persona, auctionLog, player)

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
  bidState?: BidState | null,
): number {
  // Absolute hard ceiling — only Rishabh Pant (₹27 Cr) has ever come close
  const ABSOLUTE_CAP = 28

  if (llmResult && llmResult.personalCeiling > 0) {
    const variance = 0.95 + Math.random() * 0.10
    const ceiling = llmResult.personalCeiling * variance
    return Math.min(ceiling, safeBidLimit, ABSOLUTE_CAP)
  }

  // Active bidder count for scarcity calculations
  const activeBidderCount = bidState
    ? (() => {
        const bidderTeams = new Set((bidState.bids ?? []).map(b => b.teamId))
        return [...bidderTeams].filter(t => !bidState.teamsPassed.includes(t as TeamId)).length
      })()
    : 0

  if (marketValue && marketValue > basePrice * 1.2) {
    const desireFraction = blendedScore / 100
    let maxBid = marketValue * desireFraction * persona.maxBidMultiplier
    maxBid *= 0.90 + Math.random() * 0.20

    // Star floor: only apply when team genuinely needs this player (blendedScore ≥ 35)
    // Saturated teams don't get an artificial floor — reduces mechanical price inflation
    if (currentPlayer?.cappedStatus === 'capped' && marketValue >= 5 && blendedScore >= 35) {
      const starFloor = marketValue * 0.40 * (0.7 + persona.maxBidMultiplier * 0.2)
      maxBid = Math.max(maxBid, Math.min(starFloor, safeBidLimit))
    }

    // Scarcity inflation: crowded rooms push franchise ceilings higher.
    // Only truly marquee (MV ≥ ₹18 Cr) can reach full inflation — keeps ₹25+ Cr as a rare event.
    const playerMV = currentPlayer?.marketValue ?? 0
    const isTrulyMarqueeTier = playerMV >= 18 || (currentPlayer?.basePrice ?? 0) >= 12
    const isMarqueeTier      = playerMV >= 14 || (currentPlayer?.basePrice ?? 0) >= 10
    const isPrimeTier        = playerMV >= 8
    let scarcityMult = 1.0
    if (isTrulyMarqueeTier && activeBidderCount >= 5)  scarcityMult = 1.30
    else if (isTrulyMarqueeTier && activeBidderCount >= 3) scarcityMult = 1.15
    else if (isMarqueeTier && activeBidderCount >= 5)  scarcityMult = 1.18
    else if (isMarqueeTier && activeBidderCount >= 3)  scarcityMult = 1.10
    else if (isPrimeTier && activeBidderCount >= 5)    scarcityMult = 1.10
    else if (isPrimeTier && activeBidderCount >= 3)    scarcityMult = 1.05
    // Taper: when blendedScore is already high, need score has priced in the urgency — don't double-count
    if (scarcityMult > 1.0 && blendedScore > 72) {
      const taper = 1 - Math.min((blendedScore - 72) / 28, 0.65)
      scarcityMult = 1.0 + (scarcityMult - 1.0) * taper
    }
    maxBid *= scarcityMult

    return Math.min(maxBid, safeBidLimit, ABSOLUTE_CAP)
  }

  // Pure formula fallback (no real price known) — raised ceilings for uncapped stars
  let realisticCap = basePrice < 1  ? Math.min(basePrice * 8,  6)
                   : basePrice < 2  ? Math.min(basePrice * 6, 10)
                   : basePrice < 5  ? Math.min(basePrice * 4, 14)
                   : basePrice < 10 ? Math.min(basePrice * 2.5, 18)
                   :                  Math.min(basePrice * 1.8, 24)

  // Uncapped potential: raised caps to reflect real auction results (Suryavanshi-tier)
  if (currentPlayer?.cappedStatus === 'uncapped' && currentPlayer.potential != null) {
    const potential = currentPlayer.potential
    const potentialCap = potential >= 9 ? 18
                       : potential >= 8 ? 12
                       : potential >= 7 ? 7
                       : potential >= 6 ? 4
                       : potential >= 4 ? 2
                       :                  realisticCap
    realisticCap = Math.max(realisticCap, potentialCap * persona.potentialWeight)
  }

  const desireFraction = blendedScore / 100
  const effectiveMultiplier = Math.min(persona.maxBidMultiplier, 1.4)
  let maxBid = realisticCap * desireFraction * effectiveMultiplier
  maxBid *= 0.85 + Math.random() * 0.25
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
