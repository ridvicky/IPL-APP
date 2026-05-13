import type { ValidationResult } from '@/types/validation'
import { ALL_TEAM_IDS } from '@/types/team'

export function validateDataset(dataset: unknown): ValidationResult {
  if (!dataset || typeof dataset !== 'object') {
    return { valid: false, reason: 'Dataset must be a JSON object' }
  }

  const d = dataset as Record<string, unknown>

  // ── Top-level required fields ──────────────────────────────────────────────
  if (typeof d['year'] !== 'number' || d['year'] < 2008) {
    return { valid: false, reason: 'year must be a number >= 2008' }
  }
  if (d['auctionType'] !== 'mega' && d['auctionType'] !== 'mini') {
    return { valid: false, reason: 'auctionType must be "mega" or "mini"' }
  }
  if (typeof d['displayName'] !== 'string' || !d['displayName']) {
    return { valid: false, reason: 'displayName is required' }
  }

  // ── Teams ─────────────────────────────────────────────────────────────────
  if (!Array.isArray(d['teams']) || (d['teams'] as unknown[]).length === 0) {
    return { valid: false, reason: 'teams must be a non-empty array' }
  }
  for (const t of d['teams'] as unknown[]) {
    if (!ALL_TEAM_IDS.includes(t as never)) {
      return { valid: false, reason: `Unknown team id: ${String(t)}` }
    }
  }
  const teams = d['teams'] as string[]

  // ── Starting purse ────────────────────────────────────────────────────────
  if (!d['startingPurse'] || typeof d['startingPurse'] !== 'object') {
    return { valid: false, reason: 'startingPurse must be an object' }
  }
  for (const teamId of teams) {
    const purse = (d['startingPurse'] as Record<string, unknown>)[teamId]
    if (typeof purse !== 'number' || purse <= 0) {
      return { valid: false, reason: `startingPurse.${teamId} must be a positive number` }
    }
  }

  // ── Squad limits ──────────────────────────────────────────────────────────
  const numFields: [string, number][] = [
    ['minimumSquadSize', 1],
    ['maximumSquadSize', 1],
    ['overseasLimit', 1],
    ['maxRTMPerTeam', 0],
    ['maxRetainedPlayers', 0],
    ['maxOverseasRetained', 0],
  ]
  for (const [field, min] of numFields) {
    if (typeof d[field] !== 'number' || (d[field] as number) < min) {
      return { valid: false, reason: `${field} must be a number >= ${min}` }
    }
  }
  if (typeof d['rtmAvailable'] !== 'boolean') {
    return { valid: false, reason: 'rtmAvailable must be boolean' }
  }
  if (typeof d['retentionAllowed'] !== 'boolean') {
    return { valid: false, reason: 'retentionAllowed must be boolean' }
  }
  if (typeof d['acceleratedRoundEnabled'] !== 'boolean') {
    return { valid: false, reason: 'acceleratedRoundEnabled must be boolean' }
  }

  // ── Bid increments ────────────────────────────────────────────────────────
  if (!Array.isArray(d['bidIncrements']) || (d['bidIncrements'] as unknown[]).length === 0) {
    return { valid: false, reason: 'bidIncrements must be a non-empty array' }
  }
  for (const band of d['bidIncrements'] as unknown[]) {
    const b = band as Record<string, unknown>
    if (typeof b['fromPrice'] !== 'number' || typeof b['step'] !== 'number') {
      return { valid: false, reason: 'Each bidIncrements entry needs fromPrice and step (numbers)' }
    }
  }

  // ── Auction sets ──────────────────────────────────────────────────────────
  if (!Array.isArray(d['auctionSets']) || (d['auctionSets'] as unknown[]).length === 0) {
    return { valid: false, reason: 'auctionSets must be a non-empty array of strings' }
  }

  // ── Players ───────────────────────────────────────────────────────────────
  if (!Array.isArray(d['players']) || (d['players'] as unknown[]).length === 0) {
    return { valid: false, reason: 'players must be a non-empty array' }
  }

  const seenIds = new Set<string>()
  const validRoles = new Set(['BAT', 'BWL', 'AR', 'WK'])
  const validNationalities = new Set(['indian', 'overseas'])
  const validCapped = new Set(['capped', 'uncapped'])
  const setNames = new Set(d['auctionSets'] as string[])

  for (let i = 0; i < (d['players'] as unknown[]).length; i++) {
    const p = (d['players'] as Record<string, unknown>[])[i]
    const prefix = `players[${i}] (${String(p?.['name'] ?? 'unknown')})`

    if (typeof p['playerId'] !== 'string' || !p['playerId']) {
      return { valid: false, reason: `${prefix}: playerId is required` }
    }
    if (seenIds.has(p['playerId'] as string)) {
      return { valid: false, reason: `${prefix}: duplicate playerId "${p['playerId']}"` }
    }
    seenIds.add(p['playerId'] as string)

    if (typeof p['name'] !== 'string' || !p['name']) {
      return { valid: false, reason: `${prefix}: name is required` }
    }
    if (!validRoles.has(p['role'] as string)) {
      return { valid: false, reason: `${prefix}: role must be BAT/BWL/AR/WK` }
    }
    if (!validNationalities.has(p['nationality'] as string)) {
      return { valid: false, reason: `${prefix}: nationality must be "indian" or "overseas"` }
    }
    if (!validCapped.has(p['cappedStatus'] as string)) {
      return { valid: false, reason: `${prefix}: cappedStatus must be "capped" or "uncapped"` }
    }
    if (typeof p['isOverseas'] !== 'boolean') {
      return { valid: false, reason: `${prefix}: isOverseas must be boolean` }
    }
    if (typeof p['basePrice'] !== 'number' || (p['basePrice'] as number) <= 0) {
      return { valid: false, reason: `${prefix}: basePrice must be a positive number` }
    }
    if (!setNames.has(p['auctionSet'] as string)) {
      return { valid: false, reason: `${prefix}: auctionSet "${p['auctionSet']}" is not in auctionSets list` }
    }
    if (typeof p['auctionSetOrder'] !== 'number' || (p['auctionSetOrder'] as number) < 1) {
      return { valid: false, reason: `${prefix}: auctionSetOrder must be >= 1` }
    }
    if (p['previousTeam'] !== null && typeof p['previousTeam'] !== 'string') {
      return { valid: false, reason: `${prefix}: previousTeam must be a string or null` }
    }
    if (p['rtmEligibleFor'] !== null && typeof p['rtmEligibleFor'] !== 'string') {
      return { valid: false, reason: `${prefix}: rtmEligibleFor must be a string or null` }
    }
  }

  return { valid: true }
}
