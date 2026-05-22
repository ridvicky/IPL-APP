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

  // Map finalPrice → marketValue so bidding engine has real auction prices as anchors
  for (const player of dataset.players) {
    const raw_player = player as PlayerRecord & { finalPrice?: number }
    if (raw_player.finalPrice != null && (player.marketValue == null)) {
      player.marketValue = raw_player.finalPrice
    }
  }

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

/**
 * Returns comparable real sales for a player — retained/RTM players from the same dataset
 * with known finalPrice, filtered by role and similarity. Used to ground LLM valuations.
 */
export function getComparableSales(
  dataset: AuctionDataset,
  player: { role: string; isOverseas: boolean; cappedStatus: string; basePrice: number },
  maxResults = 5,
): { name: string; finalPrice: number; isOverseas: boolean; cappedStatus: string }[] {
  type RawPlayer = {
    role: string; isOverseas: boolean; cappedStatus: string; basePrice: number
    finalPrice?: number | null; name: string; auctionStatus: string
  }

  const raw = dataset.players as unknown as RawPlayer[]
  const withPrice = raw.filter(p => (p.finalPrice ?? 0) > 0 && p.auctionStatus === 'sold')

  // Score each candidate by similarity — same role required, then bonus for nationality/tier/price range
  const scored = withPrice
    .filter(p => p.role === player.role)
    .map(p => {
      let score = 0
      if (p.isOverseas === player.isOverseas) score += 3
      if (p.cappedStatus === player.cappedStatus) score += 2
      // Prefer players in a similar base-price band (within 2× of each other)
      const ratio = Math.max(p.basePrice, player.basePrice) / Math.min(p.basePrice, player.basePrice)
      if (ratio <= 1.5) score += 2
      else if (ratio <= 3) score += 1
      return { p, score }
    })
    .sort((a, b) => b.score !== a.score ? b.score - a.score : (b.p.finalPrice ?? 0) - (a.p.finalPrice ?? 0))
    .slice(0, maxResults)
    .map(({ p }) => ({
      name: p.name,
      finalPrice: p.finalPrice!,
      isOverseas: p.isOverseas,
      cappedStatus: p.cappedStatus,
    }))

  return scored
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
