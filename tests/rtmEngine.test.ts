import { describe, it, expect } from 'vitest'
import { runRTMDecision, findRTMEligibleTeam } from '../src/engine/rtmEngine'
import {
  makeDataset, makeGameState, makeTeamState, makeTeamStates,
  makeBidState, RTM_PLAYER, INDIAN_BATTER,
} from './fixtures'

// Common RTM state: player sold to MI at 5.00 Cr, CSK has RTM right
function makeRTMState(pricePaid = 5.0) {
  return makeGameState({
    phase: 'rtm-decision',
    currentSetIndex: 0,
    currentPlayerIndex: 1, // RTM_PLAYER is index 1 in fixture dataset
    currentBidState: makeBidState({
      currentBid: pricePaid,
      currentLeader: 'MI',
      rtmPending: 'CSK',
      teamsPassed: [],
    }),
    teamStates: {
      ...makeTeamStates(),
      CSK: makeTeamState({ currentPurse: 20, rtmSlotsAvailable: 1, rtmSlotsUsed: 0 }),
      MI:  makeTeamState({ currentPurse: 30 }),
    },
  })
}

const rtmDataset = makeDataset({ players: [INDIAN_BATTER, RTM_PLAYER] })

// ─────────────────────────────────────────────────────────────────────────────
// runRTMDecision
// ─────────────────────────────────────────────────────────────────────────────

describe('runRTMDecision', () => {
  it('returns a decision object for a valid RTM opportunity', () => {
    const result = runRTMDecision(makeRTMState(), rtmDataset, 'CSK', RTM_PLAYER)
    expect(typeof result.exercisesRTM).toBe('boolean')
    expect(result.teamId).toBe('CSK')
    expect(typeof result.reasoning).toBe('string')
  })

  it('does not exercise RTM when team has no RTM slots', () => {
    const state = makeRTMState()
    state.teamStates['CSK'] = makeTeamState({
      currentPurse: 20,
      rtmSlotsAvailable: 1,
      rtmSlotsUsed: 1, // all used
    })
    const result = runRTMDecision(state, rtmDataset, 'CSK', RTM_PLAYER)
    expect(result.exercisesRTM).toBe(false)
  })

  it('does not exercise RTM when team cannot afford the price', () => {
    const state = makeRTMState(15.0) // price 15 Cr
    state.teamStates['CSK'] = makeTeamState({
      currentPurse: 1.00, // can't afford 15
      rtmSlotsAvailable: 1,
      rtmSlotsUsed: 0,
    })
    const result = runRTMDecision(state, rtmDataset, 'CSK', RTM_PLAYER)
    expect(result.exercisesRTM).toBe(false)
  })

  it('does not exercise RTM when RTM is not available in dataset', () => {
    const dataset = makeDataset({ rtmAvailable: false, players: [INDIAN_BATTER, RTM_PLAYER] })
    const result = runRTMDecision(makeRTMState(), dataset, 'CSK', RTM_PLAYER)
    expect(result.exercisesRTM).toBe(false)
    expect(result.reasoning).toMatch(/rule engine blocked/i)
  })

  it('LLM zero interest overrides high baseline desire', () => {
    const lowInterest = { interestLevel: 0, suggestedMaxBid: 0, emotionalTriggers: [], ownerComment: '' }
    const result = runRTMDecision(makeRTMState(), rtmDataset, 'CSK', RTM_PLAYER, lowInterest)
    expect(result.exercisesRTM).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// findRTMEligibleTeam
// ─────────────────────────────────────────────────────────────────────────────

describe('findRTMEligibleTeam', () => {
  it('returns the eligible team for a player with RTM rights', () => {
    const state = makeGameState({
      teamStates: {
        ...makeTeamStates(),
        CSK: makeTeamState({ rtmSlotsAvailable: 1, rtmSlotsUsed: 0 }),
      },
    })
    const result = findRTMEligibleTeam(state, rtmDataset, RTM_PLAYER, 'MI')
    expect(result).toBe('CSK')
  })

  it('returns null when winning team IS the RTM-eligible team', () => {
    // CSK won the bid — cannot RTM their own purchase
    const state = makeGameState({
      teamStates: {
        ...makeTeamStates(),
        CSK: makeTeamState({ rtmSlotsAvailable: 1, rtmSlotsUsed: 0 }),
      },
    })
    const result = findRTMEligibleTeam(state, rtmDataset, RTM_PLAYER, 'CSK')
    expect(result).toBeNull()
  })

  it('returns null when the player has no RTM eligibility', () => {
    const result = findRTMEligibleTeam(makeGameState(), rtmDataset, INDIAN_BATTER, 'MI')
    expect(result).toBeNull()
  })

  it('returns null when RTM is not available in the dataset', () => {
    const dataset = makeDataset({ rtmAvailable: false, players: [INDIAN_BATTER, RTM_PLAYER] })
    const result = findRTMEligibleTeam(makeGameState(), dataset, RTM_PLAYER, 'MI')
    expect(result).toBeNull()
  })

  it('returns null when eligible team has no RTM slots remaining', () => {
    const state = makeGameState({
      teamStates: {
        ...makeTeamStates(),
        CSK: makeTeamState({ rtmSlotsAvailable: 1, rtmSlotsUsed: 1 }), // all used
      },
    })
    const result = findRTMEligibleTeam(state, rtmDataset, RTM_PLAYER, 'MI')
    expect(result).toBeNull()
  })
})
