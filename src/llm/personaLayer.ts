/**
 * Persona Layer — orchestrates per-team LLM calls for bidding decisions.
 * Pre-loads results for the next player while the current player is being auctioned.
 * Falls back to static comments on timeout/failure. Auction never stalls.
 */

import { callLLMJson, callLLMJsonSmart } from './openRouterClient'
import { buildBiddingMessages, buildRTMMessages, type BiddingLLMResponse, type RTMLLMResponse } from './prompts'
import { getFallbackComment, biddingScenario } from './fallbackBank'
import type { PlayerRecord } from '@/types/player'
import type { TeamState } from '@/types/team'
import type { FranchisePersona } from '@/types/team'
import { ALL_PERSONAS } from '@/personas'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PersonaResult {
  teamId: string
  interestLevel: number      // 0–100
  suggestedMaxBid: number    // in Cr
  emotionalTriggers: string[]
  ownerComment: string       // shown in UI
  reasoning: string
  source: 'llm' | 'fallback'
}

export interface RTMPersonaResult {
  teamId: string
  exercisesRTM: boolean
  ownerComment: string
  reasoning: string
  source: 'llm' | 'fallback'
}

// ─── Pre-load cache ────────────────────────────────────────────────────────────

// Map: playerId → Map<teamId, Promise<PersonaResult>>
const preloadCache = new Map<string, Map<string, Promise<PersonaResult>>>()

// ─── Single team LLM call ─────────────────────────────────────────────────────

async function fetchPersonaForTeam(
  teamId: string,
  persona: FranchisePersona,
  player: PlayerRecord,
  teamState: TeamState,
  currentBid: number,
  auctionYear: number,
  setName: string,
  soldCount: number,
): Promise<PersonaResult> {
  const messages = buildBiddingMessages({
    persona,
    player,
    teamState,
    currentBid,
    auctionYear,
    setName,
    soldCount,
  })

  // High-stakes bid (>₹10 Cr) or marquee player (>₹2 Cr base) → use smart model
  const isHighStakes = currentBid >= 10 || player.basePrice >= 2
  const caller = isHighStakes ? callLLMJsonSmart : callLLMJson
  const llm = await caller<BiddingLLMResponse>(messages, {
    maxTokens: 300,
    temperature: 0.9,
  })

  if (llm && typeof llm.interestLevel === 'number' && typeof llm.suggestedMaxBid === 'number') {
    return {
      teamId,
      interestLevel: Math.max(0, Math.min(100, llm.interestLevel)),
      suggestedMaxBid: Math.max(0, llm.suggestedMaxBid),
      emotionalTriggers: Array.isArray(llm.emotionalTriggers) ? llm.emotionalTriggers : [],
      ownerComment: llm.ownerComment ?? getFallbackComment(teamId, biddingScenario(50, false)),
      reasoning: llm.reasoning ?? '',
      source: 'llm',
    }
  }

  // Fallback
  const isAggressive = persona.auctionStyle === 'aggressive'
  const scenario = biddingScenario(50, isAggressive)
  return {
    teamId,
    interestLevel: 50,
    suggestedMaxBid: player.basePrice * 8,
    emotionalTriggers: [],
    ownerComment: getFallbackComment(teamId, scenario),
    reasoning: 'LLM unavailable — using static fallback',
    source: 'fallback',
  }
}

// ─── Pre-loader ────────────────────────────────────────────────────────────────

/**
 * Pre-load LLM persona results for a player in the background.
 * Call this while the current player is being auctioned.
 * Results are cached — getPersonaResults() will resolve instantly.
 */
export function preloadPersonaResults(
  player: PlayerRecord,
  interestedTeamIds: string[],
  teamStates: Record<string, TeamState>,
  currentBid: number,
  auctionYear: number,
  setName: string,
  soldCount: number,
): void {
  if (preloadCache.has(player.playerId)) return  // already loading

  const teamMap = new Map<string, Promise<PersonaResult>>()

  for (const teamId of interestedTeamIds) {
    const persona = ALL_PERSONAS[teamId]
    const teamState = teamStates[teamId]
    if (!persona || !teamState) continue

    const promise = fetchPersonaForTeam(
      teamId, persona, player, teamState,
      currentBid, auctionYear, setName, soldCount,
    )
    teamMap.set(teamId, promise)
  }

  preloadCache.set(player.playerId, teamMap)
}

/**
 * Get persona results for all interested teams for this player.
 * If pre-loaded, resolves instantly. If not, fires calls now (blocks briefly).
 */
export async function getPersonaResults(
  player: PlayerRecord,
  interestedTeamIds: string[],
  teamStates: Record<string, TeamState>,
  currentBid: number,
  auctionYear: number,
  setName: string,
  soldCount: number,
): Promise<Map<string, PersonaResult>> {
  // Fire pre-load if not already started
  preloadPersonaResults(player, interestedTeamIds, teamStates, currentBid, auctionYear, setName, soldCount)

  const teamMap = preloadCache.get(player.playerId)!
  const results = new Map<string, PersonaResult>()

  await Promise.all(
    interestedTeamIds.map(async teamId => {
      const promise = teamMap.get(teamId)
      if (promise) {
        const result = await promise
        results.set(teamId, result)
      }
    })
  )

  return results
}

/**
 * Get a single team's persona result for live bidding — NEVER blocks on LLM.
 *
 * If the pre-loaded promise is already resolved → returns it instantly.
 * If still in-flight → returns fallback immediately and lets LLM finish in background.
 * If not started → kicks off LLM in background, returns fallback immediately.
 *
 * This keeps the auction flowing at natural pace regardless of LLM speed.
 */
export function getPersonaResultForTeam(
  teamId: string,
  player: PlayerRecord,
  teamState: TeamState,
  currentBid: number,
  auctionYear: number,
  setName: string,
  soldCount: number,
): PersonaResult | Promise<PersonaResult> {
  const cached = preloadCache.get(player.playerId)?.get(teamId)

  if (cached) {
    // Race: if already resolved return sync-style, else fallback immediately
    let resolved: PersonaResult | undefined
    void cached.then(r => { resolved = r })
    // Microtask tick — if promise was already settled, resolved is set now
    if (resolved !== undefined) return resolved
    // Still in-flight — fire the background fetch (it'll update cache) and return fallback
  } else {
    // Not started — kick off in background so it's ready for later decisions
    const persona = ALL_PERSONAS[teamId]
    if (persona) {
      const promise = fetchPersonaForTeam(teamId, persona, player, teamState, currentBid, auctionYear, setName, soldCount)
      let teamMap = preloadCache.get(player.playerId)
      if (!teamMap) { teamMap = new Map(); preloadCache.set(player.playerId, teamMap) }
      teamMap.set(teamId, promise)
    }
  }

  const persona = ALL_PERSONAS[teamId]
  const isAggressive = persona?.auctionStyle === 'aggressive'
  return {
    teamId,
    interestLevel: 50,
    suggestedMaxBid: player.basePrice * 8,
    emotionalTriggers: [],
    ownerComment: getFallbackComment(teamId, biddingScenario(50, isAggressive)),
    reasoning: 'LLM pending — using static fallback',
    source: 'fallback',
  }
}

/**
 * Clear cache for a player after they're sold/unsold (memory management).
 */
export function clearPersonaCache(playerId: string): void {
  preloadCache.delete(playerId)
}

/**
 * Clear the entire cache (call at auction start/reset).
 */
export function clearAllPersonaCache(): void {
  preloadCache.clear()
}

// ─── RTM persona call ──────────────────────────────────────────────────────────

export async function getRTMPersonaResult(
  teamId: string,
  persona: FranchisePersona,
  player: PlayerRecord,
  teamState: TeamState,
  rtmPrice: number,
  auctionYear: number,
): Promise<RTMPersonaResult> {
  const messages = buildRTMMessages({ persona, player, teamState, rtmPrice, auctionYear })

  // RTM is always a high-stakes, one-shot decision — use smart model
  const llm = await callLLMJsonSmart<RTMLLMResponse>(messages, {
    maxTokens: 200,
    temperature: 0.8,
  })

  if (llm && typeof llm.exercisesRTM === 'boolean') {
    return {
      teamId,
      exercisesRTM: llm.exercisesRTM,
      ownerComment: llm.ownerComment ?? getFallbackComment(teamId, 'rtm_yes'),
      reasoning: llm.reasoning ?? '',
      source: 'llm',
    }
  }

  // Fallback: exercise RTM if purse allows and was their player
  const canAfford = teamState.currentPurse >= rtmPrice
  const wasTheirPlayer = player.previousTeam === teamId
  return {
    teamId,
    exercisesRTM: canAfford && wasTheirPlayer,
    ownerComment: getFallbackComment(teamId, canAfford && wasTheirPlayer ? 'rtm_yes' : 'rtm_no'),
    reasoning: 'LLM unavailable — using static fallback',
    source: 'fallback',
  }
}
