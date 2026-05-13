import { describe, it, expect } from 'vitest'
import {
  validateBid,
  validateRTM,
  validateRetention,
  validateSaleConfirmation,
  validateSessionState,
  getSafeBidLimit,
  getMinReservedPurse,
} from '../src/engine/ruleEngine'
import type { GameState } from '../src/types/game'
import type { AuctionDataset } from '../src/types/dataset'
import type { TeamState } from '../src/types/team'
import type { PlayerRecord } from '../src/types/player'

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const INDIAN_BATTER: PlayerRecord = {
  playerId: 'test-indian-bat',
  name: 'Test Batter',
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

const OVERSEAS_BOWLER: PlayerRecord = {
  playerId: 'test-overseas-bwl',
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

const RTM_PLAYER: PlayerRecord = {
  playerId: 'test-rtm-player',
  name: 'RTM Test Player',
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

function makeDataset(overrides: Partial<AuctionDataset> = {}): AuctionDataset {
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
      { fromPrice: 0.00, toPrice: 1.00, step: 0.05 },
      { fromPrice: 1.00, toPrice: 2.00, step: 0.10 },
      { fromPrice: 2.00, toPrice: 5.00, step: 0.25 },
      { fromPrice: 5.00, toPrice: 10.0, step: 0.50 },
      { fromPrice: 10.0, toPrice: 20.0, step: 1.00 },
      { fromPrice: 20.0, toPrice: null as unknown as number, step: 2.00 },
    ],
    auctionSets: ['Indian Batters', 'Overseas Fast Bowlers'],
    historicalRetentions: null,
    players: [INDIAN_BATTER, OVERSEAS_BOWLER, RTM_PLAYER],
    ...overrides,
  }
}

function makeTeamState(overrides: Partial<TeamState> = {}): TeamState {
  return {
    teamId: 'CSK',
    currentPurse: 50,
    squad: [],
    rtmSlotsUsed: 0,
    rtmSlotsAvailable: 1,
    overseasCount: 0,
    ...overrides,
  }
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  const baseTeamStates = {
    CSK: makeTeamState({ teamId: 'CSK', currentPurse: 50 }),
    MI: makeTeamState({ teamId: 'MI', currentPurse: 40 }),
    RCB: makeTeamState({ teamId: 'RCB', currentPurse: 30 }),
    KKR: makeTeamState({ teamId: 'KKR', currentPurse: 25 }),
    DC: makeTeamState({ teamId: 'DC', currentPurse: 35 }),
    RR: makeTeamState({ teamId: 'RR', currentPurse: 20 }),
    SRH: makeTeamState({ teamId: 'SRH', currentPurse: 28 }),
    PBKS: makeTeamState({ teamId: 'PBKS', currentPurse: 60 }),
    GT: makeTeamState({ teamId: 'GT', currentPurse: 32 }),
    LSG: makeTeamState({ teamId: 'LSG', currentPurse: 38 }),
  }

  return {
    sessionId: 'test-session',
    auctionYear: 2025,
    auctionType: 'mega',
    userFranchise: 'CSK',
    difficulty: 'normal',
    retentionMode: 'historical',
    retentionConfigs: {},
    tradeHistory: [],
    phase: 'bidding',
    currentSetIndex: 0,
    currentPlayerIndex: 0,
    currentBidState: {
      currentBid: 2.00,
      currentLeader: 'MI',
      bids: [{ teamId: 'MI', amount: 2.00, timestamp: Date.now() }],
      teamsStillInterested: ['CSK', 'MI'],
      teamsPassed: ['RCB', 'KKR'],
      rtmPending: null,
    },
    soldPlayers: [],
    unsoldPlayers: [],
    teamStates: baseTeamStates,
    auctionHistory: [],
    remainingPlayers: [INDIAN_BATTER, OVERSEAS_BOWLER, RTM_PLAYER],
    seasonSetup: null,
    seasonResult: null,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMinReservedPurse
// ─────────────────────────────────────────────────────────────────────────────

describe('getMinReservedPurse', () => {
  it('reserves ₹0.20 × slots needed for minimum squad', () => {
    const dataset = makeDataset() // minimumSquadSize = 18
    const teamState = makeTeamState({ squad: [] }) // 0 players, need 18
    expect(getMinReservedPurse(teamState, dataset)).toBeCloseTo(18 * 0.20)
  })

  it('returns 0 when squad already meets minimum', () => {
    const dataset = makeDataset()
    const players = Array.from({ length: 18 }, (_, i) => ({
      ...INDIAN_BATTER,
      playerId: `player-${i}`,
    }))
    const teamState = makeTeamState({ squad: players })
    expect(getMinReservedPurse(teamState, dataset)).toBe(0)
  })

  it('returns 0 when squad exceeds minimum', () => {
    const dataset = makeDataset()
    const players = Array.from({ length: 22 }, (_, i) => ({
      ...INDIAN_BATTER,
      playerId: `player-${i}`,
    }))
    const teamState = makeTeamState({ squad: players })
    expect(getMinReservedPurse(teamState, dataset)).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateBid
// ─────────────────────────────────────────────────────────────────────────────

describe('validateBid', () => {
  it('accepts a valid bid that meets increment and purse requirements', () => {
    const dataset = makeDataset()
    const state = makeGameState()
    // Current bid is 2.00, increment for 2.00 is 0.25, so next valid is 2.25
    const result = validateBid(state, dataset, 'CSK', 2.25)
    expect(result.valid).toBe(true)
  })

  it('rejects a bid below minimum increment', () => {
    const dataset = makeDataset()
    const state = makeGameState()
    // Current bid 2.00, increment 0.25 — bid of 2.10 is below 2.25
    const result = validateBid(state, dataset, 'CSK', 2.10)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/minimum bid/i)
  })

  it('rejects a bid when team has insufficient purse', () => {
    const dataset = makeDataset()
    const state = makeGameState({
      teamStates: {
        ...makeGameState().teamStates,
        CSK: makeTeamState({ teamId: 'CSK', currentPurse: 2.00, squad: Array.from({ length: 18 }, (_, i) => ({ ...INDIAN_BATTER, playerId: `p${i}` })) }),
      },
    })
    const result = validateBid(state, dataset, 'CSK', 20.00)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/₹2\.00 Cr remaining/i)
  })

  it('rejects bid if team has already passed', () => {
    const dataset = makeDataset()
    const state = makeGameState({
      currentBidState: {
        currentBid: 2.00,
        currentLeader: 'MI',
        bids: [],
        teamsStillInterested: ['MI'],
        teamsPassed: ['CSK'],
        rtmPending: null,
      },
    })
    const result = validateBid(state, dataset, 'CSK', 2.25)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/already passed/i)
  })

  it('rejects bid if not in bidding phase', () => {
    const dataset = makeDataset()
    const state = makeGameState({ phase: 'set-preview' })
    const result = validateBid(state, dataset, 'CSK', 2.25)
    expect(result.valid).toBe(false)
  })

  it('rejects bid if team is already leading', () => {
    const dataset = makeDataset()
    const state = makeGameState({
      currentBidState: {
        currentBid: 2.00,
        currentLeader: 'CSK',
        bids: [],
        teamsStillInterested: ['CSK'],
        teamsPassed: [],
        rtmPending: null,
      },
    })
    const result = validateBid(state, dataset, 'CSK', 2.25)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/already the leading bidder/i)
  })

  it('rejects bid if squad is full', () => {
    const dataset = makeDataset()
    const fullSquad = Array.from({ length: 25 }, (_, i) => ({ ...INDIAN_BATTER, playerId: `p${i}` }))
    const state = makeGameState({
      teamStates: {
        ...makeGameState().teamStates,
        CSK: makeTeamState({ teamId: 'CSK', currentPurse: 50, squad: fullSquad }),
      },
    })
    const result = validateBid(state, dataset, 'CSK', 2.25)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/squad is full/i)
  })

  it('rejects overseas player bid when team has no overseas slot', () => {
    const dataset = makeDataset()
    // Set current player to overseas by setting setIndex=1 (Overseas Fast Bowlers set)
    const state = makeGameState({
      currentSetIndex: 1,
      currentPlayerIndex: 0,
      currentBidState: {
        currentBid: 1.00,
        currentLeader: 'MI',
        bids: [],
        teamsStillInterested: ['CSK', 'MI'],
        teamsPassed: [],
        rtmPending: null,
      },
      teamStates: {
        ...makeGameState().teamStates,
        CSK: makeTeamState({ teamId: 'CSK', currentPurse: 50, overseasCount: 8 }),
      },
    })
    const result = validateBid(state, dataset, 'CSK', 1.10)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/overseas player limit/i)
  })

  it('rejects bid that would break purse reservation', () => {
    const dataset = makeDataset() // minimumSquadSize=18
    // Squad has 10 players → needs 8 more → reserve = 8 × 0.20 = 1.60
    const smallSquad = Array.from({ length: 10 }, (_, i) => ({ ...INDIAN_BATTER, playerId: `p${i}` }))
    const state = makeGameState({
      teamStates: {
        ...makeGameState().teamStates,
        CSK: makeTeamState({ teamId: 'CSK', currentPurse: 3.85, squad: smallSquad }),
      },
    })
    // purse=3.85, reserve=1.60, safeBidLimit=2.25, bid of 2.26 should fail
    const result = validateBid(state, dataset, 'CSK', 2.26)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/reserve/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateRTM
// ─────────────────────────────────────────────────────────────────────────────

describe('validateRTM', () => {
  function makeRTMState() {
    const base = makeGameState({
      phase: 'rtm-decision',
      currentSetIndex: 0,
      currentPlayerIndex: 1, // RTM_PLAYER (index 1 in sorted Indian Batters set)
      currentBidState: {
        currentBid: 5.00,
        currentLeader: 'MI',
        bids: [],
        teamsStillInterested: [],
        teamsPassed: [],
        rtmPending: 'CSK',
      },
    })
    return base
  }

  it('accepts valid RTM', () => {
    const dataset = makeDataset()
    const state = makeRTMState()
    const result = validateRTM(state, dataset, 'CSK')
    expect(result.valid).toBe(true)
  })

  it('rejects RTM when not available in auction year', () => {
    const dataset = makeDataset({ rtmAvailable: false })
    const state = makeRTMState()
    const result = validateRTM(state, dataset, 'CSK')
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/not available/i)
  })

  it('rejects RTM when team has no slots remaining', () => {
    const dataset = makeDataset()
    const state = makeRTMState()
    state.teamStates['CSK'] = makeTeamState({
      teamId: 'CSK',
      rtmSlotsAvailable: 1,
      rtmSlotsUsed: 1,
    })
    const result = validateRTM(state, dataset, 'CSK')
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/no RTM slots/i)
  })

  it('rejects RTM when team cannot afford RTM price', () => {
    const dataset = makeDataset()
    const state = makeRTMState()
    state.teamStates['CSK'] = makeTeamState({
      teamId: 'CSK',
      currentPurse: 2.00, // RTM price is 5.00
      squad: Array.from({ length: 18 }, (_, i) => ({ ...INDIAN_BATTER, playerId: `p${i}` })),
    })
    const result = validateRTM(state, dataset, 'CSK')
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/cannot afford/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateRetention
// ─────────────────────────────────────────────────────────────────────────────

describe('validateRetention', () => {
  it('accepts valid retention within limits', () => {
    const dataset = makeDataset()
    const result = validateRetention(dataset, 'CSK', {
      teamId: 'CSK',
      mode: 'custom',
      retainedPlayers: [{ playerId: 'test-indian-bat', retentionPrice: 10, isRTMEligible: false }],
      purseAfterRetention: 110,
      rtmSlotsAvailable: 0,
    })
    expect(result.valid).toBe(true)
  })

  it('rejects retention exceeding max allowed', () => {
    const dataset = makeDataset({ maxRetainedPlayers: 2 })
    const result = validateRetention(dataset, 'CSK', {
      teamId: 'CSK',
      mode: 'custom',
      retainedPlayers: [
        { playerId: 'test-indian-bat', retentionPrice: 10, isRTMEligible: false },
        { playerId: 'test-overseas-bwl', retentionPrice: 10, isRTMEligible: false },
        { playerId: 'test-rtm-player', retentionPrice: 10, isRTMEligible: false },
      ],
      purseAfterRetention: 90,
      rtmSlotsAvailable: 0,
    })
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/maximum 2 players/i)
  })

  it('rejects retention of player not in dataset', () => {
    const dataset = makeDataset()
    const result = validateRetention(dataset, 'CSK', {
      teamId: 'CSK',
      mode: 'custom',
      retainedPlayers: [{ playerId: 'ghost-player', retentionPrice: 5, isRTMEligible: false }],
      purseAfterRetention: 115,
      rtmSlotsAvailable: 0,
    })
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/not found in dataset/i)
  })

  it('rejects retention when total cost exceeds starting purse', () => {
    const dataset = makeDataset({ startingPurse: { ...makeDataset().startingPurse, CSK: 10 } })
    const result = validateRetention(dataset, 'CSK', {
      teamId: 'CSK',
      mode: 'custom',
      retainedPlayers: [
        { playerId: 'test-indian-bat', retentionPrice: 8, isRTMEligible: false },
        { playerId: 'test-rtm-player', retentionPrice: 8, isRTMEligible: false },
      ],
      purseAfterRetention: -6,
      rtmSlotsAvailable: 0,
    })
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/exceeds starting purse/i)
  })

  it('rejects when retention not allowed in auction year', () => {
    const dataset = makeDataset({ retentionAllowed: false })
    const result = validateRetention(dataset, 'CSK', {
      teamId: 'CSK',
      mode: 'custom',
      retainedPlayers: [],
      purseAfterRetention: 120,
      rtmSlotsAvailable: 0,
    })
    expect(result.valid).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateSessionState
// ─────────────────────────────────────────────────────────────────────────────

describe('validateSessionState', () => {
  it('accepts valid session state', () => {
    const state = makeGameState()
    expect(validateSessionState(state).valid).toBe(true)
  })

  it('rejects state with no session ID', () => {
    const state = makeGameState({ sessionId: '' })
    const result = validateSessionState(state)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/no ID/i)
  })

  it('rejects state with negative purse', () => {
    const state = makeGameState({
      teamStates: {
        ...makeGameState().teamStates,
        CSK: makeTeamState({ teamId: 'CSK', currentPurse: -5 }),
      },
    })
    const result = validateSessionState(state)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/negative purse/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getSafeBidLimit
// ─────────────────────────────────────────────────────────────────────────────

describe('getSafeBidLimit', () => {
  it('returns purse minus reserved amount', () => {
    const dataset = makeDataset() // minimumSquadSize=18
    // Empty squad: need 18 × 0.20 = 3.60 reserved
    const teamState = makeTeamState({ currentPurse: 20, squad: [] })
    expect(getSafeBidLimit(teamState, dataset)).toBeCloseTo(20 - 18 * 0.20)
  })

  it('returns full purse when squad already meets minimum', () => {
    const dataset = makeDataset()
    const players = Array.from({ length: 18 }, (_, i) => ({ ...INDIAN_BATTER, playerId: `p${i}` }))
    const teamState = makeTeamState({ currentPurse: 20, squad: players })
    expect(getSafeBidLimit(teamState, dataset)).toBeCloseTo(20)
  })

  it('never returns negative value', () => {
    const dataset = makeDataset()
    const teamState = makeTeamState({ currentPurse: 0.50, squad: [] })
    expect(getSafeBidLimit(teamState, dataset)).toBe(0)
  })
})
