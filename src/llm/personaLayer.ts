/**
 * Persona Layer — orchestrates per-team LLM calls for bidding decisions.
 *
 * Call 1 (Player Worth): pre-loaded for all teams in background. Returns personalCeiling.
 * Call 2 (Fight or Fold): live, only when a team hits their ceiling. 3s timeout → fold.
 */

import { callLLMJson, callLLMJsonStrategic, callLLMFast } from './openRouterClient'
import {
  buildBiddingMessages,
  buildFightOrFoldMessages,
  buildRTMMessages,
  type BiddingLLMResponse,
  type FightOrFoldLLMResponse,
  type RTMLLMResponse,
  type ComparableSale,
} from './prompts'
import { getFallbackComment, biddingScenario } from './fallbackBank'
import type { PlayerRecord, PlayerFormContext } from '@/types/player'
import type { TeamState } from '@/types/team'
import type { FranchisePersona } from '@/types/team'
import { ALL_PERSONAS } from '@/personas'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PersonaResult {
  teamId: string
  interestLevel: number
  personalCeiling: number      // franchise's true max — LLM is authoritative
  jumpBid: number | null       // optional jump bid amount
  hasStretched: boolean        // true after fight-or-fold stretch (one-time only)
  emotionalTriggers: string[]
  ownerComment: string
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

// preloadCache: player → team → pending/resolved promise
const preloadCache = new Map<string, Map<string, Promise<PersonaResult>>>()
// resolvedCache: stores results as they settle so getPersonaResultForTeam() can
// return them synchronously without relying on .then() being called before check
const resolvedCache = new Map<string, Map<string, PersonaResult>>()
// formContextCache: player → form context (fetched once per player per session)
const formContextCache = new Map<string, PlayerFormContext>()

// ─── Player Recent Form Lookup ────────────────────────────────────────────────

/**
 * Fetches recent competitive form for a player using LLM knowledge (SMAT, int'l series,
 * ICC rankings, World Cup etc.). Fires once per player, cached for the session.
 * 2s timeout → returns source:'none' so auction never stalls.
 */
export async function fetchPlayerFormContext(
  player: PlayerRecord,
  auctionYear: number,
): Promise<PlayerFormContext> {
  if (formContextCache.has(player.playerId)) {
    return formContextCache.get(player.playerId)!
  }

  const prevYear = auctionYear - 1

  const messages = [
    {
      role: 'system' as const,
      content: `You are a cricket analyst with knowledge of all major T20 tournaments up to ${auctionYear}.
Provide a factual 2–3 sentence summary of this player's recent competitive form for the IPL ${auctionYear} auction.
Focus on: ${prevYear}–${auctionYear} domestic T20 season (SMAT or state-level for Indians, BBL/CPL/SA20/domestic for overseas), recent international T20I/ODI series, ${player.isOverseas ? 'ICC T20I world ranking,' : ''} any standout tournament performances (T20 World Cup, Asia Cup etc. in ${prevYear}–${auctionYear}).
Be honest — if you have limited reliable information, state that. Keep it factual, no speculation.
Respond with ONLY a valid JSON object. No markdown.`,
    },
    {
      role: 'user' as const,
      content: `Player: ${player.name}
Role: ${player.role}
Nationality: ${player.isOverseas ? player.country : 'Indian'}
Status: ${player.cappedStatus}

{"summary":"2-3 sentence form summary here","t20iRanking":${player.isOverseas ? 'null_or_number' : 'null'},"estimatedAge":null_or_number}`,
    },
  ]

  type FormLLMResponse = { summary: string; t20iRanking: number | null; estimatedAge: number | null }

  const llmCall = callLLMJsonStrategic<FormLLMResponse>(messages, {
    maxTokens: 200,
    temperature: 0.3,
  })
  const timeoutPromise = new Promise<null>(r => setTimeout(() => r(null), 2000))

  const result = await Promise.race([llmCall, timeoutPromise])

  const ctx: PlayerFormContext = result && typeof result.summary === 'string' && result.summary.length > 5
    ? {
        summary: result.summary,
        t20iRanking: typeof result.t20iRanking === 'number' ? result.t20iRanking : null,
        estimatedAge: typeof result.estimatedAge === 'number' ? result.estimatedAge : null,
        source: 'llm',
      }
    : { summary: '', t20iRanking: null, estimatedAge: null, source: 'none' }

  console.log(`[FORM] ${player.name}: ${ctx.source === 'llm' ? ctx.summary.slice(0, 80) + '…' : 'no context'}`)
  formContextCache.set(player.playerId, ctx)
  return ctx
}

// ─── Call 1: Player Worth Assessment ─────────────────────────────────────────

async function fetchPersonaForTeam(
  teamId: string,
  persona: FranchisePersona,
  player: PlayerRecord,
  teamState: TeamState,
  currentBid: number,
  auctionYear: number,
  setName: string,
  soldCount: number,
  nextAvailablePlayers: PlayerRecord[],
  allTeamPurses: { teamId: string; purse: number }[],
  startingPurse: number,
  comparableSales: ComparableSale[],
  formContext: PlayerFormContext | null,
): Promise<PersonaResult> {
  const messages = buildBiddingMessages({
    persona, player, teamState, currentBid, auctionYear, setName, soldCount,
    nextAvailablePlayers, allTeamPurses, startingPurse, comparableSales, formContext,
  })

  const llm = await callLLMJson<BiddingLLMResponse>(messages, {
    maxTokens: 250,
    temperature: 0.7,
  })

  if (llm && typeof llm.personalCeiling === 'number' && typeof llm.interestLevel === 'number') {
    return {
      teamId,
      interestLevel: Math.max(0, Math.min(100, llm.interestLevel)),
      personalCeiling: Math.max(currentBid, llm.personalCeiling),
      jumpBid: typeof llm.jumpBid === 'number' && llm.jumpBid > currentBid ? llm.jumpBid : null,
      hasStretched: false,
      emotionalTriggers: [],
      ownerComment: llm.ownerComment ?? getFallbackComment(teamId, biddingScenario(50, false)),
      reasoning: llm.reasoning ?? '',
      source: 'llm',
    }
  }

  return buildFallbackPersona(teamId, persona, player, currentBid)
}

function buildFallbackPersona(
  teamId: string,
  persona: FranchisePersona,
  player: PlayerRecord,
  _currentBid: number,
): PersonaResult {
  const isAggressive = persona.auctionStyle === 'aggressive'
  const scenario = biddingScenario(50, isAggressive)
  return {
    teamId,
    interestLevel: 50,
    personalCeiling: player.basePrice * persona.maxBidMultiplier * 4,
    jumpBid: null,
    hasStretched: false,
    emotionalTriggers: [],
    ownerComment: getFallbackComment(teamId, scenario),
    reasoning: 'LLM pending — using static fallback',
    source: 'fallback',
  }
}

// ─── Pre-loader ────────────────────────────────────────────────────────────────

export function preloadPersonaResults(
  player: PlayerRecord,
  interestedTeamIds: string[],
  teamStates: Record<string, TeamState>,
  currentBid: number,
  auctionYear: number,
  setName: string,
  soldCount: number,
  nextAvailablePlayers: PlayerRecord[],
  allTeamPurses: { teamId: string; purse: number }[],
  startingPurses: Record<string, number>,
  comparableSales: ComparableSale[],
  formContext: PlayerFormContext | null = null,
): void {
  if (preloadCache.has(player.playerId)) return

  const teamMap = new Map<string, Promise<PersonaResult>>()

  for (const teamId of interestedTeamIds) {
    const persona    = ALL_PERSONAS[teamId]
    const teamState  = teamStates[teamId]
    if (!persona || !teamState) continue

    const promise = fetchPersonaForTeam(
      teamId, persona, player, teamState,
      currentBid, auctionYear, setName, soldCount,
      nextAvailablePlayers, allTeamPurses,
      startingPurses[teamId] ?? teamState.currentPurse,
      comparableSales,
      formContext,
    )
    // When promise settles, store result in resolvedCache so getPersonaResultForTeam()
    // can retrieve it synchronously without relying on .then() timing.
    void promise.then(result => {
      let resolvedMap = resolvedCache.get(player.playerId)
      if (!resolvedMap) { resolvedMap = new Map(); resolvedCache.set(player.playerId, resolvedMap) }
      resolvedMap.set(teamId, result)
    })
    teamMap.set(teamId, promise)
  }

  preloadCache.set(player.playerId, teamMap)
}

/**
 * Get persona result for live bidding — NEVER blocks on LLM.
 * Returns cached result if resolved, fallback immediately if pending.
 */
export function getPersonaResultForTeam(
  teamId: string,
  player: PlayerRecord,
  teamState: TeamState,
  currentBid: number,
  auctionYear: number,
  setName: string,
  soldCount: number,
  nextAvailablePlayers: PlayerRecord[],
  allTeamPurses: { teamId: string; purse: number }[],
  startingPurse: number,
  comparableSales: ComparableSale[],
  formContext: PlayerFormContext | null = null,
): PersonaResult | Promise<PersonaResult> {
  // Check if LLM result has already settled (synchronous path — no blocking)
  const alreadyResolved = resolvedCache.get(player.playerId)?.get(teamId)
  if (alreadyResolved) return alreadyResolved

  if (!preloadCache.get(player.playerId)?.has(teamId)) {
    // Not started — kick off in background and register into both caches
    const persona = ALL_PERSONAS[teamId]
    if (persona) {
      const promise = fetchPersonaForTeam(
        teamId, persona, player, teamState,
        currentBid, auctionYear, setName, soldCount,
        nextAvailablePlayers, allTeamPurses, startingPurse, comparableSales,
        formContext,
      )
      void promise.then(result => {
        let resolvedMap = resolvedCache.get(player.playerId)
        if (!resolvedMap) { resolvedMap = new Map(); resolvedCache.set(player.playerId, resolvedMap) }
        resolvedMap.set(teamId, result)
      })
      let teamMap = preloadCache.get(player.playerId)
      if (!teamMap) { teamMap = new Map(); preloadCache.set(player.playerId, teamMap) }
      teamMap.set(teamId, promise)
    }
  }

  // LLM is in-flight — return static fallback immediately (never blocks)
  const persona = ALL_PERSONAS[teamId]
  return buildFallbackPersona(teamId, persona!, player, currentBid)
}

// ─── Call 2: Fight or Fold ────────────────────────────────────────────────────

/**
 * Called when a team has hit their personalCeiling and would otherwise pass.
 * Makes one strategic LLM call (max 3s). Falls back to "fold" on timeout/failure.
 * The team can only stretch ONCE — hasStretched is set true after this.
 */
export async function getFightOrFoldDecision(
  persona: FranchisePersona,
  player: PlayerRecord,
  currentPersona: PersonaResult,
  currentBid: number,
  teamState: TeamState,
  activeBidders: { teamId: string; purse: number }[],
  currentLeader: { teamId: string; purse: number },
  playersStillNeeded?: number,
): Promise<{ stretch: boolean; newCeiling: number; ownerComment: string }> {
  console.log(`[LLM] FIGHT-OR-FOLD: ${persona.teamId} at ₹${currentBid}Cr (ceiling ₹${currentPersona.personalCeiling}Cr)`)

  const messages = buildFightOrFoldMessages({
    persona, player, currentBid,
    personalCeiling: currentPersona.personalCeiling,
    teamState, activeBidders, currentLeader,
    playersStillNeeded,
  })

  // Race: 3s timeout → fold
  const foldResult = {
    stretch: false,
    newCeiling: currentPersona.personalCeiling,
    ownerComment: getFallbackComment(persona.teamId, 'passing'),
  }

  const llmPromise = callLLMJsonStrategic<FightOrFoldLLMResponse>(messages, {
    maxTokens: 180,
    temperature: 0.6,
  })
  const timeoutPromise = new Promise<null>(r => setTimeout(() => r(null), 3000))

  const result = await Promise.race([llmPromise, timeoutPromise])

  if (!result) {
    console.warn('[LLM] Fight-or-fold timed out → fold')
    return foldResult
  }

  const stretchBid = result.stretchBid === true || (result.stretchBid as unknown) === 'true'
  if (!stretchBid) {
    return {
      stretch: false,
      newCeiling: currentPersona.personalCeiling,
      ownerComment: result.ownerComment ?? getFallbackComment(persona.teamId, 'passing'),
    }
  }

  // Hard cap: stretch cannot exceed 28% above original ceiling or 28 Cr absolute
  const stretchCap = Math.min(currentPersona.personalCeiling * 1.28, 28)
  const newCeiling = typeof result.newCeiling === 'number'
    ? Math.min(Math.max(currentBid, result.newCeiling), stretchCap)
    : Math.min(currentBid + 1.5, stretchCap)

  return {
    stretch: true,
    newCeiling,
    ownerComment: result.ownerComment ?? getFallbackComment(persona.teamId, 'bidding_interested'),
  }
}

// ─── Cache helpers ─────────────────────────────────────────────────────────────

/** Synchronously read a cached form context (returns null if not yet fetched) */
export function getFormContext(playerId: string): PlayerFormContext | null {
  return formContextCache.get(playerId) ?? null
}

export function clearPersonaCache(playerId: string): void {
  preloadCache.delete(playerId)
  resolvedCache.delete(playerId)
  formContextCache.delete(playerId)
}

export function clearAllPersonaCache(): void {
  preloadCache.clear()
  resolvedCache.clear()
  formContextCache.clear()
}

// ─── Auctioneer commentary ─────────────────────────────────────────────────────

/**
 * Generates a single punchy auctioneer line for key moments.
 * Uses the fast/free model. 1.5s timeout → returns null (silently skipped).
 */
export async function fetchAuctioneerComment(
  event: 'intro' | 'sold' | 'unsold',
  player: PlayerRecord,
  details: { team?: string; price?: number } = {},
): Promise<string | null> {
  const roleDesc = { BAT: 'Batter', BWL: 'Bowler', AR: 'All-Rounder', WK: 'Wicket-Keeper' }[player.role] ?? player.role
  const origin   = player.isOverseas ? player.country : 'India'

  const prompt =
    event === 'intro'
      ? `IPL auctioneer, ONE dramatic sentence (max 14 words): "${player.name}", ${roleDesc} from ${origin}, base ₹${player.basePrice.toFixed(2)} Cr going under the hammer. Output only the sentence.`
      : event === 'sold'
      ? `IPL auctioneer, ONE triumphant sentence (max 14 words): "${player.name}" SOLD to ${details.team} for ₹${details.price?.toFixed(2)} Cr! Output only the sentence.`
      : `IPL auctioneer, ONE brief sympathetic sentence (max 12 words): "${player.name}" goes unsold. Output only the sentence.`

  const llmCall = callLLMFast(
    [{ role: 'user', content: prompt }],
    { maxTokens: 60, temperature: 1.0 },
  )
  const timeout = new Promise<null>(r => setTimeout(() => r(null), 1500))
  const result  = await Promise.race([llmCall, timeout])

  // Strip surrounding quotes if the model wraps the sentence
  return result ? result.replace(/^["']|["']$/g, '').trim() || null : null
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

  const llm = await callLLMJsonStrategic<RTMLLMResponse>(messages, {
    maxTokens: 200,
    temperature: 0.75,
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

  const canAfford      = teamState.currentPurse >= rtmPrice
  const wasTheirPlayer = player.previousTeam === teamId
  const withinThreshold = Math.random() < persona.rtmThreshold
  return {
    teamId,
    exercisesRTM: canAfford && wasTheirPlayer && withinThreshold,
    ownerComment: getFallbackComment(teamId, canAfford && wasTheirPlayer ? 'rtm_yes' : 'rtm_no'),
    reasoning: 'LLM unavailable — static fallback',
    source: 'fallback',
  }
}
