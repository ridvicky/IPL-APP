import type { PlayerRole, SoldPlayerRecord } from './player'

/** 6-tier player quality classification */
export type PlayerTier6 = 1 | 2 | 3 | 4 | 5 | 6

/** Per-franchise squad composition and budget strategy */
export interface SquadTemplate {
  /** Tier 1–3 player count needed before switching from XI-building to backup-filling mode */
  xiQualityThreshold: number
  /** Per-tier bid ceiling multiplier reflecting franchise aggression per player quality level */
  tierBidMultipliers: Record<PlayerTier6, number>
  /**
   * Fraction of total starting purse allocated per tier group.
   * Once a group exceeds its share, the engine tightens the ceiling on further bids.
   * Tier groups: xiStars (T1+T2), emergingSpec (T3+T4), depth (T5+T6). Should sum ~1.0.
   */
  tierPurseShare: {
    xiStars: number       // Tier 1–2: marquee + established
    emergingSpec: number  // Tier 3–4: emerging stars + role specialists
    depth: number         // Tier 5–6: domestic + budget fillers
  }
  /** Minimum role composition for a balanced squad */
  roleComposition: {
    minTopOrder: number      // openers + top-4 batters
    minFinishers: number
    minAllRounders: number
    minPacers: number
    minSpinners: number
    minKeepers: number
  }
}

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

  // Tier targets per role — prime (star), reliable (professional), depth (youth/backup)
  // Total of all tiers = ideal squad count for that role
  squadTierTargets: {
    BAT: { prime: number; reliable: number; depth: number }
    BWL: { prime: number; reliable: number; depth: number }
    AR:  { prime: number; reliable: number; depth: number }
    WK:  { prime: number; reliable: number; depth: number }
  }

  // Batting position affinity — multiplier for opener/middleOrder/finisher preference (BAT/WK only)
  battingPositionAffinity: { opener: number; middleOrder: number; finisher: number }

  // AR archetype affinity — unified bowling-style × batting-role preference for All-Rounders
  // Keys: 'spin-opener' | 'spin-middleOrder' | 'spin-finisher' | 'pace-opener' | 'pace-middleOrder' | 'pace-finisher'
  arArchetypeAffinity: Record<string, number>

  // How much this team values having a captain figure in the squad (0.8–1.2)
  captaincyWeight: number

  // Bowling type affinity — multiplier applied to BWL (pure bowlers) only
  bowlingAffinity: { pace: number; spin: number }

  // Player type preference — multipliers for star / youth / value archetypes
  playerTypeAffinity: { stars: number; youth: number; value: number }

  // Squad composition template and per-tier bidding strategy
  squadTemplate: SquadTemplate
}
