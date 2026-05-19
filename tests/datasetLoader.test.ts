import { describe, it, expect } from 'vitest'
import { getBidIncrement, getPlayersInSet, getReleasedPlayerSet } from '../src/dataset/datasetLoader'
import { makeDataset, INDIAN_BATTER, OVERSEAS_BOWLER } from './fixtures'
import type { PlayerRecord } from '../src/types/player'

// ─────────────────────────────────────────────────────────────────────────────
// getBidIncrement
// ─────────────────────────────────────────────────────────────────────────────

describe('getBidIncrement', () => {
  const dataset = makeDataset()

  it('returns 0.05 for price below ₹1 Cr', () => {
    expect(getBidIncrement(dataset, 0.00)).toBe(0.05)
    expect(getBidIncrement(dataset, 0.50)).toBe(0.05)
  })

  it('returns 0.10 for price ₹1–2 Cr', () => {
    expect(getBidIncrement(dataset, 1.00)).toBe(0.10)
    expect(getBidIncrement(dataset, 1.50)).toBe(0.10)
  })

  it('returns 0.25 for price ₹2–5 Cr', () => {
    expect(getBidIncrement(dataset, 2.00)).toBe(0.25)
    expect(getBidIncrement(dataset, 4.00)).toBe(0.25)
  })

  it('returns 0.50 for price ₹5–10 Cr', () => {
    expect(getBidIncrement(dataset, 5.00)).toBe(0.50)
    expect(getBidIncrement(dataset, 9.50)).toBe(0.50)
  })

  it('returns 1.00 for price ₹10–20 Cr', () => {
    expect(getBidIncrement(dataset, 10.00)).toBe(1.00)
    expect(getBidIncrement(dataset, 15.00)).toBe(1.00)
  })

  it('returns 2.00 for price ₹20+ Cr', () => {
    expect(getBidIncrement(dataset, 20.00)).toBe(2.00)
    expect(getBidIncrement(dataset, 50.00)).toBe(2.00)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getPlayersInSet
// ─────────────────────────────────────────────────────────────────────────────

describe('getPlayersInSet', () => {
  const dataset = makeDataset()

  it('returns only players from the named set', () => {
    const players = getPlayersInSet(dataset, 'Indian Batters')
    expect(players.every(p => p.auctionSet === 'Indian Batters')).toBe(true)
  })

  it('returns players sorted by auctionSetOrder', () => {
    const players = getPlayersInSet(dataset, 'Indian Batters')
    for (let i = 1; i < players.length; i++) {
      expect(players[i].auctionSetOrder).toBeGreaterThanOrEqual(players[i - 1].auctionSetOrder)
    }
  })

  it('returns empty array for unknown set', () => {
    expect(getPlayersInSet(dataset, 'Nonexistent Set')).toHaveLength(0)
  })

  it('merges released retained players at the end', () => {
    const released: PlayerRecord[] = [{
      ...OVERSEAS_BOWLER,
      auctionSet: 'Indian Batters',
      auctionSetOrder: 9999,
    }]
    const players = getPlayersInSet(dataset, 'Indian Batters', released)
    expect(players[players.length - 1].playerId).toBe(OVERSEAS_BOWLER.playerId)
  })

  it('does not include released players for the wrong set', () => {
    const released: PlayerRecord[] = [{
      ...OVERSEAS_BOWLER,
      auctionSet: 'Overseas Fast Bowlers',
      auctionSetOrder: 9999,
    }]
    const players = getPlayersInSet(dataset, 'Indian Batters', released)
    expect(players.some(p => p.playerId === OVERSEAS_BOWLER.playerId)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getReleasedPlayerSet
// ─────────────────────────────────────────────────────────────────────────────

describe('getReleasedPlayerSet', () => {
  it('routes Indian player with ≥10 Cr retention to Marquee Set A', () => {
    expect(getReleasedPlayerSet('BAT', false, undefined, 14)).toBe('Marquee Set A')
    expect(getReleasedPlayerSet('BWL', false, 'pace', 10)).toBe('Marquee Set A')
  })

  it('routes Overseas player with ≥10 Cr retention to Marquee Set B', () => {
    expect(getReleasedPlayerSet('BAT', true, undefined, 18)).toBe('Marquee Set B')
    expect(getReleasedPlayerSet('BWL', true, 'pace', 11)).toBe('Marquee Set B')
  })

  it('routes Indian BAT with <10 Cr to Indian Batters', () => {
    expect(getReleasedPlayerSet('BAT', false, undefined, 5)).toBe('Indian Batters')
  })

  it('routes Indian WK to Indian Wicket-Keepers', () => {
    expect(getReleasedPlayerSet('WK', false)).toBe('Indian Wicket-Keepers')
  })

  it('routes Indian AR to Indian All-Rounders', () => {
    expect(getReleasedPlayerSet('AR', false)).toBe('Indian All-Rounders')
  })

  it('routes Indian pace bowler to Indian Fast Bowlers', () => {
    expect(getReleasedPlayerSet('BWL', false, 'pace')).toBe('Indian Fast Bowlers')
  })

  it('routes Indian spinner to Indian Spinners', () => {
    expect(getReleasedPlayerSet('BWL', false, 'spin')).toBe('Indian Spinners')
  })

  it('routes Overseas BAT to Overseas Batters', () => {
    expect(getReleasedPlayerSet('BAT', true, undefined, 5)).toBe('Overseas Batters')
  })

  it('routes Overseas WK to Overseas Wicket-Keepers', () => {
    expect(getReleasedPlayerSet('WK', true)).toBe('Overseas Wicket-Keepers')
  })

  it('routes Overseas pace bowler to Overseas Fast Bowlers', () => {
    expect(getReleasedPlayerSet('BWL', true, 'pace', 5)).toBe('Overseas Fast Bowlers')
  })

  it('routes Overseas spinner to Overseas Spinners', () => {
    expect(getReleasedPlayerSet('BWL', true, 'spin', 5)).toBe('Overseas Spinners')
  })

  it('routes Overseas AR to Overseas All-Rounders', () => {
    expect(getReleasedPlayerSet('AR', true, undefined, 5)).toBe('Overseas All-Rounders')
  })
})
