import type { TeamId } from './team'
import type { TeamState } from './team'
import type { PlayerRecord, SoldPlayerRecord, UnsoldPlayerRecord, BidEntry } from './player'
import type { RetentionMode, RetentionConfig } from './retention'
import type { TradeRecord } from './trade'
import type { SeasonSetup, SeasonResult } from './season'

export type AuctionType = 'mega' | 'mini'

export type Difficulty = 'easy' | 'normal' | 'hard'

export type AuctionPhase =
  | 'setup'
  | 'retention'
  | 'trade-window'
  | 'set-preview'
  | 'bidding'
  | 'rtm-decision'
  | 'sale-confirmed'
  | 'unsold-confirmed'
  | 'set-complete'
  | 'auction-complete'
  | 'season-setup'
  | 'season-simulation'
  | 'season-complete'

/** Live bid state for the player currently being auctioned */
export interface BidState {
  currentBid: number
  currentLeader: TeamId | null
  bids: BidEntry[]
  teamsStillInterested: TeamId[]
  teamsPassed: TeamId[]
  rtmPending: TeamId | null    // team that has RTM option open
}

/** A single entry in the auction history log */
export interface AuctionHistoryEntry {
  type: 'sold' | 'unsold' | 'rtm-used' | 'rtm-declined'
  playerId: string
  playerName: string
  setName: string
  teamId: string | null
  amount: number | null
  timestamp: number
}

/** Complete game state — serialised to JSONB in Supabase */
export interface GameState {
  // ── Identity ───────────────────────────────────────────────────────────────
  sessionId: string
  auctionYear: number
  auctionType: AuctionType
  userFranchise: TeamId
  difficulty: Difficulty
  retentionMode: RetentionMode

  // ── Pre-auction ────────────────────────────────────────────────────────────
  retentionConfigs: Record<TeamId, RetentionConfig>
  tradeHistory: TradeRecord[]

  // ── Auction progress ───────────────────────────────────────────────────────
  phase: AuctionPhase
  currentSetIndex: number          // 0-based index into dataset.auctionSets
  currentPlayerIndex: number       // 0-based index within current set
  currentBidState: BidState | null

  // ── Results ────────────────────────────────────────────────────────────────
  soldPlayers: SoldPlayerRecord[]
  unsoldPlayers: UnsoldPlayerRecord[]
  teamStates: Record<TeamId, TeamState>
  auctionHistory: AuctionHistoryEntry[]

  // ── Derived helpers (recomputed on load, stored for perf) ─────────────────
  remainingPlayers: PlayerRecord[]    // players not yet auctioned

  // ── Season ────────────────────────────────────────────────────────────────
  seasonSetup: SeasonSetup | null
  seasonResult: SeasonResult | null
}
