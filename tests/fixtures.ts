/**
 * Shared test fixtures — match the actual current type shapes exactly.
 */
import type { GameState, BidState } from '../src/types/game'
import type { AuctionDataset } from '../src/types/dataset'
import type { TeamState, TeamId } from '../src/types/team'
import type { PlayerRecord, SoldPlayerRecord } from '../src/types/player'

// ── Players ──────────────────────────────────────────────────────────────────

export const INDIAN_BATTER: PlayerRecord = {
  playerId: 'test-indian-bat',
  name: 'Test Indian Batter',
  role: 'BAT',
  nationality: 'indian',
  country: 'India',
  cappedStatus: 'capped',
  isOverseas: false,
  basePrice: 2.00,
  auctionSet: 'Indian Batters',
  auctionSetOrder: 1,
  previousTeam: null,
  rtmEligibleFor: null,
}

export const OVERSEAS_BOWLER: PlayerRecord = {
  playerId: 'test-os-bwl',
  name: 'Test Overseas Bowler',
  role: 'BWL',
  nationality: 'overseas',
  country: 'Australia',
  cappedStatus: 'capped',
  isOverseas: true,
  basePrice: 1.00,
  auctionSet: 'Overseas Fast Bowlers',
  auctionSetOrder: 1,
  previousTeam: null,
  rtmEligibleFor: null,
}

export const RTM_PLAYER: PlayerRecord = {
  playerId: 'test-rtm',
  name: 'Test RTM Player',
  role: 'BAT',
  nationality: 'indian',
  country: 'India',
  cappedStatus: 'capped',
  isOverseas: false,
  basePrice: 2.00,
  auctionSet: 'Indian Batters',
  auctionSetOrder: 2,
  previousTeam: 'CSK',
  rtmEligibleFor: 'CSK',
}

export const SOLD_PLAYER = (id: string, price = 2.0): SoldPlayerRecord => ({
  ...INDIAN_BATTER,
  playerId: id,
  soldPrice: price,
  soldTo: 'CSK',
  isRetained: false,
})

// ── Dataset ───────────────────────────────────────────────────────────────────

export function makeDataset(overrides: Partial<AuctionDataset> = {}): AuctionDataset {
  return {
    year: 2025,
    auctionType: 'mega',
    displayName: 'Test Auction',
    teams: ['CSK', 'MI', 'RCB', 'KKR', 'DC', 'RR', 'SRH', 'PBKS', 'GT', 'LSG'],
    startingPurse: {
      CSK: 120, MI: 110, RCB: 83, KKR: 51, DC: 73,
      RR: 41, SRH: 45, PBKS: 110, GT: 69, LSG: 69,
    },
    minimumSquadSize: 18,
    maximumSquadSize: 25,
    overseasLimit: 8,
    rtmAvailable: true,
    maxRTMPerTeam: 1,
    maxRetainedPlayers: 6,
    maxOverseasRetained: 2,
    retentionAllowed: true,
    acceleratedRoundEnabled: false,
    bidIncrements: [
      { fromPrice: 0.00, toPrice: 1.00,  step: 0.05 },
      { fromPrice: 1.00, toPrice: 2.00,  step: 0.10 },
      { fromPrice: 2.00, toPrice: 5.00,  step: 0.25 },
      { fromPrice: 5.00, toPrice: 10.00, step: 0.50 },
      { fromPrice: 10.0, toPrice: 20.00, step: 1.00 },
      { fromPrice: 20.0, toPrice: 999,   step: 2.00 },
    ],
    auctionSets: ['Indian Batters', 'Overseas Fast Bowlers'],
    historicalRetentions: null,
    players: [INDIAN_BATTER, OVERSEAS_BOWLER, RTM_PLAYER],
    ...overrides,
  }
}

// ── TeamState ─────────────────────────────────────────────────────────────────

export function makeTeamState(overrides: Partial<TeamState> = {}): TeamState {
  return {
    currentPurse: 50,
    squad: [],
    rtmSlotsUsed: 0,
    rtmSlotsAvailable: 1,
    overseasCount: 0,
    ...overrides,
  }
}

// ── BidState ──────────────────────────────────────────────────────────────────

export function makeBidState(overrides: Partial<BidState> = {}): BidState {
  return {
    currentBid: 2.00,
    currentLeader: 'MI',
    bids: [{ teamId: 'MI', amount: 2.00, timestamp: Date.now() }],
    teamsStillInterested: ['CSK', 'MI'],
    teamsPassed: [],
    permanentPass: [],
    rtmPending: null,
    ...overrides,
  }
}

// ── GameState ─────────────────────────────────────────────────────────────────

const ALL_TEAMS: TeamId[] = ['CSK', 'MI', 'RCB', 'KKR', 'DC', 'RR', 'SRH', 'PBKS', 'GT', 'LSG']

export function makeTeamStates(purses: Partial<Record<TeamId, number>> = {}): Record<TeamId, TeamState> {
  const defaults: Record<TeamId, number> = {
    CSK: 50, MI: 40, RCB: 30, KKR: 25, DC: 35,
    RR: 20, SRH: 28, PBKS: 60, GT: 32, LSG: 38,
  }
  return Object.fromEntries(
    ALL_TEAMS.map(id => [id, makeTeamState({ currentPurse: purses[id] ?? defaults[id] })])
  ) as Record<TeamId, TeamState>
}

export function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    sessionId: 'test-session',
    userFranchise: 'CSK',
    auctionYear: 2025,
    phase: 'bidding',
    currentSetIndex: 0,
    currentPlayerIndex: 0,
    currentBidState: makeBidState(),
    teamStates: makeTeamStates(),
    soldPlayers: [],
    unsoldPlayers: [],
    releasedRetainedPlayers: [],
    tradeHistory: [],
    auctionLog: [],
    ...overrides,
  }
}
