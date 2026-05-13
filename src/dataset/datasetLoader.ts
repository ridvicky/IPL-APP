import type { AuctionDataset } from '@/types/dataset'
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

/** Returns players for a given set name, sorted by auctionSetOrder */
export function getPlayersInSet(dataset: AuctionDataset, setName: string) {
  return dataset.players
    .filter(p => p.auctionSet === setName)
    .sort((a, b) => a.auctionSetOrder - b.auctionSetOrder)
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
