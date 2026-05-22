/**
 * Retention Engine — applies pre-auction player retentions to team states.
 *
 * Three modes:
 *   historical  — loads real retention data from the dataset (IPL 2025 actual retentions)
 *   custom      — user-defined retention config validated by Rule Engine
 *   none        — full auction from scratch, no retentions
 */

import type { AuctionDataset } from '@/types/dataset'
import type { TeamId, TeamState } from '@/types/team'
import type { RetentionConfig, RetentionMode } from '@/types/retention'
import type { SoldPlayerRecord } from '@/types/player'
import { validateRetention } from '@/engine/ruleEngine'

export interface RetentionResult {
  teamStates: Record<TeamId, TeamState>
  errors: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Historical retention
// ─────────────────────────────────────────────────────────────────────────────

export function applyHistoricalRetentions(dataset: AuctionDataset): RetentionResult {
  const errors: string[] = []
  const teamStates: Partial<Record<TeamId, TeamState>> = {}

  for (const teamId of dataset.teams) {
    const record = dataset.historicalRetentions?.find(r => r.teamId === teamId)

    if (!record) {
      teamStates[teamId] = makeEmptyTeamState(dataset.startingPurse[teamId] ?? 0)
      continue
    }

    const squad: SoldPlayerRecord[] = []
    let overseasCount = 0

    for (const rp of record.retainedPlayers) {
      // Retained players are removed from the auction pool — look up for full details,
      // but fall back to a minimal record if not present (legacy datasets).
      const player = dataset.players.find(p => p.playerId === rp.playerId)
      const soldRecord: SoldPlayerRecord = player
        ? { ...player, soldPrice: rp.retentionPrice, soldTo: teamId, isRetained: true }
        : {
            playerId: rp.playerId,
            name: rp.name ?? rp.playerId,
            role: rp.role,
            nationality: rp.isOverseas ? 'overseas' : 'indian',
            country: rp.isOverseas ? 'Unknown' : 'India',
            cappedStatus: 'capped',
            isOverseas: rp.isOverseas,
            basePrice: rp.retentionPrice,
            auctionSet: '',
            auctionSetOrder: 0,
            previousTeam: teamId,
            rtmEligibleFor: null,
            soldPrice: rp.retentionPrice,
            soldTo: teamId,
            isRetained: true,
          }
      squad.push(soldRecord)
      if (rp.isOverseas) overseasCount++
    }

    teamStates[teamId] = {
      currentPurse: record.purseAfterRetention,
      squad,
      rtmSlotsAvailable: record.rtmSlotsAvailable,
      rtmSlotsUsed: 0,
      overseasCount,
    }
  }

  return { teamStates: teamStates as Record<TeamId, TeamState>, errors }
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom retention
// ─────────────────────────────────────────────────────────────────────────────

export function applyCustomRetentions(
  dataset: AuctionDataset,
  configs: Map<TeamId, RetentionConfig>,
): RetentionResult {
  const errors: string[] = []
  const teamStates: Partial<Record<TeamId, TeamState>> = {}

  for (const teamId of dataset.teams) {
    const config = configs.get(teamId)

    if (!config || config.retainedPlayers.length === 0) {
      teamStates[teamId] = makeEmptyTeamState(dataset.startingPurse[teamId] ?? 0)
      continue
    }

    const validation = validateRetention(dataset, teamId, config)
    if (!validation.valid) {
      errors.push(`[${teamId}] ${validation.reason}`)
      teamStates[teamId] = makeEmptyTeamState(dataset.startingPurse[teamId] ?? 0)
      continue
    }

    const squad: SoldPlayerRecord[] = []
    let overseasCount = 0
    let totalDeduction = 0

    for (const rp of config.retainedPlayers) {
      const player = dataset.players.find(p => p.playerId === rp.playerId)!
      squad.push({ ...player, soldPrice: rp.retentionPrice, soldTo: teamId, isRetained: true })
      if (player.isOverseas) overseasCount++
      totalDeduction += rp.retentionPrice
    }

    teamStates[teamId] = {
      currentPurse: (dataset.startingPurse[teamId] ?? 0) - totalDeduction,
      squad,
      rtmSlotsAvailable: config.rtmSlotsAvailable,
      rtmSlotsUsed: 0,
      overseasCount,
    }
  }

  return { teamStates: teamStates as Record<TeamId, TeamState>, errors }
}

// ─────────────────────────────────────────────────────────────────────────────
// No retention
// ─────────────────────────────────────────────────────────────────────────────

export function applyNoRetentions(dataset: AuctionDataset): RetentionResult {
  const teamStates: Partial<Record<TeamId, TeamState>> = {}
  for (const teamId of dataset.teams) {
    teamStates[teamId] = makeEmptyTeamState(dataset.startingPurse[teamId] ?? 0)
  }
  return { teamStates: teamStates as Record<TeamId, TeamState>, errors: [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

export function applyRetentions(
  dataset: AuctionDataset,
  mode: RetentionMode,
  customConfigs?: Map<TeamId, RetentionConfig>,
): RetentionResult {
  switch (mode) {
    case 'historical': return applyHistoricalRetentions(dataset)
    case 'custom': return applyCustomRetentions(dataset, customConfigs ?? new Map())
    case 'none': return applyNoRetentions(dataset)
  }
}

function makeEmptyTeamState(startingPurse: number): TeamState {
  return {
    currentPurse: startingPurse,
    squad: [],
    rtmSlotsAvailable: 0,
    rtmSlotsUsed: 0,
    overseasCount: 0,
  }
}
