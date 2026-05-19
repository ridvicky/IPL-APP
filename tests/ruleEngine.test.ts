import { describe, it, expect } from 'vitest'
import {
  validateBid,
  validateRTM,
  validateRetention,
  validateSaleConfirmation,
  validateSessionState,
  validateTrade,
  getSafeBidLimit,
  getMinReservedPurse,
} from '../src/engine/ruleEngine'
import {
  makeDataset, makeGameState, makeTeamState, makeTeamStates,
  makeBidState, INDIAN_BATTER, OVERSEAS_BOWLER, RTM_PLAYER, SOLD_PLAYER,
} from './fixtures'

// ─────────────────────────────────────────────────────────────────────────────
// getMinReservedPurse
// ─────────────────────────────────────────────────────────────────────────────

describe('getMinReservedPurse', () => {
  it('reserves ₹0.20 × remaining slots below minimum squad', () => {
    const dataset = makeDataset() // minimumSquadSize = 18
    const ts = makeTeamState({ squad: [] })
    expect(getMinReservedPurse(ts, dataset)).toBeCloseTo(18 * 0.20)
  })

  it('returns 0 when squad already meets minimum', () => {
    const ts = makeTeamState({ squad: Array.from({ length: 18 }, (_, i) => SOLD_PLAYER(`p${i}`)) })
    expect(getMinReservedPurse(ts, makeDataset())).toBe(0)
  })

  it('returns 0 when squad exceeds minimum', () => {
    const ts = makeTeamState({ squad: Array.from({ length: 22 }, (_, i) => SOLD_PLAYER(`p${i}`)) })
    expect(getMinReservedPurse(ts, makeDataset())).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getSafeBidLimit
// ─────────────────────────────────────────────────────────────────────────────

describe('getSafeBidLimit', () => {
  it('safe limit = purse minus reserved amount', () => {
    const dataset = makeDataset()
    const ts = makeTeamState({ currentPurse: 50, squad: [] })
    const reserved = getMinReservedPurse(ts, dataset)
    expect(getSafeBidLimit(ts, dataset)).toBeCloseTo(50 - reserved)
  })

  it('returns 0 if purse is fully consumed by reserve', () => {
    const dataset = makeDataset({ minimumSquadSize: 18 })
    // 18 slots × 0.20 = 3.60 reserve; purse = 3.00 → safe = 0
    const ts = makeTeamState({ currentPurse: 3.00, squad: [] })
    expect(getSafeBidLimit(ts, dataset)).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateBid
// ─────────────────────────────────────────────────────────────────────────────

describe('validateBid', () => {
  it('accepts a valid bid above minimum increment', () => {
    // Current bid 2.00, increment for 2.00 is 0.25 → min next = 2.25
    const result = validateBid(makeGameState(), makeDataset(), 'CSK', 2.25)
    expect(result.valid).toBe(true)
  })

  it('accepts a bid jumping multiple increments', () => {
    const result = validateBid(makeGameState(), makeDataset(), 'CSK', 5.00)
    expect(result.valid).toBe(true)
  })

  it('rejects bid below minimum increment', () => {
    const result = validateBid(makeGameState(), makeDataset(), 'CSK', 2.10)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/minimum bid/i)
  })

  it('rejects bid when team does not have enough purse', () => {
    const state = makeGameState({
      teamStates: {
        ...makeTeamStates(),
        CSK: makeTeamState({ currentPurse: 2.00, squad: Array.from({ length: 18 }, (_, i) => SOLD_PLAYER(`p${i}`)) }),
      },
    })
    const result = validateBid(state, makeDataset(), 'CSK', 20.00)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/₹2\.00 Cr remaining/i)
  })

  it('rejects bid when team has already passed this round', () => {
    const state = makeGameState({
      currentBidState: makeBidState({ teamsPassed: ['CSK'] }),
    })
    const result = validateBid(state, makeDataset(), 'CSK', 2.25)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/already passed/i)
  })

  it('rejects bid when team is already the leader (no RTM)', () => {
    const state = makeGameState({
      currentBidState: makeBidState({ currentLeader: 'CSK', rtmPending: null }),
    })
    const result = validateBid(state, makeDataset(), 'CSK', 2.25)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/already the leading/i)
  })

  it('rejects bid when phase is not bidding', () => {
    const state = makeGameState({ phase: 'set-preview' })
    const result = validateBid(state, makeDataset(), 'CSK', 2.25)
    expect(result.valid).toBe(false)
  })

  it('rejects bid when squad is full', () => {
    const state = makeGameState({
      teamStates: {
        ...makeTeamStates(),
        CSK: makeTeamState({
          currentPurse: 100,
          squad: Array.from({ length: 25 }, (_, i) => SOLD_PLAYER(`p${i}`)),
        }),
      },
    })
    const result = validateBid(state, makeDataset(), 'CSK', 2.25)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/squad is full/i)
  })

  it('rejects overseas player bid when team has hit overseas limit', () => {
    const dataset = makeDataset({ overseasLimit: 8 })
    const state = makeGameState({
      currentSetIndex: 1, // Overseas Fast Bowlers set
      currentPlayerIndex: 0,
      currentBidState: makeBidState(),
      teamStates: {
        ...makeTeamStates(),
        CSK: makeTeamState({ currentPurse: 100, overseasCount: 8 }),
      },
    })
    const result = validateBid(state, dataset, 'CSK', 2.25)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/overseas player limit/i)
  })

  it('rejects bid that would consume reserve purse', () => {
    const dataset = makeDataset({ minimumSquadSize: 10 })
    // Empty squad → needs 10 × 0.20 = 2.00 Cr in reserve
    // Purse = 5.00, safe limit = 3.00 — bid of 4.00 crosses reserve
    const state = makeGameState({
      teamStates: {
        ...makeTeamStates(),
        CSK: makeTeamState({ currentPurse: 5.00, squad: [] }),
      },
    })
    const result = validateBid(state, dataset, 'CSK', 4.00)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/must keep/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateRTM
// ─────────────────────────────────────────────────────────────────────────────

describe('validateRTM', () => {
  const rtmState = makeGameState({
    phase: 'rtm-decision',
    currentSetIndex: 0,
    currentPlayerIndex: 1, // RTM_PLAYER is at index 1 in fixture dataset
    currentBidState: makeBidState({ rtmPending: 'CSK', currentLeader: 'MI', currentBid: 5.00 }),
    teamStates: {
      ...makeTeamStates(),
      CSK: makeTeamState({ currentPurse: 10, rtmSlotsAvailable: 1, rtmSlotsUsed: 0 }),
    },
  })
  const rtmDataset = makeDataset({ players: [INDIAN_BATTER, RTM_PLAYER, OVERSEAS_BOWLER] })

  it('accepts valid RTM exercise', () => {
    const result = validateRTM(rtmState, rtmDataset, 'CSK')
    expect(result.valid).toBe(true)
  })

  it('rejects RTM when not in rtm-decision phase', () => {
    const state = { ...rtmState, phase: 'bidding' as const }
    const result = validateRTM(state, rtmDataset, 'CSK')
    expect(result.valid).toBe(false)
  })

  it('rejects RTM when team has no slots remaining', () => {
    const state = makeGameState({
      ...rtmState,
      teamStates: {
        ...makeTeamStates(),
        CSK: makeTeamState({ currentPurse: 10, rtmSlotsAvailable: 1, rtmSlotsUsed: 1 }),
      },
    })
    const result = validateRTM(state, rtmDataset, 'CSK')
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/no RTM slots/i)
  })

  it('rejects RTM when team cannot afford the RTM price', () => {
    const state = makeGameState({
      ...rtmState,
      teamStates: {
        ...makeTeamStates(),
        CSK: makeTeamState({ currentPurse: 1.00, rtmSlotsAvailable: 1, rtmSlotsUsed: 0 }),
      },
    })
    const result = validateRTM(state, rtmDataset, 'CSK')
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/cannot afford/i)
  })

  it('rejects RTM when dataset does not support RTM', () => {
    const result = validateRTM(rtmState, makeDataset({ rtmAvailable: false }), 'CSK')
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/not available/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateRetention
// ─────────────────────────────────────────────────────────────────────────────

describe('validateRetention', () => {
  it('accepts a valid single retention', () => {
    const dataset = makeDataset()
    const config = {
      teamId: 'CSK' as const,
      retainedPlayers: [{ playerId: 'test-indian-bat', retentionPrice: 14 }],
    }
    const result = validateRetention(dataset, 'CSK', config)
    expect(result.valid).toBe(true)
  })

  it('rejects retention when retention is not allowed', () => {
    const dataset = makeDataset({ retentionAllowed: false })
    const result = validateRetention(dataset, 'CSK', { teamId: 'CSK', retainedPlayers: [] })
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/not allowed/i)
  })

  it('rejects when retaining more than maxRetainedPlayers', () => {
    const dataset = makeDataset({ maxRetainedPlayers: 2 })
    const config = {
      teamId: 'CSK' as const,
      retainedPlayers: [
        { playerId: 'test-indian-bat', retentionPrice: 18 },
        { playerId: 'test-rtm', retentionPrice: 14 },
        { playerId: 'test-os-bwl', retentionPrice: 12 },
      ],
    }
    const result = validateRetention(dataset, 'CSK', config)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/maximum 2/i)
  })

  it('rejects retention cost exceeding starting purse', () => {
    const dataset = makeDataset({ startingPurse: { CSK: 10, MI: 110, RCB: 83, KKR: 51, DC: 73, RR: 41, SRH: 45, PBKS: 110, GT: 69, LSG: 69 } })
    const config = {
      teamId: 'CSK' as const,
      retainedPlayers: [{ playerId: 'test-indian-bat', retentionPrice: 18 }],
    }
    const result = validateRetention(dataset, 'CSK', config)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/exceeds starting purse/i)
  })

  it('rejects negative retention price', () => {
    const dataset = makeDataset()
    const config = {
      teamId: 'CSK' as const,
      retainedPlayers: [{ playerId: 'test-indian-bat', retentionPrice: -5 }],
    }
    const result = validateRetention(dataset, 'CSK', config)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/cannot be negative/i)
  })

  it('rejects retaining a player not in the dataset', () => {
    const result = validateRetention(makeDataset(), 'CSK', {
      teamId: 'CSK',
      retainedPlayers: [{ playerId: 'ghost-player', retentionPrice: 5 }],
    })
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/not found/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateSaleConfirmation
// ─────────────────────────────────────────────────────────────────────────────

describe('validateSaleConfirmation', () => {
  it('accepts a valid sale', () => {
    const state = makeGameState()
    const result = validateSaleConfirmation(state, makeDataset(), 'CSK', 3.00)
    expect(result.valid).toBe(true)
  })

  it('rejects when winning team cannot afford sale price', () => {
    const state = makeGameState({
      teamStates: { ...makeTeamStates(), CSK: makeTeamState({ currentPurse: 1.00 }) },
    })
    const result = validateSaleConfirmation(state, makeDataset(), 'CSK', 5.00)
    expect(result.valid).toBe(false)
  })

  it('rejects when winning team squad is full', () => {
    const state = makeGameState({
      teamStates: {
        ...makeTeamStates(),
        CSK: makeTeamState({ currentPurse: 100, squad: Array.from({ length: 25 }, (_, i) => SOLD_PLAYER(`p${i}`)) }),
      },
    })
    const result = validateSaleConfirmation(state, makeDataset(), 'CSK', 1.00)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/squad is full/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateSessionState
// ─────────────────────────────────────────────────────────────────────────────

describe('validateSessionState', () => {
  it('accepts valid session state', () => {
    expect(validateSessionState(makeGameState()).valid).toBe(true)
  })

  it('rejects missing session ID', () => {
    const result = validateSessionState(makeGameState({ sessionId: '' }))
    expect(result.valid).toBe(false)
  })

  it('rejects missing userFranchise', () => {
    const result = validateSessionState(makeGameState({ userFranchise: '' as never }))
    expect(result.valid).toBe(false)
  })

  it('rejects negative purse — corrupted state', () => {
    const state = makeGameState({
      teamStates: { ...makeTeamStates(), CSK: makeTeamState({ currentPurse: -5 }) },
    })
    const result = validateSessionState(state)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/negative purse/i)
  })

  it('rejects negative overseas count — corrupted state', () => {
    const state = makeGameState({
      teamStates: { ...makeTeamStates(), MI: makeTeamState({ overseasCount: -1 }) },
    })
    const result = validateSessionState(state)
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/negative overseas/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateTrade
// ─────────────────────────────────────────────────────────────────────────────

describe('validateTrade', () => {
  const cskPlayer = SOLD_PLAYER('csk-p1', 5.0)
  const miPlayer  = { ...SOLD_PLAYER('mi-p1', 4.0), soldTo: 'MI' as const }

  const tradeState = makeGameState({
    phase: 'trade-window',
    teamStates: {
      ...makeTeamStates(),
      CSK: makeTeamState({ currentPurse: 20, squad: [cskPlayer] }),
      MI:  makeTeamState({ currentPurse: 20, squad: [miPlayer] }),
    },
  })

  it('accepts a valid player-for-player trade', () => {
    const result = validateTrade(tradeState, makeDataset(), {
      legs: [
        { teamId: 'CSK', playerIds: ['csk-p1'], cashAmount: 0 },
        { teamId: 'MI',  playerIds: ['mi-p1'],  cashAmount: 0 },
      ],
    })
    expect(result.valid).toBe(true)
  })

  it('rejects trade when phase is not trade-window', () => {
    const state = { ...tradeState, phase: 'bidding' as const }
    const result = validateTrade(state, makeDataset(), {
      legs: [
        { teamId: 'CSK', playerIds: ['csk-p1'], cashAmount: 0 },
        { teamId: 'MI',  playerIds: ['mi-p1'],  cashAmount: 0 },
      ],
    })
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/trade window/i)
  })

  it('rejects trade when team does not own the player', () => {
    const result = validateTrade(tradeState, makeDataset(), {
      legs: [
        { teamId: 'CSK', playerIds: ['ghost-player'], cashAmount: 0 },
        { teamId: 'MI',  playerIds: ['mi-p1'], cashAmount: 0 },
      ],
    })
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/does not own/i)
  })

  it('rejects trade with negative cash amount', () => {
    const result = validateTrade(tradeState, makeDataset(), {
      legs: [
        { teamId: 'CSK', playerIds: ['csk-p1'], cashAmount: -5 },
        { teamId: 'MI',  playerIds: ['mi-p1'],  cashAmount: 0 },
      ],
    })
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/cannot be negative/i)
  })

  it('rejects when giving team does not have enough cash', () => {
    const state = makeGameState({
      phase: 'trade-window',
      teamStates: {
        ...makeTeamStates(),
        CSK: makeTeamState({ currentPurse: 1, squad: [cskPlayer] }),
        MI:  makeTeamState({ currentPurse: 20, squad: [miPlayer] }),
      },
    })
    const result = validateTrade(state, makeDataset(), {
      legs: [
        { teamId: 'CSK', playerIds: [],        cashAmount: 10 },
        { teamId: 'MI',  playerIds: ['mi-p1'], cashAmount: 0 },
      ],
    })
    expect(result.valid).toBe(false)
    expect(result.valid ? '' : result.reason).toMatch(/does not have/i)
  })
})
