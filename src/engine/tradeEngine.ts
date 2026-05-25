/**
 * Trade Engine — validates and executes player trades between franchises.
 * Rule Engine is always authoritative — no trade executes without validation.
 */

import type { GameState } from '@/types/game'
import type { TeamId, TeamState } from '@/types/team'
import type { SoldPlayerRecord } from '@/types/player'
import type { TradeProposal, TradeRecord, TradeResponse } from '@/types/trade'
import type { AuctionDataset } from '@/types/dataset'
import { ALL_PERSONAS } from '@/personas'
import { buildTradeMessages } from '@/llm/prompts'
import { callLLMJsonSmart } from '@/llm/openRouterClient'
import type { TradeLLMResponse } from '@/llm/prompts'
import { getFallbackComment } from '@/llm/fallbackBank'
import { buildImportanceProfile, getAllLeaguePrices } from '@/engine/playerImportance'

// ─── Validation ────────────────────────────────────────────────────────────────

export interface TradeValidationResult {
  valid: boolean
  reason: string
}

export function validateTrade(
  state: GameState,
  dataset: AuctionDataset,
  proposal: TradeProposal,
): TradeValidationResult {
  const { proposedBy, proposedTo, legs } = proposal

  const byLeg = legs.find(l => l.teamId === proposedBy)
  const toLeg = legs.find(l => l.teamId === proposedTo)
  if (!byLeg || !toLeg) return { valid: false, reason: 'Malformed trade proposal — missing legs' }

  const byState = state.teamStates[proposedBy]
  const toState = state.teamStates[proposedTo]
  if (!byState || !toState) return { valid: false, reason: 'Team not found' }

  // Validate all offered players exist on the offering team's squad
  for (const pid of byLeg.playerIds) {
    if (!byState.squad.find(p => p.playerId === pid)) {
      return { valid: false, reason: `Player ${pid} not on ${proposedBy}'s squad` }
    }
  }
  for (const pid of toLeg.playerIds) {
    if (!toState.squad.find(p => p.playerId === pid)) {
      return { valid: false, reason: `Player ${pid} not on ${proposedTo}'s squad` }
    }
  }

  // Purse check: teams must not go negative after cash exchange
  if (byLeg.cashAmount > byState.currentPurse) {
    return { valid: false, reason: `${proposedBy} cannot afford ₹${byLeg.cashAmount} Cr cash` }
  }
  if (toLeg.cashAmount > toState.currentPurse) {
    return { valid: false, reason: `${proposedTo} cannot afford ₹${toLeg.cashAmount} Cr cash` }
  }

  // Overseas cap: simulate post-trade squad
  const byGainsOverseas = toLeg.playerIds
    .map(pid => toState.squad.find(p => p.playerId === pid))
    .filter(p => p?.isOverseas).length
  const byLosesOverseas = byLeg.playerIds
    .map(pid => byState.squad.find(p => p.playerId === pid))
    .filter(p => p?.isOverseas).length
  const byFinalOverseas = byState.overseasCount + byGainsOverseas - byLosesOverseas

  const toGainsOverseas = byLeg.playerIds
    .map(pid => byState.squad.find(p => p.playerId === pid))
    .filter(p => p?.isOverseas).length
  const toLosesOverseas = toLeg.playerIds
    .map(pid => toState.squad.find(p => p.playerId === pid))
    .filter(p => p?.isOverseas).length
  const toFinalOverseas = toState.overseasCount + toGainsOverseas - toLosesOverseas

  if (byFinalOverseas > dataset.overseasLimit) {
    return { valid: false, reason: `Trade would exceed ${proposedBy}'s overseas cap` }
  }
  if (toFinalOverseas > dataset.overseasLimit) {
    return { valid: false, reason: `Trade would exceed ${proposedTo}'s overseas cap` }
  }

  // Squad size: net player count must not exceed max
  const byNetChange = toLeg.playerIds.length - byLeg.playerIds.length
  const toNetChange = byLeg.playerIds.length - toLeg.playerIds.length
  if (byState.squad.length + byNetChange > dataset.maximumSquadSize) {
    return { valid: false, reason: `Trade would exceed ${proposedBy}'s squad size limit` }
  }
  if (toState.squad.length + toNetChange > dataset.maximumSquadSize) {
    return { valid: false, reason: `Trade would exceed ${proposedTo}'s squad size limit` }
  }

  return { valid: true, reason: 'Valid' }
}

// ─── Execution ────────────────────────────────────────────────────────────────

export function executeTrade(
  teamStates: Record<TeamId, TeamState>,
  proposal: TradeProposal,
): Record<TeamId, TeamState> {
  const { proposedBy, proposedTo, legs } = proposal
  const byLeg = legs.find(l => l.teamId === proposedBy)!
  const toLeg = legs.find(l => l.teamId === proposedTo)!

  const byState = { ...teamStates[proposedBy], squad: [...teamStates[proposedBy].squad] }
  const toState = { ...teamStates[proposedTo], squad: [...teamStates[proposedTo].squad] }

  // Players from proposedBy go to proposedTo, and vice versa
  const byGives = byLeg.playerIds.map(pid => byState.squad.find(p => p.playerId === pid)!)
  const toGives = toLeg.playerIds.map(pid => toState.squad.find(p => p.playerId === pid)!)

  byState.squad = [
    ...byState.squad.filter(p => !byLeg.playerIds.includes(p.playerId)),
    ...toGives.map(p => ({ ...p, soldTo: proposedBy as TeamId })),
  ]
  toState.squad = [
    ...toState.squad.filter(p => !toLeg.playerIds.includes(p.playerId)),
    ...byGives.map(p => ({ ...p, soldTo: proposedTo as TeamId })),
  ]

  // Purse adjustment: reclaim the retained cost of given players, pay the retained cost of received players, then exchange cash
  const byGivesValue = byGives.reduce((s, p) => s + p.soldPrice, 0)
  const toGivesValue = toGives.reduce((s, p) => s + p.soldPrice, 0)
  byState.currentPurse = byState.currentPurse + byGivesValue - toGivesValue - byLeg.cashAmount + toLeg.cashAmount
  toState.currentPurse = toState.currentPurse + toGivesValue - byGivesValue - toLeg.cashAmount + byLeg.cashAmount

  // Overseas count recalculate
  byState.overseasCount = byState.squad.filter(p => p.isOverseas).length
  toState.overseasCount = toState.squad.filter(p => p.isOverseas).length

  return {
    ...teamStates,
    [proposedBy]: byState,
    [proposedTo]: toState,
  }
}

// ─── AI response ──────────────────────────────────────────────────────────────

export async function getAITradeResponse(
  state: GameState,
  proposal: TradeProposal,
): Promise<TradeResponse> {
  const { proposedBy, proposedTo, legs } = proposal
  const persona = ALL_PERSONAS[proposedTo]
  const teamState = state.teamStates[proposedTo]

  const byLeg = legs.find(l => l.teamId === proposedBy)!
  const toLeg = legs.find(l => l.teamId === proposedTo)!

  const leaguePrices = getAllLeaguePrices(state.teamStates)

  const buildProfiles = (owningTeamId: TeamId, playerIds: string[], evaluatingTeamId: TeamId) =>
    playerIds.flatMap(pid => {
      const p = state.teamStates[owningTeamId].squad.find(s => s.playerId === pid)
      if (!p) return []
      return [buildImportanceProfile(p, state.teamStates[evaluatingTeamId], evaluatingTeamId, leaguePrices, state.seasonSetup)]
    })

  // offeredProfiles: players proposedBy is sending — evaluated from proposedTo's perspective (what they gain)
  const offeredProfiles  = buildProfiles(proposedBy, byLeg.playerIds, proposedTo)
  // requestedProfiles: players proposedTo must give up — their importance TO proposedTo
  const requestedProfiles = buildProfiles(proposedTo, toLeg.playerIds, proposedTo)
  const cashDelta = toLeg.cashAmount - byLeg.cashAmount  // positive = proposedTo receives cash

  if (!persona) {
    return {
      decision: 'reject',
      ownerComment: getFallbackComment(proposedTo, 'passing'),
      counteroffer: null,
      counterOfferStructured: null,
      reason: 'No persona found',
    }
  }

  const messages = buildTradeMessages({
    persona,
    offeredProfiles,
    requestedProfiles,
    cashDelta,
    teamState,
  })

  // Trade is a high-stakes, low-frequency decision — always use smart model
  const llm = await callLLMJsonSmart<TradeLLMResponse>(messages, { maxTokens: 500, temperature: 0.92 })

  if (llm) {
    // Normalize: model sometimes returns "true"/"false" as strings instead of booleans
    const rawAccepts = llm.accepts
    const accepts = rawAccepts === true || (rawAccepts as unknown) === 'true'
    const structured = llm.counterOfferStructured &&
      Array.isArray(llm.counterOfferStructured.playersToOffer) &&
      Array.isArray(llm.counterOfferStructured.playersToRequest)
        ? llm.counterOfferStructured
        : null
    return {
      decision: accepts ? 'accept' : 'reject',
      ownerComment: llm.ownerComment ?? getFallbackComment(proposedTo, accepts ? 'bidding_interested' : 'passing'),
      counteroffer: typeof llm.counterOffer === 'string' ? llm.counterOffer : null,
      counterOfferStructured: structured,
      reason: llm.reasoning ?? '',
    }
  }

  // Fallback heuristic — accept fair swaps, reject clearly one-sided deals
  const totalOfferedValue  = offeredProfiles.reduce((s, p) => s + p.player.soldPrice, 0) + Math.max(0, cashDelta)
  const totalRequestedValue = requestedProfiles.reduce((s, p) => s + p.player.soldPrice, 0)
  const hasHighValueLeaving = requestedProfiles.some(p => p.importanceScore >= 80)
  const gainValue = totalOfferedValue - totalRequestedValue

  const accepts = gainValue >= -3 && !hasHighValueLeaving
  return {
    decision: accepts ? 'accept' : 'reject',
    ownerComment: getFallbackComment(proposedTo, accepts ? 'bidding_interested' : 'passing'),
    counteroffer: null,
    counterOfferStructured: null,
    reason: accepts ? 'Fair value — accepted on numbers' : 'Not enough value for what we give up',
  }
}

// ─── Helper ────────────────────────────────────────────────────────────────────

export function getPlayerById(state: GameState, teamId: TeamId, playerId: string): SoldPlayerRecord | null {
  return state.teamStates[teamId]?.squad.find(p => p.playerId === playerId) ?? null
}

export function buildTradeRecord(
  proposal: TradeProposal,
  response: TradeResponse,
  applied: boolean,
): TradeRecord {
  return {
    proposal,
    response,
    applied,
    appliedAt: applied ? Date.now() : null,
  }
}
