import type { PlayerRecord } from './player'

export type TeamId =
  | 'CSK' | 'MI' | 'RCB' | 'KKR' | 'DC'
  | 'RR' | 'SRH' | 'PBKS' | 'GT' | 'LSG'

export const ALL_TEAM_IDS: TeamId[] = [
  'CSK', 'MI', 'RCB', 'KKR', 'DC', 'RR', 'SRH', 'PBKS', 'GT', 'LSG',
]

export interface TeamMeta {
  id: TeamId
  fullName: string
  shortName: string
  city: string
  primaryColor: string
  secondaryColor: string
}

/** Live state of a team during the auction */
export interface TeamState {
  teamId: TeamId
  currentPurse: number        // in crores, decreases as players are bought
  squad: PlayerRecord[]       // players currently in squad (retained + bought)
  rtmSlotsUsed: number
  rtmSlotsAvailable: number
  overseasCount: number       // count of overseas players in squad
}

/** Difficulty-scaled persona modifiers */
export interface DifficultyModifiers {
  aggressionMultiplier: number      // 0.5 (easy) → 1.0 (normal) → 1.3 (hard)
  purseReservationMultiplier: number // how carefully they reserve purse
  scarcityDetectionBonus: number    // extra weight on scarcity
  emotionCapMultiplier: number      // caps how much emotion can inflate bids
}

/** Static persona config for each franchise — used by Bidding Engine */
export interface FranchisePersona {
  id: TeamId
  fullName: string
  shortName: string

  // Bidding weights (0–100 scale)
  aggressionLevel: number
  riskAppetite: number
  purseDiscipline: number
  emotionalTendency: number

  // Player preferences (used in Step 1 intent check)
  preferredRoles: import('./player').PlayerRole[]
  preferredNationality: 'indian' | 'overseas' | 'balanced'
  avoidedProfiles: string[]         // descriptive strings for LLM context

  // Bid premium modifiers (added to base valuation)
  formerPlayerBonus: number         // crores added if player was previously with them
  captaincyPremium: number          // crores added if player is a captaincy candidate
  marqueeMultiplier: number         // multiplier for marquee player bids
  rivalTeamMultiplier: number       // extra if rival team is also bidding
  lateAuctionDesperation: number    // 0–1 scale, applied when <30% players remain

  // RTM
  rtmThreshold: number              // rtmScore threshold to use RTM (0–100)
  rtmFormerAttachmentBonus: number  // bonus to rtmScore for former player

  // Trade
  tradeOpenness: number             // 0–100, how open to trades
  protectedRoles: import('./player').PlayerRole[] // roles they won't trade away

  // Minimum interest threshold for bidding
  minimumInterestThreshold: number  // 0–100, below this → guaranteed pass

  // LLM prompt identity (used as system prompt context)
  llmPersonaPrompt: string
}
