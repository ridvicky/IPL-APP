/**
 * RTM Engine — Right To Match decision logic for opponent franchises.
 * Determines whether an AI opponent exercises their RTM right after losing
 * a player to another team's winning bid.
 *
 * The Rule Engine (validateRTM) is always called first — this engine only
 * fires when RTM is structurally valid. It then decides based on persona.
 */

import type { GameState } from '@/types/game'
import type { AuctionDataset } from '@/types/dataset'
import type { TeamId } from '@/types/team'
import type { PlayerRecord } from '@/types/player'
import type { LLMPersonaResult } from '@/engine/biddingEngine'
import { validateRTM, getSafeBidLimit } from '@/engine/ruleEngine'
import { getPersona } from '@/personas/index'

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface RTMDecision {
  teamId: TeamId
  exercisesRTM: boolean
  reasoning: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decides whether an AI opponent exercises their RTM right.
 * Returns { exercisesRTM: false } immediately if Rule Engine blocks it.
 */
export function runRTMDecision(
  state: GameState,
  dataset: AuctionDataset,
  teamId: TeamId,
  currentPlayer: PlayerRecord,
  llmResult: LLMPersonaResult | null = null,
): RTMDecision {
  // Rule Engine is always the gate
  const ruleCheck = validateRTM(state, dataset, teamId)
  if (!ruleCheck.valid) {
    return { teamId, exercisesRTM: false, reasoning: `Rule Engine blocked: ${ruleCheck.reason}` }
  }

  const persona = getPersona(teamId)
  const teamState = state.teamStates[teamId]
  const rtmPrice = state.currentBidState!.currentBid

  // Safe bid limit check (RTM price must be affordable after squad reserve)
  const safeBidLimit = getSafeBidLimit(teamState, dataset)
  if (rtmPrice > safeBidLimit) {
    return { teamId, exercisesRTM: false, reasoning: 'RTM price exceeds safe bid limit' }
  }

  // Compute RTM desire score (0–100)
  let desireScore = 50

  // Loyalty: this is a former player the team explicitly held RTM rights for
  desireScore += 30 // RTM is only possible when the player IS eligible — strong baseline desire

  // Former player belonging to this team gets extra emotion
  if (currentPlayer.previousTeam === teamId) desireScore += 15

  // Auction style modifiers
  if (persona.auctionStyle === 'emotional') desireScore *= 1.20
  if (persona.auctionStyle === 'aggressive') desireScore *= 1.10
  if (persona.auctionStyle === 'analytical') desireScore *= 0.90
  if (persona.auctionStyle === 'moneyball') desireScore *= 0.85
  if (persona.auctionStyle === 'calculated') desireScore *= 0.95

  // RTM threshold from persona config
  const thresholdScore = persona.rtmThreshold * 100

  // LLM boost (Phase 2)
  if (llmResult) {
    desireScore = desireScore * 0.5 + llmResult.interestLevel * 0.5
  }

  // Price relative to safe limit — if RTM price is >80% of safe limit, temper desire
  const pricePressure = rtmPrice / safeBidLimit
  if (pricePressure > 0.80) desireScore *= (1 - (pricePressure - 0.80) * 1.5)

  desireScore = Math.min(100, Math.max(0, desireScore))

  const exercisesRTM = desireScore >= thresholdScore

  return {
    teamId,
    exercisesRTM,
    reasoning: exercisesRTM
      ? `Desire score ${desireScore.toFixed(0)} ≥ threshold ${thresholdScore.toFixed(0)} — RTM exercised`
      : `Desire score ${desireScore.toFixed(0)} < threshold ${thresholdScore.toFixed(0)} — RTM declined`,
  }
}

/**
 * Checks whether any team has an RTM opportunity for the current player
 * and returns the teamId if so, or null.
 * Intended to be called right after a player is sold to set up the RTM decision phase.
 */
export function findRTMEligibleTeam(
  state: GameState,
  dataset: AuctionDataset,
  currentPlayer: PlayerRecord,
  winningTeam: TeamId,
): TeamId | null {
  if (!dataset.rtmAvailable) return null
  if (!currentPlayer.rtmEligibleFor) return null

  const eligibleTeamId = currentPlayer.rtmEligibleFor as TeamId

  // Winning team cannot RTM their own winning bid
  if (eligibleTeamId === winningTeam) return null

  const teamState = state.teamStates[eligibleTeamId]
  if (!teamState) return null

  // Quick eligibility checks (mirrors validateRTM but without needing phase set yet)
  if (teamState.rtmSlotsAvailable <= teamState.rtmSlotsUsed) return null
  if (teamState.squad.length >= dataset.maximumSquadSize) return null
  if (currentPlayer.isOverseas && teamState.overseasCount >= dataset.overseasLimit) return null

  return eligibleTeamId
}
