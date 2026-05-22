/**
 * Player Importance Profiler — rich importance scoring for trade evaluation.
 *
 * Signals:
 *  - Captaincy (current captain, vice-captain, captaincy potential)
 *  - Years of association / loyalty tier
 *  - Role criticality (sole WK, thin pace attack, etc.)
 *  - Market value vs league percentile
 *  - Star power & fanbase value
 *  - Replaceability estimate
 */

import type { SoldPlayerRecord } from '@/types/player'
import type { TeamState } from '@/types/team'
import type { SeasonSetup } from '@/types/season'

export type LoyaltyTier    = 'icon' | 'loyal' | 'familiar' | 'new'
export type MarketTier     = 'elite' | 'star' | 'solid' | 'budget'
export type StarPower      = 'superstar' | 'known' | 'prospect' | 'journeyman'
export type CaptaincyRole  = 'captain' | 'vice-captain' | 'candidate' | 'none'

export interface PlayerImportanceProfile {
  player: SoldPlayerRecord

  // Captaincy
  captaincyRole: CaptaincyRole
  captaincyLabel: string

  // Loyalty & association
  loyaltyTier: LoyaltyTier
  loyaltyLabel: string
  isRetained: boolean
  wasRTM: boolean

  // Role & squad need
  roleCount: number
  roleCriticality: 'sole' | 'thin' | 'adequate' | 'deep'
  roleLabel: string

  // Market value
  marketTier: MarketTier
  marketLabel: string
  replacementCost: number
  leaguePercentile: number

  // Star power & fanbase
  starPower: StarPower
  starLabel: string
  fanbaseNote: string

  // Summary
  importanceScore: number          // 0–100
  narrativeSummary: string
}

// ─── Captaincy ────────────────────────────────────────────────────────────────

function captaincyRole(
  player: SoldPlayerRecord,
  teamId: string,
  seasonSetup: SeasonSetup | null,
): CaptaincyRole {
  if (seasonSetup) {
    // User team — check against actual setup
    if (seasonSetup.captainPlayerId === player.playerId) return 'captain'
    if (seasonSetup.viceCaptainPlayerId === player.playerId) return 'vice-captain'
  }

  // Opponent captains from opponent setups
  if (seasonSetup?.opponentSetups[teamId as keyof typeof seasonSetup.opponentSetups]?.captainPlayerId === player.playerId) {
    return 'captain'
  }

  // Captaincy potential: capped Indian batter/AR with elite price
  if (
    player.cappedStatus === 'capped' &&
    !player.isOverseas &&
    (player.role === 'BAT' || player.role === 'AR') &&
    player.soldPrice >= 10
  ) return 'candidate'

  // High-value overseas: can lead as overseas captain candidate
  if (player.isOverseas && player.cappedStatus === 'capped' && player.soldPrice >= 12) return 'candidate'

  return 'none'
}

function captaincyLabel(role: CaptaincyRole, _player: SoldPlayerRecord): string {
  switch (role) {
    case 'captain':
      return `Current franchise CAPTAIN — losing them would require a complete leadership rebuild`
    case 'vice-captain':
      return `Vice-captain and leadership backup — key part of the captaincy structure`
    case 'candidate':
      return `Prime captaincy candidate — high-profile, experienced, future leader material`
    case 'none':
      return 'No specific captaincy role'
  }
}

// ─── Loyalty ──────────────────────────────────────────────────────────────────

function resolveLoyaltyTier(player: SoldPlayerRecord, teamId: string): LoyaltyTier {
  if (player.isRetained) return 'icon'
  if (player.rtmEligibleFor === teamId) return 'loyal'
  if (player.previousTeam === teamId) return 'familiar'
  return 'new'
}

function resolveLoyaltyLabel(tier: LoyaltyTier, player: SoldPlayerRecord, teamId: string): string {
  switch (tier) {
    case 'icon':
      return `Retained franchise cornerstone — highest possible loyalty bond`
    case 'loyal':
      return `RTM acquisition — was their player, fought to keep them`
    case 'familiar':
      return `Former ${player.previousTeam ?? teamId} player — emotional attachment and squad familiarity`
    case 'new':
      return `New signing this auction — no prior franchise association`
  }
}

// ─── Role criticality ─────────────────────────────────────────────────────────

function resolveRoleCriticality(
  player: SoldPlayerRecord,
  squad: SoldPlayerRecord[],
): { count: number; criticality: PlayerImportanceProfile['roleCriticality']; label: string } {
  const count = squad.filter(p => p.role === player.role && p.playerId !== player.playerId).length
  const roleName = { BAT: 'batter', BWL: 'bowler', AR: 'all-rounder', WK: 'wicketkeeper' }[player.role]

  let criticality: PlayerImportanceProfile['roleCriticality']
  let label: string

  if (player.role === 'WK') {
    if (count === 0)      { criticality = 'sole';     label = `SOLE wicketkeeper — irreplaceable in XI` }
    else if (count === 1) { criticality = 'thin';     label = `One of only 2 wicketkeepers — thin cover` }
    else                  { criticality = 'adequate'; label = `${count + 1} wicketkeepers — adequate depth` }
  } else {
    if (count <= 1)      { criticality = 'sole';     label = `Only ${count + 1} ${roleName}(s) — critically thin` }
    else if (count <= 3) { criticality = 'thin';     label = `${count + 1} ${roleName}s — below ideal depth` }
    else if (count <= 5) { criticality = 'adequate'; label = `${count + 1} ${roleName}s — adequate cover` }
    else                 { criticality = 'deep';     label = `${count + 1} ${roleName}s — well covered` }
  }

  return { count, criticality, label }
}

// ─── Market value ─────────────────────────────────────────────────────────────

function resolveMarketTier(
  soldPrice: number,
  allPrices: number[],
): { tier: MarketTier; label: string; percentile: number } {
  const sorted = [...allPrices].sort((a, b) => a - b)
  const rank = sorted.filter(p => p <= soldPrice).length
  const percentile = Math.round((rank / sorted.length) * 100)

  let tier: MarketTier
  let label: string

  // Lowered elite threshold to ₹14 Cr — retained superstars (Rohit, Bumrah, Virat, Hardik) are elite
  if (soldPrice >= 14)      { tier = 'elite';  label = `Elite — ₹${soldPrice.toFixed(2)} Cr (top ${100 - percentile}% of league)` }
  else if (soldPrice >= 8)  { tier = 'star';   label = `Star — ₹${soldPrice.toFixed(2)} Cr (top ${100 - percentile}% of league)` }
  else if (soldPrice >= 3)  { tier = 'solid';  label = `Solid — ₹${soldPrice.toFixed(2)} Cr (${percentile}th percentile)` }
  else                      { tier = 'budget'; label = `Budget — ₹${soldPrice.toFixed(2)} Cr` }

  return { tier, label, percentile }
}

function estimateReplacementCost(price: number, percentile: number): number {
  if (percentile >= 90) return price * 1.35
  if (percentile >= 75) return price * 1.18
  if (percentile >= 50) return price * 1.05
  return price * 0.90
}

// ─── Star power ───────────────────────────────────────────────────────────────

function resolveStarPower(
  player: SoldPlayerRecord,
  marketTier: MarketTier,
  captaincyRole: CaptaincyRole,
): { starPower: StarPower; starLabel: string; fanbaseNote: string } {
  const isCapped  = player.cappedStatus === 'capped'
  const isIndian  = !player.isOverseas
  const isCaptain = captaincyRole === 'captain' || captaincyRole === 'vice-captain'

  if (isCaptain && isCapped && isIndian) {
    return {
      starPower: 'superstar',
      starLabel: `Indian captain — the face of the franchise`,
      fanbaseNote: `The captain is the face of the franchise. Their presence drives jersey sales, social media engagement, and crowd turnout. Losing them sends a franchise-shaking message to the fanbase and sponsors.`,
    }
  }
  if (isCaptain) {
    return {
      starPower: 'superstar',
      starLabel: `Team captain — franchise leader on and off the field`,
      fanbaseNote: `Captains carry massive public profile. Replacing a captain mid-cycle creates instability and signals franchise disarray.`,
    }
  }
  if (isCapped && isIndian && marketTier === 'elite') {
    return {
      starPower: 'superstar',
      starLabel: `Indian superstar — one of the biggest IPL names`,
      fanbaseNote: `Massive home fanbase pull. Jersey sales, crowd energy, brand deals. Losing them is a PR and commercial hit beyond the cricket.`,
    }
  }
  if (isCapped && (marketTier === 'elite' || marketTier === 'star')) {
    return {
      starPower: 'superstar',
      starLabel: `${isIndian ? 'Indian' : 'International'} star — high-profile IPL name`,
      fanbaseNote: `Well-known, watched by millions. Significant fanbase and commercial value beyond statistics.`,
    }
  }
  if (isCapped && marketTier === 'solid') {
    return {
      starPower: 'known',
      starLabel: `Established international — recognised name`,
      fanbaseNote: `Respected by fans. Losing them weakens perceived squad quality publicly.`,
    }
  }
  if (!isCapped && marketTier === 'star') {
    return {
      starPower: 'prospect',
      starLabel: `Emerging talent — high-value uncapped player, future star potential`,
      fanbaseNote: `Fans are excited about this player's future. Trading them away risks losing a future franchise icon before they peak.`,
    }
  }
  return {
    starPower: 'journeyman',
    starLabel: `Squad depth player`,
    fanbaseNote: `Functional squad member. Lower fanbase impact.`,
  }
}

// ─── Importance score ─────────────────────────────────────────────────────────

function computeImportanceScore(
  captaincyRole: CaptaincyRole,
  loyaltyTier: LoyaltyTier,
  roleCriticality: PlayerImportanceProfile['roleCriticality'],
  marketTier: MarketTier,
  starPower: StarPower,
): number {
  const captainScore = { captain: 30, 'vice-captain': 20, candidate: 10, none: 0 }[captaincyRole]
  const loyaltyScore = { icon: 25, loyal: 18, familiar: 10, new: 0 }[loyaltyTier]
  const roleScore    = { sole: 22, thin: 14, adequate: 7, deep: 2 }[roleCriticality]
  const marketScore  = { elite: 15, star: 10, solid: 5, budget: 1 }[marketTier]
  const starScore    = { superstar: 8, known: 4, prospect: 4, journeyman: 0 }[starPower]
  // Franchise pillar bonus: retained elite players (Rohit, Bumrah, Virat etc.) are near-irreplaceable
  const pillarBonus  = loyaltyTier === 'icon' && marketTier === 'elite' ? 12 : 0
  return Math.min(100, captainScore + loyaltyScore + roleScore + marketScore + starScore + pillarBonus)
}

// ─── Narrative ────────────────────────────────────────────────────────────────

function buildNarrative(
  player: SoldPlayerRecord,
  profile: Omit<PlayerImportanceProfile, 'importanceScore' | 'narrativeSummary'>,
): string {
  const lines: string[] = []

  if (profile.captaincyRole === 'captain') {
    lines.push(`${player.name} is the current franchise CAPTAIN — the most irreplaceable player in any squad.`)
  } else if (profile.captaincyRole === 'vice-captain') {
    lines.push(`${player.name} is the vice-captain — a leadership pillar integral to team culture.`)
  } else if (profile.captaincyRole === 'candidate') {
    lines.push(`${player.name} has strong captaincy potential — a long-term franchise leader in the making.`)
  }

  lines.push(`Bought for ₹${player.soldPrice.toFixed(2)} Cr — ${profile.marketLabel}.`)

  if (profile.loyaltyTier !== 'new') lines.push(profile.loyaltyLabel + '.')

  lines.push(`Squad role: ${profile.roleLabel}.`)

  if (profile.starPower === 'superstar' || profile.captaincyRole !== 'none') {
    lines.push(profile.fanbaseNote)
  }

  if (profile.marketTier === 'elite' || profile.marketTier === 'star') {
    lines.push(`Estimated replacement cost at re-auction: ₹${profile.replacementCost.toFixed(1)} Cr.`)
  }

  return lines.join(' ')
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildImportanceProfile(
  player: SoldPlayerRecord,
  teamState: TeamState,
  teamId: string,
  allSquadPrices: number[],
  seasonSetup: SeasonSetup | null = null,
): PlayerImportanceProfile {
  const capRole    = captaincyRole(player, teamId, seasonSetup)
  const capLabel   = captaincyLabel(capRole, player)
  const loyalty    = resolveLoyaltyTier(player, teamId)
  const loyLabel   = resolveLoyaltyLabel(loyalty, player, teamId)
  const roleInfo   = resolveRoleCriticality(player, teamState.squad)
  const mktInfo    = resolveMarketTier(player.soldPrice, allSquadPrices)
  const repCost    = estimateReplacementCost(player.soldPrice, mktInfo.percentile)
  const starInfo   = resolveStarPower(player, mktInfo.tier, capRole)
  const score      = computeImportanceScore(capRole, loyalty, roleInfo.criticality, mktInfo.tier, starInfo.starPower)

  const partial: Omit<PlayerImportanceProfile, 'importanceScore' | 'narrativeSummary'> = {
    player,
    captaincyRole: capRole,
    captaincyLabel: capLabel,
    loyaltyTier: loyalty,
    loyaltyLabel: loyLabel,
    isRetained: player.isRetained,
    wasRTM: player.rtmEligibleFor === teamId,
    roleCount: roleInfo.count,
    roleCriticality: roleInfo.criticality,
    roleLabel: roleInfo.label,
    marketTier: mktInfo.tier,
    marketLabel: mktInfo.label,
    replacementCost: repCost,
    leaguePercentile: mktInfo.percentile,
    starPower: starInfo.starPower,
    starLabel: starInfo.starLabel,
    fanbaseNote: starInfo.fanbaseNote,
  }

  return {
    ...partial,
    importanceScore: score,
    narrativeSummary: buildNarrative(player, partial),
  }
}

export function getAllLeaguePrices(teamStates: Record<string, TeamState>): number[] {
  return Object.values(teamStates).flatMap(ts => ts.squad.map(p => p.soldPrice))
}
