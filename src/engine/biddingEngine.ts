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
  suggestedMaxBid: number     // advisory; still capped by Rule Engine
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
  const safeBidLimit = getSafeBidLimit(teamState, dataset)
  if (safeBidLimit <= 0 || nextBid > safeBidLimit) {
    return pass(teamId, staticInterest, 'Insufficient safe purse to bid')
  }

  // ── Step 4: Squad need score ──────────────────────────────────────────────
  const needScore = computeNeedScore(persona, teamState, currentPlayer, dataset)

  // ── Step 5: Emotion score ─────────────────────────────────────────────────
  const emotionScore = computeEmotionScore(persona, teamState, currentPlayer, llmResult)

  // ── Step 6: Max bid calculation ───────────────────────────────────────────
  const blendedScore = blendScores(staticInterest, needScore, emotionScore, llmResult)
  const maxBid = computeMaxBid(blendedScore, currentPlayer.basePrice, safeBidLimit, persona, llmResult)

  // ── Step 7: Bid or pass ───────────────────────────────────────────────────
  if (nextBid > maxBid) {
    return pass(teamId, blendedScore, `Next bid ₹${nextBid.toFixed(2)} exceeds max ₹${maxBid.toFixed(2)}`)
  }

  return {
    teamId,
    action: 'bid',
    bidAmount: nextBid,
    interestScore: blendedScore,
    reasoning: `Interest ${blendedScore.toFixed(0)}/100 — bidding ₹${nextBid.toFixed(2)} (max ₹${maxBid.toFixed(2)})`,
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
  llmResult: LLMPersonaResult | null,
): number {
  let score = 40 // neutral baseline

  // Former player loyalty triggers strong emotion
  if (player.previousTeam === persona.teamId) score += 25
  if (player.rtmEligibleFor === persona.teamId) score += 20

  // LLM-provided emotional triggers (Phase 2)
  if (llmResult && llmResult.emotionalTriggers.length > 0) {
    score += Math.min(30, llmResult.emotionalTriggers.length * 8)
  }

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
 * IPL reality: ₹2Cr base players routinely sell for ₹20–30Cr (10–15× base).
 * ₹0.3Cr base players: 3–8× base. Elite marquee: up to 25× base.
 *
 * Formula:
 *   tierMultiplier — scales with log of base price (higher base = more headroom)
 *   desireFraction — 0–1, from blended interest score
 *   maxBidMultiplier — persona aggression (1.0–2.0)
 *   Result: base × tier × desire × persona, capped by safe purse
 */
function computeMaxBid(
  blendedScore: number,
  basePrice: number,
  safeBidLimit: number,
  persona: FranchisePersona,
  llmResult: LLMPersonaResult | null,
): number {
  // Tier multiplier: ₹0.3Cr → ~8×, ₹2Cr → ~18×, ₹2Cr+ → ~22× ceiling
  // log10(0.3+1)=0.114 → 8.9; log10(2+1)=0.477 → 18.1; log10(3+1)=0.602 → 21.6
  const tierMultiplier = 5 + Math.log10(Math.max(basePrice, 0.3) + 1) * 27

  const desireFraction = blendedScore / 100
  let maxBid = basePrice * desireFraction * tierMultiplier * persona.maxBidMultiplier

  // ±20% natural variance — avoids identical cutoff prices across teams
  maxBid *= 0.80 + Math.random() * 0.40

  // LLM advisory (Phase 2) — blend in LLM suggested ceiling
  if (llmResult && llmResult.suggestedMaxBid > 0) {
    maxBid = maxBid * 0.35 + llmResult.suggestedMaxBid * 0.65
  }

  // Hard ceiling: never exceed safe bid limit
  return Math.min(maxBid, safeBidLimit)
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
  const setName = dataset.auctionSets[state.currentSetIndex]
  if (!setName) return null
  const players = getPlayersInSet(dataset, setName, state.releasedRetainedPlayers ?? [])
  return players[state.currentPlayerIndex] ?? null
}
