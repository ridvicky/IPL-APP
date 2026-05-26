/**
 * Game Store — Zustand store for active auction state.
 * This is the single source of truth during an auction.
 * Every state mutation goes through here and triggers an auto-save.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameState, AuctionPhase, BidState } from '@/types/game'
import type { TeamId, TeamState } from '@/types/team'
import type { SoldPlayerRecord, UnsoldPlayerRecord } from '@/types/player'
import type { GameSession } from '@/types/session'
import { saveSession } from '@/session/sessionManager'
import { useSessionStore } from './sessionStore'

interface GameStoreState {
  // Active state
  gameState: GameState | null
  activeSession: GameSession | null
  saving: boolean
  error: string | null

  // Initialise from a loaded session
  initFromSession: (session: GameSession) => void

  // Phase transitions
  setPhase: (phase: AuctionPhase) => void

  // Bidding
  setBidState: (bidState: BidState | null) => void
  advanceBid: (teamId: TeamId, amount: number) => void
  markTeamPassed: (teamId: TeamId) => void
  clearTeamPassed: (teamId: TeamId) => void
  markTeamPermanentPass: (teamId: TeamId) => void
  clearTeamPermanentPass: (teamId: TeamId) => void

  // Player outcomes
  recordSoldPlayer: (record: SoldPlayerRecord) => void
  recordUnsoldPlayer: (record: UnsoldPlayerRecord) => void

  // Squad/purse mutations (applied after sale/RTM confirmed)
  applyPurchase: (teamId: TeamId, soldRecord: SoldPlayerRecord) => void
  incrementRTMUsed: (teamId: TeamId) => void

  // Auction navigation
  advanceToNextPlayer: (dataset: { auctionSets: string[]; players: { auctionSet: string }[] }) => void
  startAcceleratedSelection: () => void
  startReauction: (pool?: import('@/types/player').PlayerRecord[]) => void

  // Team state direct update (used by retention engine on init)
  setAllTeamStates: (teamStates: Record<TeamId, TeamState>) => void

  // Trade
  recordTrade: (record: import('@/types/trade').TradeRecord) => void

  // Season
  setSeasonSetup: (setup: import('@/types/season').SeasonSetup) => void
  setSeasonResult: (result: import('@/types/season').SeasonResult) => void

  // Retention editing — called from RetentionSetupScreen before auction starts
  applyRetentionEdits: (teamStates: Record<TeamId, TeamState>, releasedPlayers: import('@/types/player').PlayerRecord[]) => void

  // Logging
  appendLog: (entry: string) => void

  // Save
  saveNow: () => Promise<void>

  // Reset
  reset: () => void
}

export const useGameStore = create<GameStoreState>()(persist((set, get) => ({
  gameState: null,
  activeSession: null,
  saving: false,
  error: null,

  initFromSession: (session) => {
    const state = session.state
    // Back-fill fields added after initial release so old saves don't crash
    if (!state.acceleratedPicks) state.acceleratedPicks = []
    // If killed mid-bid, reset to set-preview so the player gets a clean restart
    // rather than resuming a half-finished bid round with no running timers
    if (state.phase === 'bidding') {
      state.phase = 'set-preview'
      state.currentBidState = null
    }
    set({ gameState: state, activeSession: session, error: null })
  },

  setPhase: (phase) => {
    set(s => s.gameState ? { gameState: { ...s.gameState, phase } } : {})
    void get().saveNow()
  },

  setBidState: (bidState) => {
    set(s => s.gameState ? { gameState: { ...s.gameState, currentBidState: bidState } } : {})
  },

  advanceBid: (teamId, amount) => {
    set(s => {
      if (!s.gameState?.currentBidState) return {}
      const bs = s.gameState.currentBidState
      return {
        gameState: {
          ...s.gameState,
          currentBidState: {
            ...bs,
            currentBid: amount,
            currentLeader: teamId,
            teamsPassed: [],                        // reset per-price-round on each new bid
            permanentPass: bs.permanentPass ?? [],  // preserve skipped teams
            bids: [...bs.bids, { teamId, amount, timestamp: Date.now() }],
          },
        },
      }
    })
  },

  markTeamPassed: (teamId) => {
    set(s => {
      if (!s.gameState?.currentBidState) return {}
      const bs = s.gameState.currentBidState
      if (bs.teamsPassed.includes(teamId)) return {}
      return {
        gameState: {
          ...s.gameState,
          currentBidState: { ...bs, teamsPassed: [...bs.teamsPassed, teamId] },
        },
      }
    })
  },

  clearTeamPassed: (teamId) => {
    set(s => {
      if (!s.gameState?.currentBidState) return {}
      const bs = s.gameState.currentBidState
      if (!bs.teamsPassed.includes(teamId)) return {}
      return {
        gameState: {
          ...s.gameState,
          currentBidState: { ...bs, teamsPassed: bs.teamsPassed.filter(id => id !== teamId) },
        },
      }
    })
  },

  markTeamPermanentPass: (teamId) => {
    set(s => {
      if (!s.gameState?.currentBidState) return {}
      const bs = s.gameState.currentBidState
      const pp = bs.permanentPass ?? []
      if (pp.includes(teamId)) return {}
      return {
        gameState: {
          ...s.gameState,
          currentBidState: {
            ...bs,
            permanentPass: [...pp, teamId],
            teamsPassed: (bs.teamsPassed ?? []).includes(teamId)
              ? (bs.teamsPassed ?? [])
              : [...(bs.teamsPassed ?? []), teamId],
          },
        },
      }
    })
  },

  clearTeamPermanentPass: (teamId) => {
    set(s => {
      if (!s.gameState?.currentBidState) return {}
      const bs = s.gameState.currentBidState
      const pp = bs.permanentPass ?? []
      if (!pp.includes(teamId)) return {}
      return {
        gameState: {
          ...s.gameState,
          currentBidState: {
            ...bs,
            permanentPass: pp.filter(id => id !== teamId),
            teamsPassed: (bs.teamsPassed ?? []).filter(id => id !== teamId),
          },
        },
      }
    })
  },

  recordSoldPlayer: (record) => {
    set(s => s.gameState ? {
      gameState: {
        ...s.gameState,
        soldPlayers: [...s.gameState.soldPlayers, record],
      },
    } : {})
    void get().saveNow()
  },

  recordUnsoldPlayer: (record) => {
    set(s => s.gameState ? {
      gameState: {
        ...s.gameState,
        unsoldPlayers: [...s.gameState.unsoldPlayers, record],
      },
    } : {})
    void get().saveNow()
  },

  applyPurchase: (teamId, soldRecord) => {
    set(s => {
      if (!s.gameState) return {}
      const ts = s.gameState.teamStates[teamId]
      if (!ts) return {}
      const updatedTs: TeamState = {
        ...ts,
        currentPurse: ts.currentPurse - soldRecord.soldPrice,
        squad: [...ts.squad, soldRecord],
        overseasCount: soldRecord.isOverseas ? ts.overseasCount + 1 : ts.overseasCount,
      }
      return {
        gameState: {
          ...s.gameState,
          teamStates: { ...s.gameState.teamStates, [teamId]: updatedTs },
        },
      }
    })
  },

  incrementRTMUsed: (teamId) => {
    set(s => {
      if (!s.gameState) return {}
      const ts = s.gameState.teamStates[teamId]
      if (!ts) return {}
      return {
        gameState: {
          ...s.gameState,
          teamStates: {
            ...s.gameState.teamStates,
            [teamId]: { ...ts, rtmSlotsUsed: ts.rtmSlotsUsed + 1 },
          },
        },
      }
    })
  },

  advanceToNextPlayer: (dataset) => {
    set(s => {
      if (!s.gameState) return {}

      // Re-auction path
      if (s.gameState.isReauction) {
        const nextIdx = s.gameState.reauctionIndex + 1
        if (nextIdx >= (s.gameState.reauctionPool?.length ?? 0)) {
          return { gameState: { ...s.gameState, phase: 'auction-complete', currentBidState: null, isReauction: false } }
        }
        return { gameState: { ...s.gameState, reauctionIndex: nextIdx, phase: 'set-preview', currentBidState: null } }
      }

      const { currentSetIndex, currentPlayerIndex } = s.gameState
      const setName = dataset.auctionSets[currentSetIndex]
      if (!setName) return {}

      const shuffledIds = s.gameState.setPlayerOrder?.[setName]
      const setLength = shuffledIds
        ? shuffledIds.length
        : [
            ...dataset.players.filter(p => p.auctionSet === setName),
            ...(s.gameState.releasedRetainedPlayers ?? []).filter(p => p.auctionSet === setName),
          ].length

      const isLastInSet = currentPlayerIndex >= setLength - 1
      const isLastSet   = currentSetIndex >= dataset.auctionSets.length - 1

      if (isLastInSet && isLastSet) {
        return { gameState: { ...s.gameState, phase: 'auction-complete', currentBidState: null } }
      }

      if (isLastInSet) {
        return {
          gameState: {
            ...s.gameState,
            currentSetIndex: currentSetIndex + 1,
            currentPlayerIndex: 0,
            phase: 'set-complete',
            currentBidState: null,
          },
        }
      }

      return {
        gameState: {
          ...s.gameState,
          currentPlayerIndex: currentPlayerIndex + 1,
          phase: 'set-preview',
          currentBidState: null,
        },
      }
    })
    void get().saveNow()
  },

  startAcceleratedSelection: () => {
    set(s => s.gameState
      ? { gameState: { ...s.gameState, phase: 'accelerated-selection', acceleratedPicks: [] } }
      : {})
    void get().saveNow()
  },

  startReauction: (pool) => {
    set(s => {
      if (!s.gameState) return {}
      const source = pool ?? s.gameState.unsoldPlayers
      const reauctionPool = source.map(p => ({
        ...p,
        basePrice: Math.max(0.2, Math.round(p.basePrice * 0.5 * 4) / 4),
      }))
      return {
        gameState: {
          ...s.gameState,
          isReauction: true,
          reauctionPool,
          reauctionIndex: 0,
          unsoldPlayers: [],
          phase: 'set-preview',
          currentBidState: null,
        },
      }
    })
    void get().saveNow()
  },

  setAllTeamStates: (teamStates) => {
    set(s => s.gameState ? { gameState: { ...s.gameState, teamStates } } : {})
  },

  recordTrade: (record) => {
    set(s => s.gameState ? {
      gameState: {
        ...s.gameState,
        tradeHistory: [...s.gameState.tradeHistory, record],
      },
    } : {})
    void get().saveNow()
  },

  setSeasonSetup: (setup) => {
    set(s => s.gameState ? { gameState: { ...s.gameState, seasonSetup: setup } } : {})
    void get().saveNow()
  },

  setSeasonResult: (result) => {
    set(s => s.gameState ? {
      gameState: { ...s.gameState, seasonResult: result, phase: 'season-complete' },
    } : {})
    void get().saveNow()
  },

  applyRetentionEdits: (teamStates, releasedPlayers) => {
    set(s => s.gameState ? {
      gameState: { ...s.gameState, teamStates, releasedRetainedPlayers: releasedPlayers },
    } : {})
    void get().saveNow()
  },

  appendLog: (entry) => {
    set(s => s.gameState ? {
      gameState: {
        ...s.gameState,
        auctionLog: [...s.gameState.auctionLog, entry],
      },
    } : {})
  },

  saveNow: async () => {
    const { gameState, activeSession } = get()
    if (!gameState || !activeSession) return
    set({ saving: true })
    try {
      const updated = await saveSession(activeSession, gameState)
      useSessionStore.getState().setActiveSession(updated)
      set({ activeSession: updated, saving: false })
    } catch (err) {
      set({ saving: false, error: String(err) })
    }
  },

  reset: () => {
    set({ gameState: null, activeSession: null, saving: false, error: null })
  },
}), {
  name: 'ipl-game-store',
  partialize: (s) => ({ gameState: s.gameState, activeSession: s.activeSession }),
}))
