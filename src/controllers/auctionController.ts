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
import type { TeamId } from '@/types/team'
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

export const ACCELERATED_TOTAL = 30
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

  // Score each candidate across all AI teams weighted by squad need
  const scores = new Map<string, number>()
  for (const player of available) {
    let total = 0
    for (const teamId of dataset.teams) {
      if (teamId === state.userFranchise) continue
      const ts = state.teamStates[teamId]
      if (!ts) continue
      if (ts.squad.length >= dataset.maximumSquadSize) continue
      if (player.isOverseas && ts.overseasCount >= dataset.overseasLimit) continue

      const roleCounts: Record<string, number> = { WK: 0, BAT: 0, AR: 0, BWL: 0 }
      for (const sq of ts.squad) roleCounts[sq.role] = (roleCounts[sq.role] ?? 0) + 1

      const roleGap = Math.max(0, 3 - (roleCounts[player.role] ?? 0))
      const affordScore = ts.currentPurse > player.basePrice * 2 ? 1 : 0.3
      const baseScore = Math.min(player.basePrice / 2, 1)

      total += roleGap * 2 + baseScore + affordScore
    }
    scores.set(player.playerId, total)
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, aiSlots)
    .map(([id]) => id)
}
