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
  basePrice: number
  auctionSet: string
  auctionSetOrder: number
  previousTeam: string | null
  rtmEligibleFor: string | null
}

/** A player who was sold during auction — extends PlayerRecord with sale metadata */
export interface SoldPlayerRecord extends PlayerRecord {
  soldPrice: number
  soldTo: string    // TeamId
  isRetained: boolean
}

/** A player who went unsold */
export interface UnsoldPlayerRecord extends PlayerRecord {
  passedAt: number  // timestamp
}

export interface BidEntry {
  teamId: string
  amount: number
  timestamp: number
}
