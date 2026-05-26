import type { PlayerRole, SoldPlayerRecord } from './player'

export type TeamId =
  | 'CSK' | 'MI' | 'RCB' | 'KKR' | 'DC'
  | 'RR' | 'SRH' | 'PBKS' | 'GT' | 'LSG'

export const ALL_TEAM_IDS: TeamId[] = [
  'CSK', 'MI', 'RCB', 'KKR', 'DC', 'RR', 'SRH', 'PBKS', 'GT', 'LSG',
]

/** Live state of a team during the auction */
export interface TeamState {
  currentPurse: number
  squad: SoldPlayerRecord[]
  rtmSlotsUsed: number
  rtmSlotsAvailable: number
  overseasCount: number
}

/** Static persona config for each franchise — used by Bidding Engine */
export interface FranchisePersona {
  teamId: TeamId
  displayName: string
  ownerName: string
  auctionStyle: 'aggressive' | 'calculated' | 'emotional' | 'analytical' | 'moneyball'

  // Role priority weights (multiplied into interest score)
  roleWeights: Record<PlayerRole, number>

  // Player preferences
  prefersCapped: boolean
  prefersIndian: boolean
  loyaltyBonus: number        // fractional bonus (e.g. 0.20 = 20%) for ex-team players
  overseasCaution: number     // 0–1, reduces interest in overseas players

  // Bid behaviour
  rtmThreshold: number        // 0–1, fraction of desire score required to exercise RTM
  tradeOpenness: number       // 0–1, how open to trades
  maxBidMultiplier: number    // multiplier on safeBidLimit for max bid calculation

  // Uncapped / youth strategy
  potentialWeight: number     // 0–1, how heavily this team values uncapped player potential
  youthThreshold: number      // age at or below which youth bonus fully applies (e.g. 22)

  // Character
  emotionalTriggers: string[]
  llmPersonaPrompt: string    // system prompt context for LLM calls (Phase 2)

  // Season simulation
  franchiseStrength: number   // 0–1, historical IPL franchise quality baseline
}
