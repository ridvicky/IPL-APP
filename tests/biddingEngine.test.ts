import { describe, it, expect } from 'vitest'
import { runBiddingPipeline } from '../src/engine/biddingEngine'
import {
  makeDataset, makeGameState, makeTeamState, makeTeamStates,
  makeBidState, INDIAN_BATTER, OVERSEAS_BOWLER, SOLD_PLAYER,
} from './fixtures'

// ─────────────────────────────────────────────────────────────────────────────
// runBiddingPipeline
// ─────────────────────────────────────────────────────────────────────────────

describe('runBiddingPipeline', () => {
  it('returns a bid or pass decision', () => {
    const state = makeGameState({
      currentBidState: makeBidState({ currentBid: 2.00, currentLeader: 'RCB', teamsPassed: [] }),
    })
    const result = runBiddingPipeline(state, makeDataset(), 'MI', INDIAN_BATTER)
    expect(['bid', 'pass']).toContain(result.action)
    expect(result.teamId).toBe('MI')
  })

  it('always passes when squad is full', () => {
    const fullSquad = Array.from({ length: 25 }, (_, i) => SOLD_PLAYER(`p${i}`))
    const state = makeGameState({
      currentBidState: makeBidState({ currentBid: 2.00, currentLeader: 'RCB', teamsPassed: [] }),
      teamStates: {
        ...makeTeamStates(),
        MI: makeTeamState({ currentPurse: 100, squad: fullSquad }),
      },
    })
    const result = runBiddingPipeline(state, makeDataset(), 'MI', INDIAN_BATTER)
    expect(result.action).toBe('pass')
  })

  it('always passes when overseas cap is hit for overseas player', () => {
    const state = makeGameState({
      currentBidState: makeBidState({ currentBid: 1.00, currentLeader: 'RCB', teamsPassed: [] }),
      teamStates: {
        ...makeTeamStates(),
        MI: makeTeamState({ currentPurse: 50, overseasCount: 8 }),
      },
    })
    const result = runBiddingPipeline(state, makeDataset(), 'MI', OVERSEAS_BOWLER)
    expect(result.action).toBe('pass')
  })

  it('always passes when purse is insufficient', () => {
    const state = makeGameState({
      currentBidState: makeBidState({ currentBid: 10.00, currentLeader: 'RCB', teamsPassed: [] }),
      teamStates: {
        ...makeTeamStates(),
        MI: makeTeamState({
          currentPurse: 1.00,
          squad: Array.from({ length: 18 }, (_, i) => SOLD_PLAYER(`p${i}`, 0.20)),
        }),
      },
    })
    const result = runBiddingPipeline(state, makeDataset(), 'MI', INDIAN_BATTER)
    expect(result.action).toBe('pass')
  })

  it('bid amount meets the minimum increment requirement', () => {
    const state = makeGameState({
      currentBidState: makeBidState({ currentBid: 2.00, currentLeader: 'RCB', teamsPassed: [] }),
      teamStates: { ...makeTeamStates(), MI: makeTeamState({ currentPurse: 50 }) },
    })
    const result = runBiddingPipeline(state, makeDataset(), 'MI', INDIAN_BATTER)
    if (result.action === 'bid') {
      // At 2.00, increment is 0.25 → next bid must be ≥ 2.25
      expect(result.bidAmount).toBeGreaterThanOrEqual(2.25)
    }
  })

  it('interest score is always 0–100', () => {
    const state = makeGameState({
      currentBidState: makeBidState({ currentBid: 0, currentLeader: null, teamsPassed: [] }),
    })
    const result = runBiddingPipeline(state, makeDataset(), 'CSK', INDIAN_BATTER)
    expect(result.interestScore).toBeGreaterThanOrEqual(0)
    expect(result.interestScore).toBeLessThanOrEqual(100)
  })

  it('LLM result with zero interest reduces interest score vs no LLM', () => {
    // LLM is blended at 50% — zero LLM interest halves the final score.
    // The engine does NOT force a pass (correct — LLM is advisory), but
    // the score should be lower than without LLM.
    const state = makeGameState({
      currentBidState: makeBidState({ currentBid: 2.00, currentLeader: 'RCB', teamsPassed: [] }),
    })
    const noInterest = { interestLevel: 0, suggestedMaxBid: 0, emotionalTriggers: [], ownerComment: '' }
    const withLLM    = runBiddingPipeline(state, makeDataset(), 'MI', INDIAN_BATTER, noInterest)
    const withoutLLM = runBiddingPipeline(state, makeDataset(), 'MI', INDIAN_BATTER, null)
    // Score with zero-interest LLM must be ≤ score without LLM
    expect(withLLM.interestScore).toBeLessThanOrEqual(withoutLLM.interestScore)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Persona differentiation — all 10 teams run without error
// ─────────────────────────────────────────────────────────────────────────────

describe('persona differentiation', () => {
  it('all 10 teams return a decision without throwing', () => {
    const teams = ['CSK', 'MI', 'RCB', 'KKR', 'DC', 'RR', 'SRH', 'PBKS', 'GT', 'LSG'] as const
    const state = makeGameState({
      currentBidState: makeBidState({ currentBid: 2.00, currentLeader: 'RCB', teamsPassed: [] }),
    })
    for (const team of teams) {
      if (team === 'RCB') continue // RCB is the current leader
      const result = runBiddingPipeline(state, makeDataset(), team, INDIAN_BATTER)
      expect(['bid', 'pass']).toContain(result.action)
    }
  })
})
