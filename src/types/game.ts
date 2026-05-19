import type { TeamId, TeamState } from './team'
import type { PlayerRecord, SoldPlayerRecord, UnsoldPlayerRecord, BidEntry } from './player'
import type { TradeRecord } from './trade'
import type { SeasonSetup, SeasonResult } from './season'

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
  teamsPassed: TeamId[]      // passed at current price — reset on each new bid
  permanentPass: TeamId[]    // skipped player entirely — never reset
  rtmPending: TeamId | null
}

/** Complete game state — serialised to JSONB in Supabase */
export interface GameState {
  sessionId: string
  userFranchise: TeamId
  auctionYear: number
  phase: AuctionPhase
  currentSetIndex: number
  currentPlayerIndex: number
  currentBidState: BidState | null
  teamStates: Record<TeamId, TeamState>
  soldPlayers: SoldPlayerRecord[]
  unsoldPlayers: UnsoldPlayerRecord[]
  releasedRetainedPlayers: PlayerRecord[]   // retained players the user chose to release back to auction
  tradeHistory: TradeRecord[]
  auctionLog: string[]
  seasonSetup: SeasonSetup | null
  seasonResult: SeasonResult | null
}
