export type PlayerRole = 'BAT' | 'BWL' | 'AR' | 'WK'

export type PlayerNationality = 'indian' | 'overseas'

export type PlayerCappedStatus = 'capped' | 'uncapped'

/** A player record exactly as loaded from the auction dataset. Immutable after load. */
export interface PlayerRecord {
  playerId: string
  name: string
  role: PlayerRole
  nationality: PlayerNationality
  country: string
  cappedStatus: PlayerCappedStatus
  isOverseas: boolean
  basePrice: number          // in crores (e.g. 0.20, 0.50, 1.00, 2.00)
  auctionSet: string         // e.g. "Marquee Set A"
  auctionSetOrder: number    // position within set (1-based)
  previousTeam: string | null // TeamId of prior IPL team, null if new/no history
  rtmEligibleFor: string | null // TeamId that can RTM this player, null if none
}

/** A player who was sold during auction */
export interface SoldPlayerRecord {
  player: PlayerRecord
  soldTo: string    // TeamId
  soldFor: number   // in crores
  setName: string
  bidHistory: BidEntry[]
  rtmUsed: boolean
}

/** A player who went unsold */
export interface UnsoldPlayerRecord {
  player: PlayerRecord
  unsoldReason: string
  setName: string
}

export interface BidEntry {
  teamId: string
  amount: number
  timestamp: number
}
