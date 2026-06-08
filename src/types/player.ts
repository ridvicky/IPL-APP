export type PlayerRole = 'BAT' | 'BWL' | 'AR' | 'WK'

export type PlayerNationality = 'indian' | 'overseas'

export type PlayerCappedStatus = 'capped' | 'uncapped'

export type ProspectTier = 'elite' | 'promising' | 'domestic' | 'filler'

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
  /** Real-world auction final price (Cr) — set when the actual IPL auction result is known */
  marketValue?: number | null
  /** Uncapped players only — age at time of auction */
  age?: number
  /** Uncapped players only — talent/potential rating 1–10 */
  potential?: number
  /** Uncapped players only — derived from potential */
  prospectTier?: ProspectTier
  /** Teams with known real-world interest in this player — drives aggressive bidding */
  interestedTeams?: string[]
  /** Real IPL 2025 auction sold price (Cr) — used as realism anchor for bid ceilings */
  boughtPrice?: number | null
}

/** Season-runtime state layered on top of a SoldPlayerRecord during active season */
export interface PlayerSeasonState {
  playerId: string
  form: 'hot' | 'normal' | 'cold' | 'injured'
  fitnessLevel: number          // 0–100; drops per match, recovers with Fitness Camp
  matchesInjured: number        // matches remaining to miss; 0 = available
  seasonStats: {
    matches: number
    runs: number
    balls: number
    wickets: number
    catches: number
    fifties: number
    hundreds: number
    fourWicketHauls: number
  }
}

/**
 * Recent form context fetched by LLM at auction time.
 * Not stored in dataset — fetched once per player per session and cached in memory.
 */
export interface PlayerFormContext {
  summary: string            // 2–3 sentence form summary (SMAT, int'l series, tournaments)
  t20iRanking: number | null // ICC T20I ranking at auction time; null if uncapped/not ranked
  estimatedAge: number | null // player's approximate age at auction time
  source: 'llm' | 'none'    // 'none' if LLM unavailable or timed out
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
