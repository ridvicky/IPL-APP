import type { TeamId } from './team'
import type { PlayerRecord } from './player'

export type AuctionType = 'mega' | 'mini'

/** Bid increment rule: from `fromPrice` up to `toPrice`, increment by `step` */
export interface BidIncrementBand {
  fromPrice: number   // inclusive lower bound (crores)
  toPrice: number     // exclusive upper bound (crores), null = no upper limit
  step: number        // bid step in crores (e.g. 0.05, 0.10, 0.25, 0.50, 1.00)
}

/** Historical retention record for one team in one auction year */
export interface HistoricalRetentionRecord {
  teamId: TeamId
  retainedPlayers: {
    playerId: string
    retentionPrice: number    // price deducted from purse (crores)
    isRTMEligible: boolean    // does this team get an RTM slot for this player?
  }[]
  purseAfterRetention: number
  rtmSlotsAvailable: number
}

/** Full auction dataset for one IPL year */
export interface AuctionDataset {
  // ── Metadata ──────────────────────────────────────────────────────────────
  year: number
  auctionType: AuctionType
  displayName: string          // e.g. "IPL 2025 Mega Auction"

  // ── Teams ─────────────────────────────────────────────────────────────────
  teams: TeamId[]

  // ── Purse ─────────────────────────────────────────────────────────────────
  startingPurse: Record<TeamId, number>   // before retention deductions

  // ── Squad limits ──────────────────────────────────────────────────────────
  minimumSquadSize: number      // e.g. 18
  maximumSquadSize: number      // e.g. 25
  overseasLimit: number         // e.g. 8 (max overseas players in squad)

  // ── Bid rules ─────────────────────────────────────────────────────────────
  bidIncrements: BidIncrementBand[]

  // ── Retention rules ───────────────────────────────────────────────────────
  rtmAvailable: boolean
  maxRTMPerTeam: number          // max RTM uses per team (0 if rtmAvailable=false)
  maxRetainedPlayers: number     // max players a team can retain
  maxOverseasRetained: number    // max overseas players in retention
  retentionAllowed: boolean      // some mini auctions disallow retention

  // ── Accelerated round ─────────────────────────────────────────────────────
  acceleratedRoundEnabled: boolean

  // ── Historical data (if available) ────────────────────────────────────────
  historicalRetentions: HistoricalRetentionRecord[] | null

  // ── Player pool ───────────────────────────────────────────────────────────
  players: PlayerRecord[]

  // ── Auction sets (ordered list of set names) ──────────────────────────────
  // Players reference their set by name; this defines the display order of sets
  auctionSets: string[]
}

/** Player performance data for season simulation (separate from auction dataset) */
export interface PlayerPerformanceData {
  playerId: string
  year: number
  matches: number
  runsScored: number | null
  battingAverage: number | null
  strikeRate: number | null
  wicketsTaken: number | null
  bowlingEconomy: number | null
  bowlingAverage: number | null
  allRoundContribution: number | null
  performanceRating: number    // 0–100 composite — primary season sim input
  injuryFlag: boolean
  formFlag: 'peak' | 'average' | 'poor'
}
