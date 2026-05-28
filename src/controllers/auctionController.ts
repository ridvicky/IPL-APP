/**
 * Auction Room Controller — orchestrates the full auction state machine.
 *
 * Phase flow:
 *   setup → retention → set-preview → bidding ⟷ rtm-decision
 *                                   ↓
 *                           sale-confirmed | unsold-confirmed
 *                                   ↓
 *                      [next player] → set-preview
 *                      [next set]   → set-complete → set-preview
 *                      [done]       → auction-complete
 *
 * This controller is the only place that drives phase transitions.
 * It calls Rule Engine before every action and rejects invalid moves.
 * It runs AI decisions (Bidding Engine, RTM Engine) for opponent teams.
 */

import type { AuctionDataset } from '@/types/dataset'
import type { TeamId, TeamState } from '@/types/team'
import type { SoldPlayerRecord, UnsoldPlayerRecord } from '@/types/player'
import type { BidState } from '@/types/game'
import {
  validateBid,
  validateRTM,
  validateSaleConfirmation,
  validateSessionState,
} from '@/engine/ruleEngine'
import { runBiddingPipeline, getCurrentAuctionPlayer, type LLMPersonaResult } from '@/engine/biddingEngine'
import { runRTMDecision, findRTMEligibleTeam } from '@/engine/rtmEngine'
import { useGameStore } from '@/store/gameStore'
import { getFallbackComment } from '@/llm/fallbackBank'
import {
  getPersonaResultForTeam,
  getFightOrFoldDecision,
  getRTMPersonaResult,
  preloadPersonaResults,
  clearPersonaCache,
  fetchPlayerFormContext,
  getFormContext,
} from '@/llm/personaLayer'
import { ALL_PERSONAS } from '@/personas'
import { getBidIncrement, getComparableSales, getPlayersInSet } from '@/dataset/datasetLoader'

// ─────────────────────────────────────────────────────────────────────────────
// User actions (called from UI)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * User places a bid. Returns error message string or null on success.
 */
export function userBid(dataset: AuctionDataset, amount: number): string | null {
  const state = useGameStore.getState().gameState
  if (!state) return 'No active game state'

  const userTeam = state.userFranchise as TeamId
  const validation = validateBid(state, dataset, userTeam, amount)
  if (!validation.valid) return validation.reason

  useGameStore.getState().advanceBid(userTeam, amount)
  return null
}

/**
 * User interrupts the auctioneer's calling sequence to place a bid.
 * Clears the round-pass first so validateBid doesn't reject re-entry.
 */
export function userInterruptBid(dataset: AuctionDataset, amount: number): string | null {
  const state = useGameStore.getState().gameState
  if (!state) return 'No active game state'

  const userTeam = state.userFranchise as TeamId
  const bs = state.currentBidState
  if (bs?.teamsPassed.includes(userTeam)) {
    useGameStore.getState().clearTeamPassed(userTeam)
  }
  if ((bs?.permanentPass ?? []).includes(userTeam)) {
    useGameStore.getState().clearTeamPermanentPass(userTeam)
  }

  return userBid(dataset, amount)
}

/**
 * User passes this bid round — can re-enter when someone else raises the price.
 */
export function userPass(): string | null {
  const state = useGameStore.getState().gameState
  if (!state) return 'No active game state'
  if (state.phase !== 'bidding') return 'Not in bidding phase'
  useGameStore.getState().markTeamPassed(state.userFranchise as TeamId)
  return null
}

/**
 * User skips this player entirely — removed from bidding permanently.
 */
export function userSkipPlayer(): void {
  const state = useGameStore.getState().gameState
  if (!state || state.phase !== 'bidding') return
  useGameStore.getState().markTeamPermanentPass(state.userFranchise as TeamId)
}

/**
 * User exercises RTM. Returns error string or null.
 */
export function userExerciseRTM(dataset: AuctionDataset): string | null {
  const state = useGameStore.getState().gameState
  if (!state) return 'No active game state'

  const userTeam = state.userFranchise as TeamId
  const validation = validateRTM(state, dataset, userTeam)
  if (!validation.valid) return validation.reason

  const { setBidState, incrementRTMUsed } = useGameStore.getState()
  const bidState = state.currentBidState!
  setBidState({ ...bidState, rtmPending: null, currentLeader: userTeam })
  incrementRTMUsed(userTeam)
  confirmSale(dataset, userTeam, bidState.currentBid)
  return null
}

/**
 * User declines RTM opportunity.
 */
export function userDeclineRTM(dataset: AuctionDataset): void {
  const state = useGameStore.getState().gameState
  if (!state) return
  const bidState = state.currentBidState!
  const winningTeam = bidState.currentLeader!
  // RTM declined — proceed with original winning bid
  confirmSale(dataset, winningTeam, bidState.currentBid)
}

// ─────────────────────────────────────────────────────────────────────────────
// AI opponent round (called by the auction loop after each human action)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs one AI team's decision against the current fresh state.
 * Picks the next eligible team (not leader, not passed, not user) in shuffled order.
 * Returns 'bid' | 'pass' if a team acted, 'none' if no eligible teams remain.
 *
 * Call this in a loop from the UI to create sequential multi-team bidding.
 */
export async function runOneAIDecision(dataset: AuctionDataset): Promise<'bid' | 'pass' | 'none'> {
  const state = useGameStore.getState().gameState
  if (!state || state.phase !== 'bidding') return 'none'

  const bidState = state.currentBidState
  if (!bidState) return 'none'

  const currentPlayer = getCurrentAuctionPlayer(state, dataset)
  if (!currentPlayer) return 'none'

  const userTeam = state.userFranchise as TeamId

  const out = new Set([...bidState.teamsPassed, ...(bidState.permanentPass ?? [])])
  const eligible = (Object.keys(state.teamStates) as TeamId[]).filter(
    id => id !== userTeam && id !== bidState.currentLeader && !out.has(id),
  )
  if (eligible.length === 0) return 'none'

  const teamId = eligible[Math.floor(Math.random() * eligible.length)]
  const persona = ALL_PERSONAS[teamId]

  // Compute context helpers for persona layer
  const nextAvail    = getNextAvailablePlayers(state, dataset, currentPlayer.role)
  const teamPurses   = getAllTeamPurses(state)
  const startPurse   = getStartingPurse(state, dataset, teamId)
  const comparables  = getComparableSales(dataset, currentPlayer)

  const freshState    = useGameStore.getState().gameState!
  const freshBidState = freshState.currentBidState!

  // Get persona result — instant if cached, fallback if LLM still in-flight (never blocks)
  const personaResult = await Promise.resolve(getPersonaResultForTeam(
    teamId,
    currentPlayer,
    freshState.teamStates[teamId],
    freshBidState.currentBid,
    freshState.auctionYear,
    dataset.auctionSets[freshState.currentSetIndex] ?? 'Set 1',
    freshState.soldPlayers?.length ?? 0,
    nextAvail,
    teamPurses,
    startPurse,
    comparables,
    getFormContext(currentPlayer.playerId),
  ))

  // Only inject real LLM result into engine — fallback uses formula path
  const llmForEngine: LLMPersonaResult | null = personaResult.source === 'llm' ? personaResult : null
  const decision = runBiddingPipeline(freshState, dataset, teamId, currentPlayer, llmForEngine)

  if (decision.action === 'bid' && decision.bidAmount != null) {
    const recheck = validateBid(freshState, dataset, teamId, decision.bidAmount)
    if (recheck.valid) {
      useGameStore.getState().advanceBid(teamId, decision.bidAmount)
      useGameStore.getState().appendLog(`[${teamId}] ${personaResult.ownerComment}`)
      return 'bid'
    }
  }

  // Team would pass — check if they want to Fight or Fold (only if LLM gave us a ceiling)
  if (
    persona &&
    personaResult.source === 'llm' &&
    !personaResult.hasStretched &&
    freshBidState.currentLeader !== null
  ) {
    const nextBidAmount = freshBidState.currentBid > 0
      ? freshBidState.currentBid + getBidIncrement(dataset, freshBidState.currentBid)
      : currentPlayer.basePrice

    // Trigger fight-or-fold when next bid exceeds ceiling by less than a persona-scaled margin.
    // Aggressive teams (high maxBidMultiplier) tolerate a wider gap; conservative teams fold sooner.
    const fofMargin = (persona?.maxBidMultiplier ?? 1.8) * 2
    const nearCeiling = nextBidAmount > personaResult.personalCeiling &&
                        nextBidAmount - personaResult.personalCeiling <= fofMargin

    if (nearCeiling) {
      const activeBidders = (Object.keys(freshState.teamStates) as TeamId[])
        .filter(id => !out.has(id) && id !== freshBidState.currentLeader && id !== teamId)
        .map(id => ({ teamId: id, purse: freshState.teamStates[id]?.currentPurse ?? 0 }))

      const leader = {
        teamId: freshBidState.currentLeader,
        purse: freshState.teamStates[freshBidState.currentLeader]?.currentPurse ?? 0,
      }

      const teamSt = freshState.teamStates[teamId]
      const playersStillNeeded = Math.max(0, dataset.maximumSquadSize - (teamSt?.squad.length ?? 0))

      const fof = await getFightOrFoldDecision(
        persona, currentPlayer, personaResult,
        nextBidAmount, teamSt,
        activeBidders, leader,
        playersStillNeeded,
      )

      if (fof.stretch) {
        // Update ceiling in cache so it won't fight again
        personaResult.personalCeiling = fof.newCeiling
        personaResult.hasStretched    = true

        const recheck2 = validateBid(freshState, dataset, teamId, nextBidAmount)
        if (recheck2.valid) {
          useGameStore.getState().advanceBid(teamId, nextBidAmount)
          useGameStore.getState().appendLog(`[${teamId}] ${fof.ownerComment}`)
          return 'bid'
        }
      } else {
        useGameStore.getState().appendLog(`[${teamId}] ${fof.ownerComment}`)
      }
    }
  }

  useGameStore.getState().markTeamPassed(teamId)
  useGameStore.getState().appendLog(`[${teamId}] ${getFallbackComment(teamId, 'passing')}`)
  return 'pass'
}

/**
 * Checks if all active bidders (including user) have either passed or are the leader.
 * If true, the auction for this player is effectively over.
 */
export function isBiddingOver(_dataset: AuctionDataset): boolean {
  const state = useGameStore.getState().gameState
  if (!state || state.phase !== 'bidding') return true

  const bidState = state.currentBidState
  if (!bidState) return true

  // A team is "out" if passed this price round OR permanently skipped the player
  const out = new Set([...bidState.teamsPassed, ...(bidState.permanentPass ?? [])])
  const activeBidders = (Object.keys(state.teamStates) as TeamId[]).filter(
    id => id !== bidState.currentLeader && !out.has(id),
  )

  return activeBidders.length === 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Sale + RTM flow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called by the UI after the auctioneer's "going once/twice/thrice" countdown completes.
 * Hammer drops — confirms the sale to the current leader (or marks unsold if no bids).
 */
export function resolvePlayerSale(dataset: AuctionDataset): void {
  const state = useGameStore.getState().gameState
  if (!state) return

  const bidState = state.currentBidState
  if (!bidState || !bidState.currentLeader) {
    markPlayerUnsold(dataset)
    return
  }

  const winningTeam = bidState.currentLeader
  const salePrice = bidState.currentBid

  const saleCheck = validateSaleConfirmation(state, dataset, winningTeam, salePrice)
  if (!saleCheck.valid) {
    markPlayerUnsold(dataset)
    return
  }

  const currentPlayer = getCurrentAuctionPlayer(state, dataset)
  if (!currentPlayer) {
    // Indices misaligned — treat as unsold so auction can advance
    useGameStore.getState().setPhase('unsold-confirmed')
    return
  }

  const rtmTeam = findRTMEligibleTeam(state, dataset, currentPlayer, winningTeam)

  if (rtmTeam) {
    const isUserTeam = rtmTeam === state.userFranchise
    if (isUserTeam) {
      useGameStore.getState().setBidState({ ...bidState, rtmPending: rtmTeam })
      useGameStore.getState().setPhase('rtm-decision')
      return
    }
    const updatedState = useGameStore.getState().gameState!
    const rtmDecision = runRTMDecision(updatedState, dataset, rtmTeam, currentPlayer)
    const rtmPersona = ALL_PERSONAS[rtmTeam]
    if (rtmPersona) {
      // Fire async RTM persona for comment, but don't await — use static result from engine
      getRTMPersonaResult(rtmPersona.teamId as TeamId, rtmPersona, currentPlayer, updatedState.teamStates[rtmTeam], salePrice, updatedState.auctionYear)
        .then(p => useGameStore.getState().appendLog(`[${rtmTeam}] ${p.ownerComment}`))
        .catch(() => {})
    }
    if (rtmDecision.exercisesRTM) {
      useGameStore.getState().incrementRTMUsed(rtmTeam)
      confirmSale(dataset, rtmTeam, salePrice)
    } else {
      confirmSale(dataset, winningTeam, salePrice)
    }
  } else {
    confirmSale(dataset, winningTeam, salePrice)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function confirmSale(dataset: AuctionDataset, winningTeam: TeamId, salePrice: number): void {
  const state = useGameStore.getState().gameState
  if (!state) return

  const currentPlayer = getCurrentAuctionPlayer(state, dataset)
  if (!currentPlayer) {
    useGameStore.getState().setPhase('unsold-confirmed')
    return
  }

  const soldRecord: SoldPlayerRecord = {
    ...currentPlayer,
    soldPrice: salePrice,
    soldTo: winningTeam,
    isRetained: false,
  }

  const { recordSoldPlayer, applyPurchase, setPhase, appendLog } = useGameStore.getState()

  recordSoldPlayer(soldRecord)
  applyPurchase(winningTeam, soldRecord)
  clearPersonaCache(currentPlayer.playerId)

  const comment = getFallbackComment(winningTeam, 'sold_win')
  appendLog(`[${winningTeam}] SOLD: ${currentPlayer.name} for ₹${salePrice.toFixed(2)} Cr — ${comment}`)

  setPhase('sale-confirmed')
}

function markPlayerUnsold(dataset: AuctionDataset): void {
  const state = useGameStore.getState().gameState
  if (!state) return

  const currentPlayer = getCurrentAuctionPlayer(state, dataset)
  if (!currentPlayer) {
    useGameStore.getState().setPhase('unsold-confirmed')
    return
  }

  const unsoldRecord: UnsoldPlayerRecord = {
    ...currentPlayer,
    passedAt: Date.now(),
  }

  clearPersonaCache(currentPlayer.playerId)
  useGameStore.getState().recordUnsoldPlayer(unsoldRecord)
  useGameStore.getState().appendLog(`UNSOLD: ${currentPlayer.name}`)
  useGameStore.getState().setPhase('unsold-confirmed')
}

// ─────────────────────────────────────────────────────────────────────────────
// Set up a new player for auction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialises bid state for the current player and transitions to bidding phase.
 */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function startPlayerAuction(dataset: AuctionDataset): void {
  const state = useGameStore.getState().gameState
  if (!state) return

  // Generate a random order for the current set the first time we enter it (skip for re-auction)
  const setName = dataset.auctionSets[state.currentSetIndex]
  if (!state.isReauction && setName && !state.setPlayerOrder?.[setName]) {
    const playersInSet = getPlayersInSet(dataset, setName, state.releasedRetainedPlayers ?? [])
    const shuffledIds  = shuffleArray(playersInSet.map(p => p.playerId))
    useGameStore.setState(s => s.gameState ? {
      gameState: {
        ...s.gameState,
        setPlayerOrder: { ...(s.gameState.setPlayerOrder ?? {}), [setName]: shuffledIds },
      },
    } : {})
    console.log(`[AUCTION] Set "${setName}" shuffled: ${shuffledIds.length} players in random order`)
  }

  const currentPlayer = getCurrentAuctionPlayer(useGameStore.getState().gameState ?? state, dataset)
  if (!currentPlayer) {
    useGameStore.getState().setPhase('auction-complete')
    return
  }

  const freshBidState: BidState = {
    currentBid: 0,
    currentLeader: null,
    bids: [],
    teamsStillInterested: [],
    teamsPassed: [],
    permanentPass: [],
    rtmPending: null,
  }

  useGameStore.getState().setBidState(freshBidState)
  useGameStore.getState().setPhase('bidding')
  useGameStore.getState().appendLog(`--- Auction: ${currentPlayer.name} (Base: ₹${currentPlayer.basePrice.toFixed(2)} Cr) ---`)

  // Pre-load LLM for all non-user teams in the background (with full context)
  const userTeam        = state.userFranchise as TeamId
  const interestedTeams = (Object.keys(state.teamStates) as TeamId[]).filter(id => id !== userTeam)
  const nextAvail       = getNextAvailablePlayers(state, dataset, currentPlayer.role)
  const teamPurses      = getAllTeamPurses(state)
  const startingPurses  = Object.fromEntries(
    interestedTeams.map(id => [id, getStartingPurse(state, dataset, id)])
  )
  const comparables     = getComparableSales(dataset, currentPlayer)

  // Fire form context fetch in background — resolves well before first bid (2s timeout).
  // By the time runOneAIDecision runs, getFormContext() returns the cached result.
  void fetchPlayerFormContext(currentPlayer, state.auctionYear)

  preloadPersonaResults(
    currentPlayer,
    interestedTeams,
    state.teamStates,
    currentPlayer.basePrice,
    state.auctionYear,
    dataset.auctionSets[state.currentSetIndex] ?? 'Set 1',
    state.soldPlayers?.length ?? 0,
    nextAvail,
    teamPurses,
    startingPurses,
    comparables,
    getFormContext(currentPlayer.playerId),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Context helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Next 3 unsold players of the same role, ordered by auctionSetOrder. */
function getNextAvailablePlayers(
  state: NonNullable<ReturnType<typeof useGameStore.getState>['gameState']>,
  dataset: AuctionDataset,
  role: string,
  count = 3,
) {
  const soldIds   = new Set((state.soldPlayers ?? []).map(p => p.playerId))
  const unsoldIds = new Set((state.unsoldPlayers ?? []).map(p => p.playerId))
  const currentPlayer = getCurrentAuctionPlayer(state, dataset)

  return dataset.players
    .filter(p =>
      p.role === role &&
      !soldIds.has(p.playerId) &&
      !unsoldIds.has(p.playerId) &&
      p.playerId !== currentPlayer?.playerId,
    )
    .sort((a, b) => (a.auctionSetOrder ?? 999) - (b.auctionSetOrder ?? 999))
    .slice(0, count)
}

/** All teams' purses sorted descending. */
function getAllTeamPurses(
  state: NonNullable<ReturnType<typeof useGameStore.getState>['gameState']>,
): { teamId: string; purse: number }[] {
  return (Object.keys(state.teamStates) as TeamId[])
    .map(id => ({ teamId: id, purse: state.teamStates[id].currentPurse }))
    .sort((a, b) => b.purse - a.purse)
}

/** Starting purse for a team — from dataset.startingPurse if available. */
function getStartingPurse(
  state: NonNullable<ReturnType<typeof useGameStore.getState>['gameState']>,
  dataset: AuctionDataset,
  teamId: string,
): number {
  return dataset.startingPurse?.[teamId as TeamId] ?? state.teamStates[teamId as TeamId]?.currentPurse ?? 100
}

/**
 * Called after sale-confirmed or unsold-confirmed to move to the next player.
 */
export function advanceAuction(dataset: AuctionDataset): void {
  useGameStore.getState().advanceToNextPlayer(dataset)
}

/**
 * Validates the overall session state is healthy before auction starts.
 */
export function validateAndStart(_dataset: AuctionDataset): string | null {
  const state = useGameStore.getState().gameState
  if (!state) return 'No active game state'

  const check = validateSessionState(state)
  if (!check.valid) return check.reason

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Accelerated auction pool selection
// ─────────────────────────────────────────────────────────────────────────────

export const ACCELERATED_TOTAL = 40
export const USER_MAX_PICKS = 5

/**
 * Picks AI nominations for the accelerated auction.
 * Each team scores unsold players based on squad need + base price.
 * The top scorers across all teams fill the remaining slots.
 */
export function pickAIAcceleratedPlayers(
  dataset: AuctionDataset,
  userPickIds: string[],
): string[] {
  const state = useGameStore.getState().gameState
  if (!state) return []

  const userPickSet = new Set(userPickIds)
  const available = state.unsoldPlayers.filter(p => !userPickSet.has(p.playerId))
  const aiSlots = ACCELERATED_TOTAL - userPickIds.length

  if (available.length <= aiSlots) {
    return available.map(p => p.playerId)
  }

  const TARGET_AFTER_ACCEL = 20

  // Score every candidate for every AI team individually
  function scorePlayerForTeam(player: (typeof available)[number], ts: TeamState | undefined): number {
    if (!ts || ts.squad.length >= dataset.maximumSquadSize) return 0
    if (player.isOverseas && ts.overseasCount >= dataset.overseasLimit) return 0
    const roleCounts: Record<string, number> = { WK: 0, BAT: 0, AR: 0, BWL: 0 }
    for (const sq of ts.squad) roleCounts[sq.role] = (roleCounts[sq.role] ?? 0) + 1
    const roleGap = Math.max(0, 3 - (roleCounts[player.role] ?? 0))
    const affordScore = ts.currentPurse > player.basePrice * 2 ? 1 : 0.3
    const baseScore = Math.min(player.basePrice / 2, 1)
    return roleGap * 2 + baseScore + affordScore
  }

  const picked = new Set<string>()
  const result: string[] = []

  // Phase 1 — guaranteed minimum 2 per eligible AI team
  // Each team locks in their top 2 needed players before global competition begins
  for (const teamId of dataset.teams) {
    if (teamId === state.userFranchise) continue
    const ts = state.teamStates[teamId]
    if (!ts || ts.squad.length >= dataset.maximumSquadSize) continue

    const ranked = available
      .filter(p => !picked.has(p.playerId))
      .map(p => ({ id: p.playerId, score: scorePlayerForTeam(p, ts) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(2, TARGET_AFTER_ACCEL - ts.squad.length))

    for (const { id } of ranked) {
      if (result.length >= aiSlots) break
      picked.add(id)
      result.push(id)
    }
  }

  // Phase 2 — fill remaining slots with globally highest-scoring players
  const globalScores = available
    .filter(p => !picked.has(p.playerId))
    .map(p => {
      let total = 0
      for (const teamId of dataset.teams) {
        if (teamId === state.userFranchise) continue
        total += scorePlayerForTeam(p, state.teamStates[teamId])
      }
      return { id: p.playerId, score: total }
    })
    .sort((a, b) => b.score - a.score)

  for (const { id } of globalScores) {
    if (result.length >= aiSlots) break
    result.push(id)
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulation helpers (Issues 3 & 4) — formula-only, no LLM, no delays
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs one complete player auction using formula-only AI (no LLM, no delays).
 * All AI teams bid or pass based on the static pipeline. User team auto-passes.
 * Returns after the player is sold or marked unsold.
 */
function simulateOnePlayer(dataset: AuctionDataset): void {
  const state = useGameStore.getState().gameState
  if (!state || state.phase !== 'bidding') return

  const userTeam = state.userFranchise as TeamId

  // Auto-pass user so only AI bids
  useGameStore.getState().markTeamPermanentPass(userTeam)

  // Run bidding rounds until all AI teams have acted
  let maxRounds = 50 // safety limit
  while (maxRounds-- > 0) {
    const fresh = useGameStore.getState().gameState
    if (!fresh || fresh.phase !== 'bidding') break
    const bidState = fresh.currentBidState
    if (!bidState) break

    const currentPlayer = getCurrentAuctionPlayer(fresh, dataset)
    if (!currentPlayer) break

    const out = new Set([...bidState.teamsPassed, ...(bidState.permanentPass ?? [])])
    const eligible = (Object.keys(fresh.teamStates) as TeamId[]).filter(
      id => id !== userTeam && id !== bidState.currentLeader && !out.has(id),
    )
    if (eligible.length === 0) break

    const teamId = eligible[Math.floor(Math.random() * eligible.length)]
    const decision = runBiddingPipeline(fresh, dataset, teamId, currentPlayer, null)

    if (decision.action === 'bid' && decision.bidAmount != null) {
      const recheck = validateBid(fresh, dataset, teamId, decision.bidAmount)
      if (recheck.valid) {
        useGameStore.getState().advanceBid(teamId, decision.bidAmount)
        continue
      }
    }
    useGameStore.getState().markTeamPassed(teamId)
  }

  // Resolve sale
  resolvePlayerSale(dataset)
}

/**
 * Core simulation loop. Drives the state machine forward until `stopCondition` returns true.
 * Yields to the event loop between players so the UI can update a progress indicator.
 * `onProgress(soldCount, totalProcessed)` is called after each player resolves.
 */
async function simulateUntil(
  dataset: AuctionDataset,
  stopCondition: () => boolean,
  onProgress?: (processed: number) => void,
  shouldStop?: () => boolean,
): Promise<void> {
  let processed = 0

  while (!stopCondition()) {
    if (shouldStop?.()) break

    const state = useGameStore.getState().gameState
    if (!state) break

    const phase = state.phase

    if (phase === 'set-preview') {
      startPlayerAuction(dataset)
    } else if (phase === 'bidding') {
      simulateOnePlayer(dataset)
      processed++
      onProgress?.(processed)
      // Yield to React render cycle
      await new Promise(resolve => setTimeout(resolve, 0))
    } else if (phase === 'sale-confirmed' || phase === 'unsold-confirmed') {
      advanceAuction(dataset)
    } else if (phase === 'set-complete') {
      if (stopCondition()) break
      advanceAuction(dataset)
    } else if (phase === 'auction-complete') {
      break
    } else if (phase === 'rtm-decision') {
      // Auto-decline user RTM during simulation — no interaction possible
      const gs = useGameStore.getState().gameState
      if (gs?.currentBidState?.rtmPending === gs?.userFranchise) {
        userDeclineRTM(dataset)
      } else {
        // AI RTM is resolved synchronously elsewhere; if stuck here, advance
        advanceAuction(dataset)
      }
    } else {
      break
    }
  }
}

/**
 * Simulates all remaining players in the current set, then stops at set-complete.
 * Used by "Skip Rest of Set" button during bidding.
 */
export async function simulateRemainingSet(
  dataset: AuctionDataset,
  onProgress?: (processed: number) => void,
  shouldStop?: () => boolean,
): Promise<void> {
  const startState = useGameStore.getState().gameState
  if (!startState) return
  const startSetIndex = startState.currentSetIndex

  await simulateUntil(
    dataset,
    () => {
      const s = useGameStore.getState().gameState
      if (!s) return true
      return s.phase === 'set-complete' || s.phase === 'auction-complete' || s.currentSetIndex !== startSetIndex
    },
    onProgress,
    shouldStop,
  )
}

/**
 * Simulates an entire next set (from set-complete, through all players, to next set-complete).
 * Used by "Skip Next Set" button at set-complete screen.
 */
export async function simulateOneSet(
  dataset: AuctionDataset,
  onProgress?: (processed: number) => void,
  shouldStop?: () => boolean,
): Promise<void> {
  const startState = useGameStore.getState().gameState
  if (!startState) return
  const targetSetIndex = startState.currentSetIndex + 1

  // Advance past current set-complete first
  if (startState.phase === 'set-complete') {
    advanceAuction(dataset)
  }

  await simulateUntil(
    dataset,
    () => {
      const s = useGameStore.getState().gameState
      if (!s) return true
      return (
        s.phase === 'auction-complete' ||
        (s.phase === 'set-complete' && s.currentSetIndex >= targetSetIndex) ||
        s.currentSetIndex > targetSetIndex
      )
    },
    onProgress,
    shouldStop,
  )
}

/**
 * Simulates the entire remaining auction from any phase to auction-complete.
 * Used by "Simulate Rest of Auction" button.
 */
export async function simulateRemainingAuction(
  dataset: AuctionDataset,
  onProgress?: (processed: number) => void,
  shouldStop?: () => boolean,
): Promise<void> {
  await simulateUntil(
    dataset,
    () => {
      const s = useGameStore.getState().gameState
      return !s || s.phase === 'auction-complete'
    },
    onProgress,
    shouldStop,
  )
}
