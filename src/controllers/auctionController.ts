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
import { runBiddingPipeline, getCurrentAuctionPlayer } from '@/engine/biddingEngine'
import { runRTMDecision, findRTMEligibleTeam } from '@/engine/rtmEngine'
import { useGameStore } from '@/store/gameStore'
import { getFallbackComment } from '@/llm/fallbackBank'
import {
  getPersonaResultForTeam,
  getRTMPersonaResult,
  preloadPersonaResults,
  clearPersonaCache,
} from '@/llm/personaLayer'
import { ALL_PERSONAS } from '@/personas'

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

  // Mark RTM as used, set user as new leader at current bid price
  const { setBidState } = useGameStore.getState()
  const bidState = state.currentBidState!
  setBidState({ ...bidState, rtmPending: null, currentLeader: userTeam })
  // RTM exercised — confirm sale immediately (RTM means winning at that price)
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

  // Eligible: not the user, not passed this round, not permanently skipped, not the current leader
  const out = new Set([...bidState.teamsPassed, ...(bidState.permanentPass ?? [])])
  const eligible = (Object.keys(state.teamStates) as TeamId[]).filter(
    id => id !== userTeam && id !== bidState.currentLeader && !out.has(id),
  )

  if (eligible.length === 0) return 'none'

  // Pick one team at random from eligible teams
  const teamId = eligible[Math.floor(Math.random() * eligible.length)]

  // Always use fresh state for the decision
  const freshState = useGameStore.getState().gameState!
  const freshBidState = freshState.currentBidState!

  // Get persona result — instant if cached, fallback if LLM still in-flight
  const persona = await Promise.resolve(getPersonaResultForTeam(
    teamId,
    currentPlayer,
    freshState.teamStates[teamId],
    freshBidState.currentBid,
    freshState.auctionYear,
    dataset.auctionSets[freshState.currentSetIndex] ?? 'Set 1',
    freshState.soldPlayers?.length ?? 0,
  ))

  // Only pass LLM result to bidding engine when it's a real LLM response, not a static fallback.
  // Fallback suggestedMaxBid is just a rough estimate — the engine's own formula is more accurate.
  const decision = runBiddingPipeline(freshState, dataset, teamId, currentPlayer, persona.source === 'llm' ? persona : null)

  if (decision.action === 'bid' && decision.bidAmount != null) {
    const recheck = validateBid(freshState, dataset, teamId, decision.bidAmount)
    if (recheck.valid) {
      useGameStore.getState().advanceBid(teamId, decision.bidAmount)
      useGameStore.getState().appendLog(`[${teamId}] ${persona.ownerComment}`)
      return 'bid'
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
export function startPlayerAuction(dataset: AuctionDataset): void {
  const state = useGameStore.getState().gameState
  if (!state) return

  const currentPlayer = getCurrentAuctionPlayer(state, dataset)
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

  // Pre-load LLM for all non-user teams in the background
  const userTeam = state.userFranchise as TeamId
  const interestedTeams = (Object.keys(state.teamStates) as TeamId[]).filter(id => id !== userTeam)
  preloadPersonaResults(
    currentPlayer,
    interestedTeams,
    state.teamStates,
    currentPlayer.basePrice,
    state.auctionYear,
    dataset.auctionSets[state.currentSetIndex] ?? 'Set 1',
    state.soldPlayers?.length ?? 0,
  )
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
