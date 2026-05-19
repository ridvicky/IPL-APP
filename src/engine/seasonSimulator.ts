/**
 * Season Simulator — formula-based IPL season simulation.
 * No external data needed. Uses squad composition, auction spend,
 * franchise strength, and user instructions to compute results.
 *
 * Design principles:
 * - Pure function: same inputs → same structure (randomness seeded per match)
 * - Never invents players outside the squads
 * - User team result is influenced by their instruction and captain choice
 * - Easy/Normal/Hard difficulty affects user team performance only
 */

import type { GameState } from '@/types/game'
import type { TeamId, TeamState } from '@/types/team'
import type { SoldPlayerRecord } from '@/types/player'
import type {
  SeasonSetup, SeasonResult, TeamSeasonResult,
  TeamReview, AwardWinner, OpponentSeasonSetup, TeamInstruction,
} from '@/types/season'
import { ALL_PERSONAS } from '@/personas'

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAYOFF_TEAMS    = 4

// Role weights for squad strength calculation
const ROLE_WEIGHT = { BAT: 1.0, BWL: 1.1, AR: 1.2, WK: 0.9 }

// Instruction modifiers on final team strength
const INSTRUCTION_MOD: Record<TeamInstruction, number> = {
  'aggressive-batting':    0.04,
  'anchor-batting':       -0.01,
  'spin-heavy':            0.02,
  'pace-heavy':            0.03,
  'back-youngsters':      -0.02,
  'trust-experience':      0.03,
  'flexible-order':        0.01,
  'fixed-roles':           0.02,
  'defensive':            -0.03,
  'high-risk-high-reward': 0.05,
  'balanced':              0.02,
}

// Difficulty modifier applied to user team strength
const DIFFICULTY_MOD: Record<string, number> = {
  easy:   0.10,
  normal: 0.00,
  hard:  -0.10,
}

// ─── Squad strength scoring ───────────────────────────────────────────────────

function scorePlayer(p: SoldPlayerRecord): number {
  const roleW = ROLE_WEIGHT[p.role] ?? 1.0
  const priceScore = Math.log10(Math.max(p.soldPrice, 0.2) + 1) * 30
  const cappedBonus = p.cappedStatus === 'capped' ? 8 : 0
  const overseasBonus = p.isOverseas ? 4 : 0
  return (priceScore + cappedBonus + overseasBonus) * roleW
}

function squadStrength(teamState: TeamState): number {
  if (teamState.squad.length === 0) return 20
  const total = teamState.squad.reduce((s, p) => s + scorePlayer(p), 0)
  // Normalise to 0–100 (a perfectly spent squad of 25 should score ~100)
  return Math.min(100, total / (teamState.squad.length * 2))
}

function roleBalance(squad: SoldPlayerRecord[]): number {
  if (squad.length === 0) return 0
  const counts = { BAT: 0, BWL: 0, AR: 0, WK: 0 }
  for (const p of squad) { if (p.role in counts) counts[p.role as keyof typeof counts]++ }
  const ideal = { BAT: 5, BWL: 5, AR: 3, WK: 2 }
  let penalty = 0
  for (const role of ['BAT', 'BWL', 'AR', 'WK'] as const) {
    penalty += Math.abs(counts[role] - ideal[role]) * 2
  }
  return Math.max(0, 20 - penalty)
}

function captainBonus(captainId: string, squad: SoldPlayerRecord[]): number {
  const captain = squad.find(p => p.playerId === captainId)
  if (!captain) return 0
  // Capped captain with high price = more bonus
  const priceBonus = Math.min(10, captain.soldPrice * 0.5)
  return (captain.cappedStatus === 'capped' ? 5 : 2) + priceBonus
}

// ─── Team season strength ─────────────────────────────────────────────────────

function teamSeasonStrength(
  teamId: TeamId,
  teamState: TeamState,
  setup: { captainPlayerId: string; instruction: TeamInstruction } | null,
  difficulty: string,
  isUserTeam: boolean,
): number {
  const persona = ALL_PERSONAS[teamId]
  const franchiseBase = (persona?.franchiseStrength ?? 0.70) * 25  // 0–25 pts

  const squad = squadStrength(teamState)        // 0–100
  const balance = roleBalance(teamState.squad)  // 0–20
  const captain = setup ? captainBonus(setup.captainPlayerId, teamState.squad) : 0  // 0–15

  const instrMod = setup ? (INSTRUCTION_MOD[setup.instruction] ?? 0) * 100 : 0

  let strength = (squad * 0.50) + (franchiseBase) + (balance * 0.5) + captain + instrMod

  if (isUserTeam) {
    strength += DIFFICULTY_MOD[difficulty] ?? 0
  }

  return Math.max(5, Math.min(150, strength))
}

// ─── Match simulation ─────────────────────────────────────────────────────────

// Deterministic-ish seeded random using team IDs + match number
function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

function simulateMatch(
  teamA: TeamId, strengthA: number,
  teamB: TeamId, strengthB: number,
  matchIndex: number,
): TeamId {
  const total = strengthA + strengthB
  const probA = strengthA / total
  // Add small random variance per match
  const r = seededRandom(matchIndex * 17 + teamA.charCodeAt(0) + teamB.charCodeAt(0))
  return r < probA ? teamA : teamB
}

// ─── League schedule ──────────────────────────────────────────────────────────

function buildSchedule(teams: TeamId[]): [TeamId, TeamId][] {
  const matches: [TeamId, TeamId][] = []
  // Round-robin (each pair plays twice — home and away)
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push([teams[i], teams[j]])
      matches.push([teams[j], teams[i]])
    }
  }
  return matches
}

// ─── NRR calculation ─────────────────────────────────────────────────────────

function computeNRR(wins: number, losses: number, strength: number): number {
  // Approximate NRR from win ratio and squad strength
  const winRatio = wins / Math.max(1, wins + losses)
  const strengthBonus = (strength - 70) / 200
  const base = (winRatio - 0.5) * 2 + strengthBonus
  return Math.round(base * 100) / 100
}

// ─── Player performance simulation ───────────────────────────────────────────

interface PlayerStats {
  playerId: string
  playerName: string
  teamId: TeamId
  runs: number
  wickets: number
  matches: number
  soldPrice: number
}

function simulatePlayerStats(
  teamId: TeamId,
  squad: SoldPlayerRecord[],
  teamWins: number,
): PlayerStats[] {
  return squad.map((p, idx) => {
    const base = scorePlayer(p)
    const seed = teamId.charCodeAt(0) + idx * 7 + teamWins * 3
    const variance = 0.7 + seededRandom(seed) * 0.6  // 0.7–1.3

    const matches = 10 + Math.floor(seededRandom(seed + 1) * 5)

    let runs = 0, wickets = 0
    if (p.role === 'BAT' || p.role === 'WK' || p.role === 'AR') {
      runs = Math.round(base * variance * (p.role === 'BAT' ? 5.5 : p.role === 'AR' ? 4.0 : 4.5))
    }
    if (p.role === 'BWL' || p.role === 'AR') {
      wickets = Math.round(base * variance * (p.role === 'BWL' ? 0.8 : 0.5) / 3)
    }

    return { playerId: p.playerId, playerName: p.name, teamId, runs, wickets, matches, soldPrice: p.soldPrice }
  })
}

// ─── Awards ──────────────────────────────────────────────────────────────────

function findOrangeCap(allStats: PlayerStats[]): AwardWinner {
  const top = [...allStats].sort((a, b) => b.runs - a.runs)[0]
  return { playerId: top.playerId, playerName: top.playerName, teamId: top.teamId, value: top.runs }
}

function findPurpleCap(allStats: PlayerStats[]): AwardWinner {
  const top = [...allStats].sort((a, b) => b.wickets - a.wickets)[0]
  return { playerId: top.playerId, playerName: top.playerName, teamId: top.teamId, value: top.wickets }
}

function findMVP(allStats: PlayerStats[]): AwardWinner {
  const scored = allStats.map(s => ({
    ...s,
    mvpScore: s.runs * 0.5 + s.wickets * 20,
  }))
  const top = scored.sort((a, b) => b.mvpScore - a.mvpScore)[0]
  return { playerId: top.playerId, playerName: top.playerName, teamId: top.teamId, value: Math.round(top.mvpScore) }
}

function findBestBuy(allStats: PlayerStats[]): AwardWinner {
  // Value = performance per crore spent
  const valued = allStats
    .filter(s => s.soldPrice > 0)
    .map(s => ({
      ...s,
      value: (s.runs * 0.5 + s.wickets * 20) / s.soldPrice,
    }))
  const top = valued.sort((a, b) => b.value - a.value)[0]
  return { playerId: top.playerId, playerName: top.playerName, teamId: top.teamId, value: Math.round(top.value * 10) / 10 }
}

function findWorstBuy(allStats: PlayerStats[]): AwardWinner {
  const valued = allStats
    .filter(s => s.soldPrice >= 2)  // only expensive busts
    .map(s => ({
      ...s,
      value: (s.runs * 0.5 + s.wickets * 20) / s.soldPrice,
    }))
  const bottom = valued.sort((a, b) => a.value - b.value)[0]
  return { playerId: bottom.playerId, playerName: bottom.playerName, teamId: bottom.teamId, value: Math.round(bottom.value * 10) / 10 }
}

// ─── Team review builder ──────────────────────────────────────────────────────

function buildTeamReview(
  teamId: TeamId,
  position: number,
  teamState: TeamState,
  stats: PlayerStats[],
  totalTeams: number,
): TeamReview {
  const topBatters = [...stats].filter(s => s.runs > 0).sort((a, b) => b.runs - a.runs).slice(0, 2)
  const topBowlers = [...stats].filter(s => s.wickets > 0).sort((a, b) => b.wickets - a.wickets).slice(0, 2)
  const keyPerformers = [...new Set([...topBatters, ...topBowlers].map(s => s.playerName))].slice(0, 3)

  const byValue = [...stats].filter(s => s.soldPrice >= 2).map(s => ({
    ...s, perf: s.runs * 0.5 + s.wickets * 20,
  }))
  const bestBuy = byValue.sort((a, b) => (b.perf / b.soldPrice) - (a.perf / a.soldPrice))[0]
  const worstBuy = byValue.sort((a, b) => (a.perf / a.soldPrice) - (b.perf / b.soldPrice))[0]

  const underperformers = worstBuy ? [worstBuy.playerName] : []

  const squad = teamState.squad
  const counts = { BAT: 0, BWL: 0, AR: 0, WK: 0 }
  for (const p of squad) { if (p.role in counts) counts[p.role as keyof typeof counts]++ }

  const battingDepth = (counts.BAT + counts.AR + counts.WK)
  const bowlingDepth = (counts.BWL + counts.AR)

  const squadBalanceRating = Math.min(10, Math.round(roleBalance(squad) / 2))
  const battingRating = Math.min(10, Math.round(battingDepth * 10 / 12))
  const bowlingRating = Math.min(10, Math.round(bowlingDepth * 10 / 9))
  const depthRating = Math.min(10, Math.round(squad.length * 10 / 25))

  const positionFraction = (totalTeams - position) / (totalTeams - 1)
  const auctionValueRating = Math.max(1, Math.round(positionFraction * 9 + 1))

  const captaincyImpact: 'positive' | 'neutral' | 'negative' =
    position <= 4 ? 'positive' : position >= 8 ? 'negative' : 'neutral'

  const summary = position <= 2
    ? `${teamId} had an exceptional season, finishing ${position === 1 ? 'champions' : 'runners-up'} with a well-balanced squad.`
    : position <= 4
    ? `${teamId} made the playoffs at position ${position}, showing consistent performances throughout.`
    : position <= 7
    ? `${teamId} had a mid-table finish at ${position}. The squad showed promise in patches but couldn't sustain momentum.`
    : `${teamId} finished ${position}th — a disappointing season. Squad balance and key role gaps were evident.`

  return {
    teamId,
    finalPosition: position,
    keyPerformers,
    underperformers,
    bestBuy: bestBuy?.playerName ?? null,
    weakestBuy: worstBuy?.playerName ?? null,
    squadBalanceRating,
    battingRating,
    bowlingRating,
    depthRating,
    captaincyImpact,
    auctionValueRating,
    summary,
  }
}

// ─── Playoff simulation ───────────────────────────────────────────────────────

function simulatePlayoffs(
  playoff4: { teamId: TeamId; strength: number }[],
): { winner: TeamId; runnerUp: TeamId } {
  // Qualifier 1: 1st vs 2nd
  const q1Winner = simulateMatch(
    playoff4[0].teamId, playoff4[0].strength,
    playoff4[1].teamId, playoff4[1].strength, 101,
  )
  const q1Loser = q1Winner === playoff4[0].teamId ? playoff4[1].teamId : playoff4[0].teamId

  // Eliminator: 3rd vs 4th
  const elimWinner = simulateMatch(
    playoff4[2].teamId, playoff4[2].strength,
    playoff4[3].teamId, playoff4[3].strength, 102,
  )

  // Qualifier 2: Q1 loser vs Elim winner
  const q1LoserStr = playoff4.find(t => t.teamId === q1Loser)!.strength
  const elimStr    = playoff4.find(t => t.teamId === elimWinner)!.strength
  const q2Winner   = simulateMatch(q1Loser, q1LoserStr, elimWinner, elimStr, 103)

  // Final
  const q1WinnerStr = playoff4.find(t => t.teamId === q1Winner)!.strength
  const q2WinnerStr = playoff4.find(t => t.teamId === q2Winner)!.strength
  const winner      = simulateMatch(q1Winner, q1WinnerStr, q2Winner, q2WinnerStr, 104)
  const runnerUp    = winner === q1Winner ? q2Winner : q1Winner

  return { winner, runnerUp }
}

// ─── Opponent setup generator ─────────────────────────────────────────────────

export function generateOpponentSetups(
  state: GameState,
): Record<TeamId, OpponentSeasonSetup> {
  const instructions: TeamInstruction[] = [
    'aggressive-batting', 'balanced', 'pace-heavy', 'spin-heavy',
    'trust-experience', 'high-risk-high-reward', 'anchor-batting',
    'flexible-order', 'fixed-roles', 'back-youngsters',
  ]

  const setups: Record<string, OpponentSeasonSetup> = {}
  let instrIdx = 0

  for (const [teamId, ts] of Object.entries(state.teamStates)) {
    if (teamId === state.userFranchise) continue
    const captainId = [...ts.squad]
      .sort((a, b) => b.soldPrice - a.soldPrice)[0]?.playerId ?? ''

    setups[teamId] = {
      teamId: teamId as TeamId,
      captainPlayerId: captainId,
      instruction: instructions[instrIdx % instructions.length],
      llmReasoning: null,
    }
    instrIdx++
  }

  return setups as Record<TeamId, OpponentSeasonSetup>
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function simulateSeason(
  state: GameState,
  setup: SeasonSetup,
  difficulty: string,
): SeasonResult {
  const teamIds = Object.keys(state.teamStates) as TeamId[]
  const userTeam = state.userFranchise as TeamId

  // Compute team strengths
  const strengths: Record<TeamId, number> = {} as Record<TeamId, number>
  for (const tid of teamIds) {
    const ts = state.teamStates[tid]
    const teamSetup = tid === userTeam
      ? { captainPlayerId: setup.captainPlayerId, instruction: setup.instruction }
      : setup.opponentSetups[tid] ?? null
    strengths[tid] = teamSeasonStrength(tid, ts, teamSetup, difficulty, tid === userTeam)
  }

  // Simulate league stage
  const wins: Record<TeamId, number> = {} as Record<TeamId, number>
  const losses: Record<TeamId, number> = {} as Record<TeamId, number>
  for (const tid of teamIds) { wins[tid] = 0; losses[tid] = 0 }

  const schedule = buildSchedule(teamIds)
  schedule.forEach(([a, b], i) => {
    const winner = simulateMatch(a, strengths[a], b, strengths[b], i)
    const loser  = winner === a ? b : a
    wins[winner]++
    losses[loser]++
  })

  // Points table (2 pts per win)
  const pointsTable: TeamSeasonResult[] = teamIds.map(tid => ({
    teamId: tid,
    wins: wins[tid],
    losses: losses[tid],
    noResults: 0,
    points: wins[tid] * 2,
    nrr: computeNRR(wins[tid], losses[tid], strengths[tid]),
    position: 0,
    qualifiedForPlayoffs: false,
    seasonStrength: strengths[tid],
  }))

  pointsTable.sort((a, b) => b.points - a.points || b.nrr - a.nrr)
  pointsTable.forEach((t, i) => {
    t.position = i + 1
    t.qualifiedForPlayoffs = i < PLAYOFF_TEAMS
  })

  // Playoff simulation
  const playoff4 = pointsTable.slice(0, PLAYOFF_TEAMS).map(t => ({
    teamId: t.teamId, strength: strengths[t.teamId],
  }))
  const { winner, runnerUp } = simulatePlayoffs(playoff4)

  // Player stats
  const allStats: PlayerStats[] = []
  for (const tid of teamIds) {
    const stats = simulatePlayerStats(tid, state.teamStates[tid].squad, wins[tid])
    allStats.push(...stats)
  }

  // Awards
  const orangeCap   = findOrangeCap(allStats)
  const purpleCap   = findPurpleCap(allStats)
  const mvp         = findMVP(allStats)
  const bestAuctionBuy  = findBestBuy(allStats)
  const worstAuctionBuy = findWorstBuy(allStats)

  // Team reviews
  const teamReviews: Record<string, TeamReview> = {}
  for (const t of pointsTable) {
    const stats = allStats.filter(s => s.teamId === t.teamId)
    teamReviews[t.teamId] = buildTeamReview(t.teamId, t.position, state.teamStates[t.teamId], stats, teamIds.length)
  }

  return {
    year: state.auctionYear,
    pointsTable,
    playoffTeams: playoff4.map(t => t.teamId),
    winner,
    runnerUp,
    orangeCap,
    purpleCap,
    mvp,
    bestAuctionBuy,
    worstAuctionBuy,
    teamReviews: teamReviews as Record<TeamId, TeamReview>,
  }
}
