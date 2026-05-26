import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { TeamBadge, TEAM_BADGE_COLORS } from '@components/ui/TeamBadge'
import { BottomNav } from '@components/ui/BottomNav'
import type { TeamId } from '@/types/team'
import type { SoldPlayerRecord } from '@/types/player'

const ROLE_COLOR: Record<string, string> = {
  BAT: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  BWL: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  AR:  'bg-green-500/20 text-green-300 border border-green-500/30',
  WK:  'bg-red-500/20 text-red-300 border border-red-500/30',
}
const ROLE_ICON: Record<string, string> = { BAT: '🏏', BWL: '🎯', AR: '⚡', WK: '🧤' }
const ROLE_ORDER: Record<string, number> = { WK: 0, BAT: 1, AR: 2, BWL: 3 }

// ─── Auction Scoring ──────────────────────────────────────────────────────────

interface AuctionScoreBreakdown {
  balance: number        // 0–25: role composition
  value: number          // 0–25: avg price vs base (lower overpay = higher)
  depth: number          // 0–20: squad size vs minimum
  overseas: number       // 0–15: overseas slot usage
  starPower: number      // 0–15: high-value acquisitions
  total: number          // 0–100
  grade: string          // S / A / B / C / D / F
  gradeColor: string
  bestPicks: SoldPlayerRecord[]
  overpays: SoldPlayerRecord[]
  narrative: string
}

function scoreSquad(squad: SoldPlayerRecord[], _startingPurse: number, minimumSquadSize: number, overseasLimit: number): AuctionScoreBreakdown {
  const auctionedSquad = squad.filter(p => !p.isRetained)
  const n = squad.length

  // ── Balance (25 pts) ──────────────────────────────────────────────────────
  const roleCounts = { BAT: 0, BWL: 0, AR: 0, WK: 0 }
  for (const p of squad) roleCounts[p.role as keyof typeof roleCounts]++
  // Ideal ratios for IPL squad
  const idealPct = { WK: 0.10, BAT: 0.30, AR: 0.22, BWL: 0.30 }
  let balancePenalty = 0
  for (const role of ['WK', 'BAT', 'AR', 'BWL'] as const) {
    const actual = n > 0 ? roleCounts[role] / n : 0
    const diff = Math.abs(actual - idealPct[role])
    balancePenalty += diff
  }
  // balancePenalty 0 = perfect, ~0.6+ = very unbalanced
  const balance = Math.round(Math.max(0, 25 - balancePenalty * 60))

  // ── Value for Money (25 pts) ──────────────────────────────────────────────
  // For auctioned (non-retained) players: value = basePrice / soldPrice  (1.0 = paid exactly base, higher is better)
  // Retained players are exempt — they were strategic choices
  let valueScore = 25
  if (auctionedSquad.length > 0) {
    const ratios = auctionedSquad.map(p => Math.min(1.0, p.basePrice / Math.max(p.soldPrice, 0.01)))
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length
    // avgRatio: 1.0 = always paid base (rare), 0.5 = paid 2× base on average (normal)
    // Map 0.2–0.7 → 0–25
    valueScore = Math.round(Math.max(0, Math.min(25, (avgRatio - 0.15) / 0.55 * 25)))
  }

  // ── Squad Depth (20 pts) ──────────────────────────────────────────────────
  // Full squad = 20 pts; minimum = 10 pts; below minimum = proportional
  const depthRatio = n / Math.max(minimumSquadSize, 1)
  const depth = Math.round(Math.min(20, depthRatio * 20))

  // ── Overseas Coverage (15 pts) ────────────────────────────────────────────
  const overseasCount = squad.filter(p => p.isOverseas).length
  const overseasUsage = overseasCount / overseasLimit
  // 5–7 overseas = ideal (not maxing out but good coverage); 0–2 = too few
  const overseaPts = overseasUsage >= 0.625 && overseasUsage <= 0.875
    ? 15
    : overseasUsage >= 0.375
    ? 12
    : overseasUsage >= 0.125
    ? 7
    : 3
  const overseas = overseaPts

  // ── Star Power (15 pts) ───────────────────────────────────────────────────
  // How many high-value players (>= 5 Cr) acquired
  const stars = squad.filter(p => p.soldPrice >= 5).length
  const starPower = Math.round(Math.min(15, stars * 2.5))

  const total = Math.min(100, balance + valueScore + depth + overseas + starPower)

  const grade = total >= 90 ? 'S' : total >= 80 ? 'A' : total >= 70 ? 'B' : total >= 55 ? 'C' : total >= 40 ? 'D' : 'F'
  const gradeColor =
    grade === 'S' ? 'text-yellow-300' :
    grade === 'A' ? 'text-green-400' :
    grade === 'B' ? 'text-blue-400' :
    grade === 'C' ? 'text-orange-400' :
    'text-red-400'

  // ── Best Picks ─────────────────────────────────────────────────────────────
  const bestPicks = [...auctionedSquad]
    .filter(p => p.soldPrice > 0)
    .sort((a, b) => (b.basePrice / b.soldPrice) - (a.basePrice / a.soldPrice))
    .slice(0, 3)

  // ── Overpays ───────────────────────────────────────────────────────────────
  const overpays = [...auctionedSquad]
    .filter(p => p.soldPrice > p.basePrice * 3)
    .sort((a, b) => (b.soldPrice / b.basePrice) - (a.soldPrice / a.basePrice))
    .slice(0, 3)

  // ── Narrative ──────────────────────────────────────────────────────────────
  const narrativeParts: string[] = []
  if (roleCounts.WK === 0) narrativeParts.push('No wicketkeeper — risky squad.')
  else if (roleCounts.WK >= 4) narrativeParts.push('Heavy on wicketkeepers — some may not play.')
  if (roleCounts.BWL <= 2) narrativeParts.push('Bowling is thin — may struggle to take wickets.')
  if (overseasCount >= 7) narrativeParts.push('Near-maximum overseas players — great variety.')
  else if (overseasCount <= 2) narrativeParts.push('Very few overseas players — missed international talent.')
  if (valueScore >= 18) narrativeParts.push('Excellent value — bought players at or near base price.')
  else if (valueScore <= 8) narrativeParts.push('Significant overspending relative to base prices.')
  if (stars >= 5) narrativeParts.push('Strong star power — multiple marquee signings.')
  else if (stars === 0) narrativeParts.push('No marquee signings — squad relies on depth.')
  if (n >= 23) narrativeParts.push('Full squad — no gaps to fill.')
  else if (n < minimumSquadSize) narrativeParts.push('Below minimum squad size — may face penalties.')

  const narrative = narrativeParts.length > 0
    ? narrativeParts.join(' ')
    : 'Solid, balanced squad with good value across roles.'

  return { balance, value: valueScore, depth, overseas, starPower, total, grade, gradeColor, bestPicks, overpays, narrative }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlayerRow({ player }: { player: SoldPlayerRecord }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-lg w-6 text-center">{ROLE_ICON[player.role]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{player.name}</p>
        <p className="text-gray-500 text-xs">{player.country}</p>
      </div>
      {player.isRetained && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-ipl-accent/20 text-ipl-accent border border-ipl-accent/30">
          RTN
        </span>
      )}
      <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLOR[player.role]}`}>
        {player.role}
      </span>
      <span className="text-ipl-gold font-bold text-sm w-16 text-right">
        ₹{player.soldPrice.toFixed(1)}Cr
      </span>
    </div>
  )
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100)
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={`font-black ${color}`}>{value}/{max}</span>
      </div>
      <div className="h-2 bg-white/8 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color.replace('text-', 'bg-')}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ValueBadge({ ratio }: { ratio: number }) {
  if (ratio >= 0.9) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30 font-bold">BASE</span>
  if (ratio >= 0.5) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">FAIR</span>
  if (ratio >= 0.25) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30 font-bold">HIGH</span>
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 font-bold">OVERPAY</span>
}

interface AuctionReportProps {
  squad: SoldPlayerRecord[]
  startingPurse: number
  currentPurse: number
  minimumSquadSize: number
  overseasLimit: number
}

function AuctionReport({ squad, startingPurse, currentPurse, minimumSquadSize, overseasLimit }: AuctionReportProps) {
  const score = useMemo(
    () => scoreSquad(squad, startingPurse, minimumSquadSize, overseasLimit),
    [squad, startingPurse, minimumSquadSize, overseasLimit]
  )

  const auctionedSquad = squad.filter(p => !p.isRetained)
  const retainedSquad = squad.filter(p => p.isRetained)
  const totalSpent = squad.reduce((s, p) => s + p.soldPrice, 0)
  const purseUsedPct = Math.round((totalSpent / startingPurse) * 100)

  // Full player list sorted by price for the value tab
  const byValue = [...auctionedSquad].sort((a, b) => {
    const ra = a.basePrice / Math.max(a.soldPrice, 0.01)
    const rb = b.basePrice / Math.max(b.soldPrice, 0.01)
    return ra - rb  // worst value first (overpays at top)
  })

  return (
    <div className="space-y-5">
      {/* Grade card */}
      <div className="bg-ipl-card border border-ipl-border rounded-2xl p-5 flex items-center gap-5">
        <div className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-black/40 border border-white/10 flex-shrink-0">
          <span className={`font-black text-5xl leading-none ${score.gradeColor}`}>{score.grade}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-lg">Auction Score</p>
          <p className={`text-3xl font-black ${score.gradeColor}`}>{score.total}<span className="text-gray-600 text-base font-semibold">/100</span></p>
          <p className="text-gray-400 text-xs mt-1 leading-relaxed">{score.narrative}</p>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="bg-ipl-card border border-ipl-border rounded-2xl p-4 space-y-4">
        <p className="text-gray-400 text-xs uppercase tracking-widest font-bold">Score Breakdown</p>
        <ScoreBar label="Role Balance" value={score.balance} max={25} color="text-purple-400" />
        <ScoreBar label="Value for Money" value={score.value} max={25} color="text-green-400" />
        <ScoreBar label="Squad Depth" value={score.depth} max={20} color="text-blue-400" />
        <ScoreBar label="Overseas Coverage" value={score.overseas} max={15} color="text-orange-400" />
        <ScoreBar label="Star Power" value={score.starPower} max={15} color="text-yellow-400" />
      </div>

      {/* Purse usage */}
      <div className="bg-ipl-card border border-ipl-border rounded-2xl p-4">
        <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Purse Usage</p>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">₹{totalSpent.toFixed(1)} Cr spent</span>
          <span className="text-gray-500">₹{currentPurse.toFixed(1)} Cr remaining</span>
        </div>
        <div className="h-3 bg-white/8 rounded-full overflow-hidden">
          <div className="h-full bg-ipl-gold rounded-full" style={{ width: `${Math.min(100, purseUsedPct)}%` }} />
        </div>
        <p className="text-gray-600 text-xs mt-1.5 text-right">{purseUsedPct}% of ₹{startingPurse.toFixed(0)} Cr budget</p>
      </div>

      {/* Best picks */}
      {score.bestPicks.length > 0 && (
        <div className="bg-ipl-card border border-ipl-border rounded-2xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">🟢 Best Value Picks</p>
          {score.bestPicks.map(p => {
            const ratio = p.basePrice / Math.max(p.soldPrice, 0.01)
            return (
              <div key={p.playerId} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <span className="text-base">{ROLE_ICON[p.role]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-gray-500 text-xs">Base ₹{p.basePrice.toFixed(2)} Cr → Paid ₹{p.soldPrice.toFixed(2)} Cr</p>
                </div>
                <ValueBadge ratio={ratio} />
              </div>
            )
          })}
        </div>
      )}

      {/* Overpays */}
      {score.overpays.length > 0 && (
        <div className="bg-ipl-card border border-ipl-border rounded-2xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">🔴 Overpaid</p>
          {score.overpays.map(p => {
            const mult = p.soldPrice / Math.max(p.basePrice, 0.01)
            return (
              <div key={p.playerId} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <span className="text-base">{ROLE_ICON[p.role]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-gray-500 text-xs">Base ₹{p.basePrice.toFixed(2)} Cr → Paid ₹{p.soldPrice.toFixed(2)} Cr</p>
                </div>
                <span className="text-red-400 font-black text-xs">{mult.toFixed(1)}×</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Full player value table */}
      <div className="bg-ipl-card border border-ipl-border rounded-2xl p-4">
        <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">All Auction Picks — Value Ranking</p>
        <div className="space-y-0">
          {byValue.map(p => {
            const ratio = p.basePrice / Math.max(p.soldPrice, 0.01)
            const mult = p.soldPrice / Math.max(p.basePrice, 0.01)
            return (
              <div key={p.playerId} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
                <span className="text-sm w-5 text-center">{ROLE_ICON[p.role]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{p.name}</p>
                  <p className="text-gray-600 text-[10px]">₹{p.basePrice.toFixed(2)} base · paid ₹{p.soldPrice.toFixed(2)}</p>
                </div>
                <ValueBadge ratio={ratio} />
                <span className={`text-xs font-bold w-10 text-right ${mult > 3 ? 'text-red-400' : mult > 1.5 ? 'text-orange-400' : 'text-gray-500'}`}>
                  {mult.toFixed(1)}×
                </span>
              </div>
            )
          })}
          {retainedSquad.length > 0 && (
            <>
              <p className="text-gray-600 text-[10px] uppercase tracking-widest pt-3 pb-1">Retained</p>
              {retainedSquad.map(p => (
                <div key={p.playerId} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm w-5 text-center">{ROLE_ICON[p.role]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold truncate">{p.name}</p>
                    <p className="text-gray-600 text-[10px]">Retained at ₹{p.soldPrice.toFixed(2)} Cr</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-ipl-accent/20 text-ipl-accent border border-ipl-accent/30 font-bold">RTN</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function TeamSummaryCard({ teamId, active, onClick }: {
  teamId: string; active: boolean; onClick: () => void
}) {
  const colors = TEAM_BADGE_COLORS[teamId] ?? { from: 'from-gray-500', to: 'to-gray-700', text: 'text-white', ring: 'ring-gray-400' }
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${
        active ? `bg-gradient-to-b ${colors.from} ${colors.to} shadow-lg scale-105` : 'bg-white/5 hover:bg-white/10'
      }`}
    >
      <TeamBadge teamId={teamId} size="md" showRing={active} />
      <span className={`text-xs font-bold ${active ? colors.text : 'text-gray-400'}`}>{teamId}</span>
    </button>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type ScreenTab = 'squad' | 'report'

export function FinalSquadReviewScreen() {
  const navigate = useNavigate()
  const { gameState } = useGameStore()

  if (!gameState) {
    return (
      <div className="min-h-screen bg-ipl-darker flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-3">No active session</p>
          <button className="text-ipl-accent text-sm underline" onClick={() => navigate('/')}>Go home</button>
        </div>
      </div>
    )
  }

  const userTeam = gameState.userFranchise as TeamId
  const allTeamIds = Object.keys(gameState.teamStates) as TeamId[]

  const [selectedTeam, setSelectedTeam] = useState<TeamId>(userTeam)
  const [tab, setTab] = useState<ScreenTab>('squad')

  const teamState = gameState.teamStates[selectedTeam]
  const squad = [...teamState.squad].sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9))
  const spent = squad.reduce((s, p) => s + p.soldPrice, 0)
  const overseas = squad.filter(p => p.isOverseas).length
  const retained = squad.filter(p => p.isRetained).length
  const isUser = selectedTeam === userTeam

  const roleCounts = { BAT: 0, BWL: 0, AR: 0, WK: 0 }
  for (const p of squad) { if (p.role in roleCounts) roleCounts[p.role as keyof typeof roleCounts]++ }

  const totalSold = gameState.soldPlayers.length
  const totalUnsold = gameState.unsoldPlayers.length
  const totalSpent = Object.values(gameState.teamStates).reduce((s, ts) => {
    const teamSpent = ts.squad.reduce((ss, p) => ss + p.soldPrice, 0)
    return s + teamSpent
  }, 0)
  const topSale = [...gameState.soldPlayers].sort((a, b) => b.soldPrice - a.soldPrice)[0]

  const colors = TEAM_BADGE_COLORS[selectedTeam] ?? { from: 'from-gray-500', to: 'to-gray-700', text: 'text-white', ring: 'ring-gray-400' }

  // Starting purse from game state (initial purse = currentPurse + spent)
  const startingPurse = teamState.currentPurse + spent

  return (
    <div className="min-h-screen bg-ipl-darker pb-24">
      {/* Hero header */}
      <div className={`bg-gradient-to-b ${colors.from} ${colors.to} to-ipl-darker px-4 pb-6 safe-top`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="text-2xl">🔨</div>
          <div>
            <h1 className="text-white font-black text-xl">Auction Complete</h1>
            <p className="text-white/60 text-sm">GPL {gameState.auctionYear}</p>
          </div>
        </div>

        {/* Auction summary strip */}
        <div className="grid grid-cols-3 gap-2 bg-black/30 rounded-2xl p-3">
          <div className="text-center">
            <p className="text-white font-black text-lg">{totalSold}</p>
            <p className="text-white/50 text-xs">Sold</p>
          </div>
          <div className="text-center border-x border-white/10">
            <p className="text-ipl-gold font-black text-lg">₹{totalSpent.toFixed(0)}Cr</p>
            <p className="text-white/50 text-xs">Total Spent</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 font-black text-lg">{totalUnsold}</p>
            <p className="text-white/50 text-xs">Unsold</p>
          </div>
        </div>

        {topSale && (
          <div className="mt-3 bg-ipl-gold/10 border border-ipl-gold/20 rounded-xl px-4 py-2 flex items-center justify-between">
            <span className="text-ipl-gold text-xs font-semibold">💰 Top Sale</span>
            <span className="text-white text-sm font-bold">
              {topSale.name} — ₹{topSale.soldPrice.toFixed(1)} Cr ({topSale.soldTo})
            </span>
          </div>
        )}
      </div>

      {/* Team selector */}
      <div className="px-4 py-4">
        <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">Select Franchise</p>
        <div className="grid grid-cols-5 gap-2">
          {allTeamIds.map(tid => (
            <TeamSummaryCard
              key={tid}
              teamId={tid}
              active={tid === selectedTeam}
              onClick={() => { setSelectedTeam(tid as TeamId); setTab('squad') }}
            />
          ))}
        </div>
      </div>

      {/* Team header */}
      <div className="px-4 mb-3">
        <div className={`rounded-2xl bg-gradient-to-br ${colors.from} ${colors.to} p-4 flex items-center gap-4`}>
          <TeamBadge teamId={selectedTeam} size="lg" showRing />
          <div className="flex-1">
            <h2 className={`font-black text-lg ${colors.text}`}>{selectedTeam}</h2>
            {isUser && <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">Your Team</span>}
          </div>
          <div className="text-right">
            <p className="text-white/50 text-xs">Purse Left</p>
            <p className="text-white font-black text-lg">₹{teamState.currentPurse.toFixed(1)} Cr</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Players', value: squad.length },
            { label: 'Overseas', value: `${overseas}/8` },
            { label: 'Retained', value: retained },
            { label: 'Spent', value: `₹${spent.toFixed(0)}Cr` },
          ].map(stat => (
            <div key={stat.label} className="bg-ipl-card rounded-xl p-2.5 text-center">
              <p className="text-white font-black text-base">{stat.value}</p>
              <p className="text-gray-500 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Role composition bar */}
      <div className="px-4 mb-4">
        <div className="bg-ipl-card rounded-xl p-3">
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Role Composition</p>
          <div className="flex gap-2">
            {(['WK', 'BAT', 'AR', 'BWL'] as const).map(role => (
              <div key={role} className="flex-1 text-center">
                <div className={`text-xs py-1.5 rounded-lg font-bold ${ROLE_COLOR[role]}`}>
                  {ROLE_ICON[role]} {roleCounts[role]}
                </div>
                <p className="text-gray-600 text-xs mt-1">{role}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab selector */}
      <div className="px-4 mb-4">
        <div className="flex bg-ipl-card rounded-xl p-1 border border-ipl-border">
          <button
            onClick={() => setTab('squad')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === 'squad' ? 'bg-ipl-accent text-white shadow-md' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Squad
          </button>
          <button
            onClick={() => setTab('report')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === 'report' ? 'bg-ipl-accent text-white shadow-md' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Auction Report
          </button>
        </div>
      </div>

      <div className="px-4">
        {/* Squad tab */}
        {tab === 'squad' && (
          <div className="bg-ipl-card rounded-2xl p-4 mb-4">
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">
              Squad · {squad.length} players
            </p>
            {squad.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-4">No players acquired</p>
            ) : (
              squad.map(p => <PlayerRow key={p.playerId} player={p} />)
            )}
          </div>
        )}

        {/* Report tab */}
        {tab === 'report' && (
          <AuctionReport
            squad={squad}
            startingPurse={startingPurse}
            currentPurse={teamState.currentPurse}
            minimumSquadSize={18}
            overseasLimit={8}
          />
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 mt-4">
          <button
            onClick={() => navigate('/season-setup')}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-ipl-accent to-red-700 text-white font-black text-sm shadow-glow-accent hover:opacity-90 transition-opacity"
          >
            🏆 Simulate the Season
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/unsold-players')}
              className="flex-1 py-3 rounded-xl bg-ipl-card border border-ipl-border text-gray-300 font-semibold text-sm hover:bg-ipl-card2 transition-colors"
            >
              Unsold Players
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-3 rounded-xl bg-ipl-card border border-ipl-border text-gray-400 font-semibold text-sm hover:bg-ipl-card2 transition-colors"
            >
              Home
            </button>
          </div>
        </div>
      </div>

      <BottomNav active="my-squad" />
    </div>
  )
}
