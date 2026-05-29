import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tap } from '@/utils/haptics'
import { useGameStore } from '@/store/gameStore'
import { TeamBadge, TEAM_BADGE_COLORS } from '@components/ui/TeamBadge'
import { BottomNav } from '@components/ui/BottomNav'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { callLLMJsonStrategic } from '@/llm/openRouterClient'
import { buildSquadAnalysisMessages } from '@/llm/prompts'
import type { SquadAnalysisContext } from '@/llm/prompts'
import type { TeamId } from '@/types/team'
import type { SoldPlayerRecord } from '@/types/player'

interface AISquadReport {
  bestXI: { name: string; role: string; reason: string }[]
  twelfthMan: { name: string; role: string; reason: string } | null
  strengths: string[]
  weaknesses: string[]
  roleGaps: string[]
  analystNote: string
}

const ROLE_COLOR: Record<string, string> = {
  BAT: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  BWL: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  AR:  'bg-green-500/20 text-green-300 border border-green-500/30',
  WK:  'bg-red-500/20 text-red-300 border border-red-500/30',
}
const ROLE_ICON: Record<string, string> = { BAT: '🏏', BWL: '🎯', AR: '⚡', WK: '🧤' }
const ROLE_ORDER: Record<string, number> = { WK: 0, BAT: 1, AR: 2, BWL: 3 }

// ─── Squad Analysis ───────────────────────────────────────────────────────────

function playerQuality(p: SoldPlayerRecord): number {
  const base = p.marketValue ?? (p.soldPrice > 0 ? p.soldPrice : p.basePrice)
  return p.cappedStatus === 'capped' ? base * 1.5 : base
}

interface SquadAnalysis {
  xi: SoldPlayerRecord[]
  twelfthMan: SoldPlayerRecord | null
  backups: SoldPlayerRecord[]
  strengths: string[]
  weaknesses: string[]
  roleGaps: string[]
  overseasInXI: number
}

function analyzeSquad(squad: SoldPlayerRecord[]): SquadAnalysis {
  const byRole = (role: string) =>
    squad.filter(p => p.role === role).sort((a, b) => playerQuality(b) - playerQuality(a))

  const wks  = byRole('WK')
  const bats = byRole('BAT')
  const ars  = byRole('AR')
  const bwls = byRole('BWL')

  const xi: SoldPlayerRecord[] = []
  const used = new Set<string>()

  const pick = (pool: SoldPlayerRecord[], count: number) => {
    const picked: SoldPlayerRecord[] = []
    for (const p of pool) {
      if (picked.length >= count) break
      if (!used.has(p.playerId)) { picked.push(p); used.add(p.playerId) }
    }
    return picked
  }

  // Standard IPL XI: 1 WK + 4 BAT + 2 AR + 4 BWL
  xi.push(...pick(wks, 1))
  xi.push(...pick(bats, 4))
  xi.push(...pick(ars, 2))
  xi.push(...pick(bwls, 4))

  // Fill to 11 if any role was short
  if (xi.length < 11) {
    const fill = [...squad]
      .filter(p => !used.has(p.playerId))
      .sort((a, b) => playerQuality(b) - playerQuality(a))
    xi.push(...pick(fill, 11 - xi.length))
  }

  // Enforce overseas cap in XI (IPL: max 4)
  const MAX_OVERSEAS_XI = 4
  const overseasInXI = xi.filter(p => p.isOverseas)
  if (overseasInXI.length > MAX_OVERSEAS_XI) {
    const overseasSorted = [...overseasInXI].sort((a, b) => playerQuality(a) - playerQuality(b))
    const domesticsAvail = squad
      .filter(p => !p.isOverseas && !used.has(p.playerId))
      .sort((a, b) => playerQuality(b) - playerQuality(a))
    let swapped = 0
    for (const out of overseasSorted) {
      if (swapped >= overseasInXI.length - MAX_OVERSEAS_XI) break
      const rep = domesticsAvail[swapped]
      if (rep) {
        const idx = xi.findIndex(p => p.playerId === out.playerId)
        xi[idx] = rep
        used.delete(out.playerId)
        used.add(rep.playerId)
        swapped++
      }
    }
  }

  const remaining = squad
    .filter(p => !used.has(p.playerId))
    .sort((a, b) => playerQuality(b) - playerQuality(a))

  const twelfthMan = remaining[0] ?? null
  const backups = remaining.slice(1)

  // Strengths & weaknesses
  const roleCounts = { BAT: 0, BWL: 0, AR: 0, WK: 0 }
  for (const p of squad) if (p.role in roleCounts) roleCounts[p.role as keyof typeof roleCounts]++
  const overseasTotal = squad.filter(p => p.isOverseas).length
  const cappedCount   = squad.filter(p => p.cappedStatus === 'capped').length

  const strengths: string[] = []
  const weaknesses: string[] = []
  const roleGaps: string[] = []

  if (roleCounts.BAT >= 6) strengths.push('Deep batting lineup with plenty of cover')
  if (roleCounts.BWL >= 6) strengths.push('Strong bowling attack — variety and depth')
  if (roleCounts.AR >= 4)  strengths.push('All-round depth gives excellent tactical flexibility')
  if (cappedCount >= 8)    strengths.push(`${cappedCount} capped internationals — big-match experience throughout`)
  if (overseasTotal >= 6)  strengths.push(`${overseasTotal} overseas players — strong international presence`)
  if (roleCounts.WK >= 2)  strengths.push('Wicketkeeper cover — protected against injury risk')
  if (squad.length >= 22)  strengths.push('Full squad — depth to rotate and rest players')

  if (roleCounts.WK === 0) { weaknesses.push('No wicketkeeper — critical squad gap'); roleGaps.push('WK') }
  else if (roleCounts.WK === 1) weaknesses.push('Only 1 wicketkeeper — no backup cover')
  if (roleCounts.BWL <= 3) { weaknesses.push('Thin bowling attack — may struggle to take 20 wickets'); roleGaps.push('BWL') }
  if (roleCounts.BAT <= 3) { weaknesses.push('Shallow batting — vulnerable to top-order collapses'); roleGaps.push('BAT') }
  if (roleCounts.AR <= 1)  weaknesses.push('Lacks all-round balance — XI selection is rigid')
  if (overseasTotal <= 3)  weaknesses.push('Few overseas players — missing top international talent')
  if (cappedCount <= 3)    weaknesses.push('Youth-heavy squad — may lack big-match experience')
  if (squad.length < 18)   weaknesses.push(`Only ${squad.length} players — thin on injury cover`)

  return {
    xi,
    twelfthMan,
    backups,
    strengths,
    weaknesses,
    roleGaps,
    overseasInXI: xi.filter(p => p.isOverseas).length,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlayerRow({ player }: { player: SoldPlayerRecord }) {
  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 ${player.isRetained ? 'border-l-2 border-l-ipl-gold -ml-4 pl-3 pr-0 bg-ipl-gold/5' : ''}`}>
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

function XIPlayerRow({ player, num }: { player: SoldPlayerRecord; num: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-gray-600 font-black text-xs w-5 text-center">{num}</span>
      <span className="text-base w-6 text-center">{ROLE_ICON[player.role]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-white font-semibold text-sm truncate">{player.name}</p>
          {player.isRetained && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-ipl-accent/20 text-ipl-accent border border-ipl-accent/30 font-bold shrink-0">RTN</span>
          )}
          {player.isOverseas && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold shrink-0">OVS</span>
          )}
        </div>
        <p className="text-gray-500 text-xs">{player.country} · {player.cappedStatus === 'capped' ? 'Capped' : 'Uncapped'}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLOR[player.role]}`}>{player.role}</span>
      <span className="text-ipl-gold font-bold text-xs w-14 text-right">₹{player.soldPrice.toFixed(1)}Cr</span>
    </div>
  )
}


// ─── Fallback (rule-based) — shown on API error ───────────────────────────────

function FallbackSquadReport({ squad }: { squad: SoldPlayerRecord[] }) {
  const analysis = useMemo(() => analyzeSquad(squad), [squad])
  const roleCounts = { BAT: 0, BWL: 0, AR: 0, WK: 0 }
  for (const p of squad) if (p.role in roleCounts) roleCounts[p.role as keyof typeof roleCounts]++
  const backupsByRole: Record<string, SoldPlayerRecord[]> = { WK: [], BAT: [], AR: [], BWL: [] }
  for (const p of analysis.backups) { if (p.role in backupsByRole) backupsByRole[p.role].push(p) }

  return (
    <div className="space-y-4">
      <div className="bg-ipl-card border border-ipl-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-ipl-gold/10 border-b border-ipl-gold/20 flex items-center justify-between">
          <p className="text-ipl-gold text-xs uppercase tracking-widest font-black">Best Playing XI</p>
          <p className="text-gray-500 text-xs">{analysis.overseasInXI}/4 overseas</p>
        </div>
        <div className="px-4">
          {analysis.xi.map((p, i) => <XIPlayerRow key={p.playerId} player={p} num={i + 1} />)}
          {analysis.xi.length === 0 && <p className="text-gray-600 text-sm text-center py-6">Not enough players to form an XI</p>}
        </div>
      </div>
      {analysis.twelfthMan && (
        <div className="bg-ipl-card border border-ipl-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-white/5 border-b border-white/8">
            <p className="text-gray-400 text-xs uppercase tracking-widest font-black">12th Man</p>
          </div>
          <div className="px-4"><XIPlayerRow player={analysis.twelfthMan} num={12} /></div>
        </div>
      )}
      <div className="bg-ipl-card border border-ipl-border rounded-2xl p-4">
        <p className="text-gray-400 text-xs uppercase tracking-widest font-black mb-3">Role Composition</p>
        <div className="grid grid-cols-4 gap-2">
          {(['WK', 'BAT', 'AR', 'BWL'] as const).map(role => {
            const count = roleCounts[role]
            const ideal = { WK: '2–3', BAT: '6–8', AR: '3–5', BWL: '6–8' }
            const isGap = analysis.roleGaps.includes(role)
            return (
              <div key={role} className={`rounded-xl p-3 text-center border ${isGap ? 'border-red-500/40 bg-red-500/10' : 'border-white/8 bg-white/5'}`}>
                <p className="text-lg">{ROLE_ICON[role]}</p>
                <p className={`font-black text-xl ${isGap ? 'text-red-400' : 'text-white'}`}>{count}</p>
                <p className="text-gray-500 text-[10px]">{role}</p>
                <p className={`text-[10px] mt-0.5 ${isGap ? 'text-red-400' : 'text-gray-600'}`}>ideal {ideal[role]}</p>
              </div>
            )
          })}
        </div>
      </div>
      {analysis.strengths.length > 0 && (
        <div className="bg-ipl-card border border-ipl-border rounded-2xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-black mb-3">Strengths</p>
          <div className="space-y-2">
            {analysis.strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-green-400 text-sm mt-0.5 shrink-0">✓</span>
                <p className="text-gray-200 text-sm leading-snug">{s}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {analysis.weaknesses.length > 0 && (
        <div className="bg-ipl-card border border-ipl-border rounded-2xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-black mb-3">Weaknesses & Gaps</p>
          <div className="space-y-2">
            {analysis.weaknesses.map((w, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-red-400 text-sm mt-0.5 shrink-0">✗</span>
                <p className="text-gray-300 text-sm leading-snug">{w}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AI Report view ───────────────────────────────────────────────────────────

function AISquadReportView({ report, squad }: { report: AISquadReport; squad: SoldPlayerRecord[] }) {
  // Match AI player names back to squad records for price/flags display
  const byName = useMemo(() => {
    const m = new Map<string, SoldPlayerRecord>()
    for (const p of squad) m.set(p.name.toLowerCase(), p)
    return m
  }, [squad])

  const overseasInXI = report.bestXI.filter(p => {
    const rec = byName.get(p.name.toLowerCase())
    return rec?.isOverseas
  }).length

  return (
    <div className="space-y-4">

      {/* Analyst note */}
      <div className="bg-ipl-gold/8 border border-ipl-gold/25 rounded-2xl p-4">
        <p className="text-ipl-gold text-xs uppercase tracking-widest font-black mb-2">Analyst Verdict</p>
        <p className="text-gray-200 text-sm leading-relaxed italic">"{report.analystNote}"</p>
      </div>

      {/* Best XI */}
      <div className="bg-ipl-card border border-ipl-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-ipl-gold/10 border-b border-ipl-gold/20 flex items-center justify-between">
          <p className="text-ipl-gold text-xs uppercase tracking-widest font-black">Best Playing XI</p>
          <p className="text-gray-500 text-xs">{overseasInXI}/4 overseas</p>
        </div>
        <div className="px-4">
          {report.bestXI.map((entry, i) => {
            const rec = byName.get(entry.name.toLowerCase())
            return (
              <div key={i} className="py-2.5 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-gray-600 font-black text-xs w-5 text-center">{i + 1}</span>
                  <span className="text-base w-6 text-center">{ROLE_ICON[entry.role] ?? '🏏'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-white font-semibold text-sm truncate">{entry.name}</p>
                      {rec?.isRetained && <span className="text-[9px] px-1 py-0.5 rounded bg-ipl-accent/20 text-ipl-accent border border-ipl-accent/30 font-bold shrink-0">RTN</span>}
                      {rec?.isOverseas && <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold shrink-0">OVS</span>}
                    </div>
                    <p className="text-gray-500 text-xs italic mt-0.5">{entry.reason}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ROLE_COLOR[entry.role] ?? 'bg-white/10 text-gray-400'}`}>{entry.role}</span>
                  {rec && <span className="text-ipl-gold font-bold text-xs w-14 text-right shrink-0">₹{rec.soldPrice.toFixed(1)}Cr</span>}
                </div>
              </div>
            )
          })}
          {report.bestXI.length === 0 && <p className="text-gray-600 text-sm text-center py-6">Not enough players to form an XI</p>}
        </div>
      </div>

      {/* 12th man */}
      {report.twelfthMan && (
        <div className="bg-ipl-card border border-ipl-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-white/5 border-b border-white/8">
            <p className="text-gray-400 text-xs uppercase tracking-widest font-black">12th Man</p>
          </div>
          <div className="px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-gray-600 font-black text-xs w-5 text-center">12</span>
              <span className="text-base w-6 text-center">{ROLE_ICON[report.twelfthMan.role] ?? '🏏'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{report.twelfthMan.name}</p>
                <p className="text-gray-500 text-xs italic mt-0.5">{report.twelfthMan.reason}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ROLE_COLOR[report.twelfthMan.role] ?? 'bg-white/10 text-gray-400'}`}>{report.twelfthMan.role}</span>
            </div>
          </div>
        </div>
      )}

      {/* Role gaps */}
      {report.roleGaps.length > 0 && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-2xl p-4">
          <p className="text-red-400 text-xs uppercase tracking-widest font-black mb-2">Role Gaps</p>
          <div className="flex gap-2 flex-wrap">
            {report.roleGaps.map(g => (
              <span key={g} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 font-bold">
                {ROLE_ICON[g]} {g === 'BAT' ? 'Batters' : g === 'BWL' ? 'Bowlers' : g === 'AR' ? 'All-Rounders' : 'Wicketkeepers'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Strengths */}
      {report.strengths.length > 0 && (
        <div className="bg-ipl-card border border-ipl-border rounded-2xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-black mb-3">Strengths</p>
          <div className="space-y-2">
            {report.strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-green-400 text-sm mt-0.5 shrink-0">✓</span>
                <p className="text-gray-200 text-sm leading-snug">{s}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weaknesses */}
      {report.weaknesses.length > 0 && (
        <div className="bg-ipl-card border border-ipl-border rounded-2xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-black mb-3">Weaknesses</p>
          <div className="space-y-2">
            {report.weaknesses.map((w, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-red-400 text-sm mt-0.5 shrink-0">✗</span>
                <p className="text-gray-300 text-sm leading-snug">{w}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main SquadReport — AI with fallback ──────────────────────────────────────

interface SquadReportProps {
  squad: SoldPlayerRecord[]
  teamId: TeamId
  auctionYear: number
  allSquads: Record<string, { name: string; role: string; soldPrice: number }[]>
}

function SquadReport({ squad, teamId, auctionYear, allSquads }: SquadReportProps) {
  const [report, setReport] = useState<AISquadReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [errored, setErrored] = useState(false)
  const cache = useRef<Map<string, AISquadReport>>(new Map())

  useEffect(() => {
    const cached = cache.current.get(teamId)
    if (cached) { setReport(cached); setErrored(false); return }

    setLoading(true)
    setErrored(false)
    setReport(null)

    const ctx: SquadAnalysisContext = {
      teamId,
      auctionYear,
      squad: squad.map(p => ({
        name: p.name,
        role: p.role,
        country: p.country,
        soldPrice: p.soldPrice,
        isOverseas: p.isOverseas,
        cappedStatus: p.cappedStatus,
        isRetained: p.isRetained,
      })),
      allSquads,
    }

    callLLMJsonStrategic<AISquadReport>(buildSquadAnalysisMessages(ctx), { temperature: 0.4 })
      .then(r => {
        if (r && Array.isArray(r.bestXI) && r.bestXI.length > 0) {
          cache.current.set(teamId, r)
          setReport(r)
        } else {
          setErrored(true)
        }
      })
      .catch(() => setErrored(true))
      .finally(() => setLoading(false))
  }, [teamId])

  if (loading) {
    return (
      <div className="py-16">
        <LoadingSpinner label="Analysing squad with AI..." />
      </div>
    )
  }

  if (errored || !report) return <FallbackSquadReport squad={squad} />

  return <AISquadReportView report={report} squad={squad} />
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

  const allSquads = useMemo(() =>
    Object.fromEntries(
      Object.entries(gameState.teamStates).map(([tid, ts]) => [
        tid,
        ts.squad.map(p => ({ name: p.name, role: p.role, soldPrice: p.soldPrice })),
      ])
    ), [gameState.teamStates])
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
              onClick={() => { tap(); setSelectedTeam(tid as TeamId); setTab('squad') }}
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
          {/* Stacked balance bar */}
          {squad.length > 0 && (
            <div className="flex rounded-full overflow-hidden h-2 mb-3">
              <div style={{ width: `${(roleCounts.WK  / squad.length) * 100}%` }} className="bg-red-400" />
              <div style={{ width: `${(roleCounts.BAT / squad.length) * 100}%` }} className="bg-yellow-400" />
              <div style={{ width: `${(roleCounts.AR  / squad.length) * 100}%` }} className="bg-green-400" />
              <div style={{ width: `${(roleCounts.BWL / squad.length) * 100}%` }} className="bg-blue-400" />
            </div>
          )}
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
            onClick={() => { tap(); setTab('squad') }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === 'squad' ? 'bg-ipl-accent text-white shadow-md' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Squad
          </button>
          <button
            onClick={() => { tap(); setTab('report') }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === 'report' ? 'bg-ipl-accent text-white shadow-md' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Squad Analysis
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
          <SquadReport
            squad={squad}
            teamId={selectedTeam}
            auctionYear={gameState.auctionYear}
            allSquads={allSquads}
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
