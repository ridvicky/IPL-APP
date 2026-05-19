import type { AuctionDataset } from '@/types/dataset'
import type { PlayerRecord } from '@/types/player'
import { validateDataset } from './datasetValidator'

const cache = new Map<number, AuctionDataset>()

/**
 * Load and validate an auction dataset for the given year.
 * Throws if the dataset is missing or invalid.
 * Results are cached in memory — datasets are immutable after load.
 */
export async function loadDataset(year: number): Promise<AuctionDataset> {
  if (cache.has(year)) {
    return cache.get(year)!
  }

  let raw: unknown
  try {
    // Dynamic import — Vite bundles JSON files in src/data/datasets/
    const mod = await import(`../data/datasets/ipl${year}.json`)
    raw = mod.default
  } catch {
    throw new Error(
      `Dataset for IPL ${year} not found. ` +
      `Expected file: src/data/datasets/ipl${year}.json`,
    )
  }

  const result = validateDataset(raw)
  if (!result.valid) {
    throw new Error(`IPL ${year} dataset is invalid: ${result.reason}`)
  }

  const dataset = raw as AuctionDataset
  cache.set(year, dataset)
  return dataset
}

/**
 * Returns players for a given set name, sorted by auctionSetOrder.
 * Merges in any released retained players that belong to this set.
 * Released retained players are appended after the regular pool (order 9999+).
 */
export function getPlayersInSet(
  dataset: AuctionDataset,
  setName: string,
  releasedPlayers: PlayerRecord[] = [],
): PlayerRecord[] {
  const regular = dataset.players
    .filter(p => p.auctionSet === setName)
    .sort((a, b) => a.auctionSetOrder - b.auctionSetOrder)

  const released = releasedPlayers
    .filter(p => p.auctionSet === setName)
    .sort((a, b) => (a.auctionSetOrder ?? 9999) - (b.auctionSetOrder ?? 9999))

  return [...regular, ...released]
}

/**
 * Computes which auction set a released retained player should join.
 * High-value retained players (≥ 10 Cr) go to Marquee Set A (Indian) or
 * Marquee Set B (Overseas) — same treatment as star signings in real IPL.
 * Lower-value retentions join their role/nationality set.
 */
export function getReleasedPlayerSet(
  role: 'BAT' | 'BWL' | 'AR' | 'WK',
  isOverseas: boolean,
  bowlingType?: 'pace' | 'spin',
  retentionPrice?: number,
): string {
  if (retentionPrice !== undefined && retentionPrice >= 10) {
    return isOverseas ? 'Marquee Set B' : 'Marquee Set A'
  }
  if (isOverseas) {
    if (role === 'BAT') return 'Overseas Batters'
    if (role === 'WK')  return 'Overseas Wicket-Keepers'
    if (role === 'AR')  return 'Overseas All-Rounders'
    if (role === 'BWL') return bowlingType === 'spin' ? 'Overseas Spinners' : 'Overseas Fast Bowlers'
  } else {
    if (role === 'BAT') return 'Indian Batters'
    if (role === 'WK')  return 'Indian Wicket-Keepers'
    if (role === 'AR')  return 'Indian All-Rounders'
    if (role === 'BWL') return bowlingType === 'spin' ? 'Indian Spinners' : 'Indian Fast Bowlers'
  }
  return 'Accelerated Set'
}

/** Returns a player by ID. Throws if not found. */
export function getPlayerById(dataset: AuctionDataset, playerId: string) {
  const player = dataset.players.find(p => p.playerId === playerId)
  if (!player) throw new Error(`Player ${playerId} not found in dataset`)
  return player
}

/** Returns the bid increment for a given current price */
export function getBidIncrement(dataset: AuctionDataset, currentPrice: number): number {
  const sorted = [...dataset.bidIncrements].sort((a, b) => b.fromPrice - a.fromPrice)
  for (const band of sorted) {
    if (currentPrice >= band.fromPrice) return band.step
  }
  // Fallback to smallest step
  return dataset.bidIncrements[0]?.step ?? 0.05
}
