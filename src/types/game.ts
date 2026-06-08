import type { TeamId, TeamState } from './team'
import type { PlayerRecord, PlayerSeasonState, SoldPlayerRecord, UnsoldPlayerRecord, BidEntry } from './player'
import type { TradeRecord } from './trade'
import type { SeasonSetup, SeasonResult, MatchFixture, StandingsRow, TeamPhilosophy, LiveMatchState } from './season'

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
  | 'accelerated-selection'
  // ── Season phases ──────────────────────────────────────────────
  | 'preseason-strategy'
  | 'preseason-training'
  | 'season-hub'
  | 'pre-match'
  | 'match-sim'
  | 'innings-break'
  | 'post-match'
  | 'training'
  | 'playoff'
  | 'season-complete'
  // legacy (kept for saved session compatibility)
  | 'season-setup'
  | 'season-simulation'

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
  setPlayerOrder: Record<string, string[]>  // setName → shuffled playerIds; generated once per set
  isReauction: boolean                      // true during the re-auction phase (unsold at 50% base)
  reauctionPool: PlayerRecord[]             // unsold players with halved base prices
  reauctionIndex: number                    // current position in reauctionPool
  acceleratedPicks: string[]               // playerIds selected for the accelerated auction pool
  acceleratedRoundsCompleted: number       // how many accelerated re-auction cycles have run
  originalUnsoldPool: UnsoldPlayerRecord[] // full unsold list captured before round 1; used as round 2 pool
  tradeHistory: TradeRecord[]
  auctionLog: string[]
  seasonSetup: SeasonSetup | null
  seasonResult: SeasonResult | null

  // ── Season simulator fields ─────────────────────────────────────
  teamPhilosophy?: TeamPhilosophy
  seasonSchedule?: MatchFixture[]
  currentMatchIndex?: number
  pointsTable?: StandingsRow[]
  teamMorale?: number
  currentMatchState?: LiveMatchState
  playerSeasonStates?: Record<string, PlayerSeasonState>  // playerId → season state
}
