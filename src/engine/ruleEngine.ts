/**
 * Rule Engine — pure, synchronous, stateless.
 * This is the final authority for all game rule validation.
 * It has zero dependencies on LLM, UI, or session modules.
 * Every function takes immutable inputs and returns a ValidationResult.
 */

import type { ValidationResult } from '@/types/validation'
import type { GameState } from '@/types/game'
import type { AuctionDataset } from '@/types/dataset'
import type { TeamId, TeamState } from '@/types/team'
import type { RetentionConfig } from '@/types/retention'
import type { TradeProposal } from '@/types/trade'
import { getBidIncrement, getPlayersInSet } from '@/dataset/datasetLoader'

// ─────────────────────────────────────────────────────────────────────────────
// Purse helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The minimum purse a team must keep in reserve to be able to fill their
 * remaining mandatory squad slots at the lowest base price (₹0.20 Cr).
 */
export function getMinReservedPurse(
  teamState: TeamState,
  dataset: AuctionDataset,
): number {
  const MIN_BASE_PRICE = 0.20
  const currentSize = teamState.squad.length
  const slotsNeeded = Math.max(0, dataset.minimumSquadSize - currentSize)
  return slotsNeeded * MIN_BASE_PRICE
}

/**
 * Maximum a team can safely bid without risking being unable to complete their squad.
 *
 * Reserve rules (applied as a floor — whichever is highest wins):
 *   1. Marquee sets:       hold ₹30 Cr in reserve
 *   2. Squad under 12:     hold ₹20 Cr in reserve
 *   3. Always:             hold slotsNeeded × ₹0.20 Cr (min squad completion reserve)
 */
export function getSafeBidLimit(
  teamState: TeamState,
  dataset: AuctionDataset,
  currentSetName?: string,
  currentSetIndex?: number,
): number {
  const minSquadReserve = getMinReservedPurse(teamState, dataset)

  const isMarquee = currentSetName?.toLowerCase().includes('marquee') ?? false
  const marqueeReserve = isMarquee ? 30 : 0

  const squadSize = teamState.squad.length
  const earlySquadReserve = squadSize < 12 ? 20 : 0

  // Suppress unused param warning — kept for API compatibility
  void currentSetIndex

  const totalReserved = Math.max(minSquadReserve, marqueeReserve, earlySquadReserve)
  return Math.max(0, teamState.currentPurse - totalReserved)
}

// ─────────────────────────────────────────────────────────────────────────────
// Bid validation
// ─────────────────────────────────────────────────────────────────────────────

export function validateBid(
  state: GameState,
  dataset: AuctionDataset,
  teamId: TeamId,
  bidAmount: number,
): ValidationResult {
  const teamState = state.teamStates[teamId]
  if (!teamState) return { valid: false, reason: `Team ${teamId} not found in game state` }

  // Must be in bidding phase
  if (state.phase !== 'bidding') {
    return { valid: false, reason: 'No active bidding in current phase' }
  }

  const bidState = state.currentBidState
  if (!bidState) return { valid: false, reason: 'No active bid state' }

  // Cannot bid if already passed this round
  if (bidState.teamsPassed.includes(teamId)) {
    return { valid: false, reason: `${teamId} has already passed on this player` }
  }

  // Cannot re-bid if already leading (unless bidding against self after RTM)
  if (bidState.currentLeader === teamId && !bidState.rtmPending) {
    return { valid: false, reason: `${teamId} is already the leading bidder` }
  }

  // Bid must be >= current bid + increment
  const increment = getBidIncrement(dataset, bidState.currentBid)
  const minimumBid = bidState.currentBid === 0
    ? getBasePrice(state, dataset)
    : bidState.currentBid + increment

  if (bidAmount < minimumBid) {
    return {
      valid: false,
      reason: `Minimum bid is ₹${minimumBid.toFixed(2)} Cr (current: ₹${bidState.currentBid.toFixed(2)} Cr + increment: ₹${increment.toFixed(2)} Cr)`,
    }
  }

  // Team must have enough purse
  if (teamState.currentPurse < bidAmount) {
    return {
      valid: false,
      reason: `${teamId} has only ₹${teamState.currentPurse.toFixed(2)} Cr remaining`,
    }
  }

  // Bidding must not take purse below safe limit (reserved for minimum squad)
  const reserved = getMinReservedPurse(teamState, dataset)
  if (teamState.currentPurse - bidAmount < reserved) {
    return {
      valid: false,
      reason: `${teamId} must keep ₹${reserved.toFixed(2)} Cr in reserve to complete minimum squad`,
    }
  }

  // Squad must have room for one more player
  if (teamState.squad.length >= dataset.maximumSquadSize) {
    return {
      valid: false,
      reason: `${teamId} squad is full (${dataset.maximumSquadSize} players)`,
    }
  }

  // If player is overseas, team must have an overseas slot
  const currentPlayer = getCurrentPlayer(state, dataset)
  if (currentPlayer?.isOverseas) {
    if (teamState.overseasCount >= dataset.overseasLimit) {
      return {
        valid: false,
        reason: `${teamId} has reached the overseas player limit (${dataset.overseasLimit})`,
      }
    }
  }

  return { valid: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// RTM validation
// ─────────────────────────────────────────────────────────────────────────────

export function validateRTM(
  state: GameState,
  dataset: AuctionDataset,
  teamId: TeamId,
): ValidationResult {
  if (!dataset.rtmAvailable) {
    return { valid: false, reason: 'RTM is not available in this auction year' }
  }

  const teamState = state.teamStates[teamId]
  if (!teamState) return { valid: false, reason: `Team ${teamId} not found` }

  if (teamState.rtmSlotsAvailable <= teamState.rtmSlotsUsed) {
    return { valid: false, reason: `${teamId} has no RTM slots remaining` }
  }

  if (state.phase !== 'rtm-decision') {
    return { valid: false, reason: 'Not in RTM decision phase' }
  }

  const bidState = state.currentBidState
  if (!bidState || bidState.rtmPending !== teamId) {
    return { valid: false, reason: `${teamId} does not have an active RTM opportunity` }
  }

  const currentPlayer = getCurrentPlayer(state, dataset)
  if (!currentPlayer) return { valid: false, reason: 'No current player in auction' }

  if (currentPlayer.rtmEligibleFor !== teamId) {
    return { valid: false, reason: `${teamId} is not eligible to RTM this player` }
  }

  // RTM price = current winning bid. Must have purse + squad slot
  const rtmPrice = bidState.currentBid
  if (teamState.currentPurse < rtmPrice) {
    return { valid: false, reason: `${teamId} cannot afford the RTM price of ₹${rtmPrice.toFixed(2)} Cr` }
  }

  if (teamState.squad.length >= dataset.maximumSquadSize) {
    return { valid: false, reason: `${teamId} squad is full` }
  }

  if (currentPlayer.isOverseas && teamState.overseasCount >= dataset.overseasLimit) {
    return { valid: false, reason: `${teamId} has no overseas slots for RTM` }
  }

  return { valid: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sale confirmation
// ─────────────────────────────────────────────────────────────────────────────

export function validateSaleConfirmation(
  state: GameState,
  dataset: AuctionDataset,
  winningTeam: TeamId,
  salePrice: number,
): ValidationResult {
  const teamState = state.teamStates[winningTeam]
  if (!teamState) return { valid: false, reason: `Team ${winningTeam} not found` }

  if (teamState.currentPurse < salePrice) {
    return { valid: false, reason: `${winningTeam} cannot afford ₹${salePrice.toFixed(2)} Cr` }
  }

  if (teamState.squad.length >= dataset.maximumSquadSize) {
    return { valid: false, reason: `${winningTeam} squad is full` }
  }

  const currentPlayer = getCurrentPlayer(state, dataset)
  if (currentPlayer?.isOverseas && teamState.overseasCount >= dataset.overseasLimit) {
    return { valid: false, reason: `${winningTeam} has no overseas slots` }
  }

  return { valid: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Retention validation
// ─────────────────────────────────────────────────────────────────────────────

export function validateRetention(
  dataset: AuctionDataset,
  teamId: TeamId,
  config: RetentionConfig,
): ValidationResult {
  if (!dataset.retentionAllowed) {
    return { valid: false, reason: 'Retention is not allowed in this auction year' }
  }

  if (config.retainedPlayers.length > dataset.maxRetainedPlayers) {
    return {
      valid: false,
      reason: `Maximum ${dataset.maxRetainedPlayers} players can be retained. You have ${config.retainedPlayers.length}.`,
    }
  }

  const overseasRetained = config.retainedPlayers.filter(rp => {
    const player = dataset.players.find(p => p.playerId === rp.playerId)
    return player?.isOverseas === true
  })

  if (overseasRetained.length > dataset.maxOverseasRetained) {
    return {
      valid: false,
      reason: `Maximum ${dataset.maxOverseasRetained} overseas players can be retained. You have ${overseasRetained.length}.`,
    }
  }

  for (const rp of config.retainedPlayers) {
    const player = dataset.players.find(p => p.playerId === rp.playerId)
    if (!player) {
      return {
        valid: false,
        reason: `Player ${rp.playerId} not found in dataset. Cannot retain a player not in the auction pool.`,
      }
    }
    if (rp.retentionPrice < 0) {
      return { valid: false, reason: `Retention price for ${player.name} cannot be negative` }
    }
  }

  const totalDeduction = config.retainedPlayers.reduce((sum, rp) => sum + rp.retentionPrice, 0)
  const startingPurse = dataset.startingPurse[teamId]
  if (totalDeduction > startingPurse) {
    return {
      valid: false,
      reason: `Total retention cost (₹${totalDeduction.toFixed(2)} Cr) exceeds starting purse (₹${startingPurse.toFixed(2)} Cr)`,
    }
  }

  return { valid: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade validation
// ─────────────────────────────────────────────────────────────────────────────

export function validateTrade(
  state: GameState,
  dataset: AuctionDataset,
  proposal: TradeProposal,
): ValidationResult {
  const [legA, legB] = proposal.legs

  // Both teams must exist
  for (const leg of [legA, legB]) {
    if (!state.teamStates[leg.teamId]) {
      return { valid: false, reason: `Team ${leg.teamId} not found` }
    }
  }

  // Trade window must be active
  if (state.phase !== 'trade-window') {
    return { valid: false, reason: 'Trade window is not open' }
  }

  // Each team must own the players they are giving up
  for (const leg of [legA, legB]) {
    const teamState = state.teamStates[leg.teamId]
    for (const playerId of leg.playerIds) {
      const owns = teamState.squad.some(p => p.playerId === playerId)
      if (!owns) {
        return { valid: false, reason: `${leg.teamId} does not own player ${playerId}` }
      }
    }
    if (leg.cashAmount < 0) {
      return { valid: false, reason: `Cash amount cannot be negative` }
    }
  }

  // Simulate post-trade squad sizes
  for (const [giving, receiving] of [[legA, legB], [legB, legA]] as const) {
    const teamState = state.teamStates[giving.teamId]
    const newSize = teamState.squad.length - giving.playerIds.length + receiving.playerIds.length
    if (newSize < 0) {
      return { valid: false, reason: `${giving.teamId} cannot give up more players than they have` }
    }
    if (newSize > dataset.maximumSquadSize) {
      return { valid: false, reason: `${giving.teamId} would exceed maximum squad size after trade` }
    }
  }

  // Simulate post-trade overseas counts
  for (const [giving, receiving] of [[legA, legB], [legB, legA]] as const) {
    const teamState = state.teamStates[giving.teamId]
    const givingOverseas = giving.playerIds.filter(id =>
      teamState.squad.find(p => p.playerId === id)?.isOverseas
    ).length
    const receivingOverseas = receiving.playerIds.filter(id => {
      const otherTeamState = state.teamStates[receiving.teamId]
      return otherTeamState.squad.find(p => p.playerId === id)?.isOverseas
    }).length
    const newOverseas = teamState.overseasCount - givingOverseas + receivingOverseas
    if (newOverseas > dataset.overseasLimit) {
      return {
        valid: false,
        reason: `${giving.teamId} would exceed overseas limit (${dataset.overseasLimit}) after trade`,
      }
    }
  }

  // Purse check: team giving cash must have enough
  for (const leg of [legA, legB]) {
    if (leg.cashAmount > 0) {
      const teamState = state.teamStates[leg.teamId]
      if (teamState.currentPurse < leg.cashAmount) {
        return { valid: false, reason: `${leg.teamId} does not have ₹${leg.cashAmount.toFixed(2)} Cr to give in trade` }
      }
    }
  }

  return { valid: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session state validation
// ─────────────────────────────────────────────────────────────────────────────

export function validateSessionState(state: GameState): ValidationResult {
  if (!state.sessionId) return { valid: false, reason: 'Session has no ID' }
  if (!state.userFranchise) return { valid: false, reason: 'No user franchise set' }
  if (!state.teamStates) return { valid: false, reason: 'Team states missing' }
  for (const teamId of Object.keys(state.teamStates) as TeamId[]) {
    const ts = state.teamStates[teamId]
    if (ts.currentPurse < 0) {
      return { valid: false, reason: `${teamId} has negative purse — corrupted state` }
    }
    if (ts.overseasCount < 0) {
      return { valid: false, reason: `${teamId} has negative overseas count — corrupted state` }
    }
  }
  return { valid: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getCurrentPlayer(state: GameState, dataset: AuctionDataset) {
  // Re-auction uses a separate pool
  if (state.isReauction) {
    return state.reauctionPool?.[state.reauctionIndex] ?? null
  }

  const setName = dataset.auctionSets[state.currentSetIndex]
  if (!setName) return null
  const players = getPlayersInSet(dataset, setName, state.releasedRetainedPlayers ?? [])

  // Sets are shuffled — resolve actual player via setPlayerOrder, same as biddingEngine
  const shuffledIds = state.setPlayerOrder?.[setName]
  if (shuffledIds) {
    const playerId = shuffledIds[state.currentPlayerIndex]
    return players.find(p => p.playerId === playerId) ?? null
  }

  return players[state.currentPlayerIndex] ?? null
}

function getBasePrice(state: GameState, dataset: AuctionDataset): number {
  const player = getCurrentPlayer(state, dataset)
  return player?.basePrice ?? 0.20
}
