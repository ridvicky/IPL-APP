import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tap } from '@/utils/haptics'
import { useGameStore } from '@/store/gameStore'
import { TeamBadge, TEAM_BADGE_COLORS } from '@components/ui/TeamBadge'
import { BottomNav } from '@components/ui/BottomNav'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { callLLMJsonPremium } from '@/llm/openRouterClient'
import { buildDeepSquadAnalysisMessages } from '@/llm/prompts'
import type { AIDeepSquadReport, DeepSquadAnalysisContext } from '@/llm/prompts'
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

// ─── Squad Analysis (rule-based fallback) ─────────────────────────────────────

function playerQuality(p: SoldPlayerRecord): number {
  const base = p.marketValue ?? (p.soldPrice > 0 ? p.soldPrice : p.basePrice)
  return p.cappedStatus === 'capped' ? base * 1.5 : base
}

function analyzeSquadFallback(squad: SoldPlayerRecord[]) {
  const byRole = (role: string) =>
    squad.filter(p => p.role === role).sort((a, b) => playerQuality(b) - playerQuality(a))

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

  xi.push(...pick(byRole('WK'), 1))
  xi.push(...pick(byRole('BAT'), 4))
  xi.push(...pick(byRole('AR'), 2))
  xi.push(...pick(byRole('BWL'), 4))
  if (xi.length < 11) {
    const fill = [...squad].filter(p => !used.has(p.playerId)).sort((a, b) => playerQuality(b) - playerQuality(a))
    xi.push(...pick(fill, 11 - xi.length))
  }

  // Overseas cap
  const overseas = xi.filter(p => p.isOverseas)
  if (overseas.length > 4) {
    const sorted = [...overseas].sort((a, b) => playerQuality(a) - playerQuality(b))
    const bench = squad.filter(p => !p.isOverseas && !used.has(p.playerId)).sort((a, b) => playerQuality(b) - playerQuality(a))
    let swapped = 0
    for (const out of sorted) {
      if (swapped >= overseas.length - 4) break
      const rep = bench[swapped]
      if (rep) { xi[xi.findIndex(p => p.playerId === out.playerId)] = rep; swapped++ }
    }
  }

  return { xi, overseasInXI: xi.filter(p => p.isOverseas).length }
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
      {player.isRetained && <span className="text-xs px-1.5 py-0.5 rounded bg-ipl-accent/20 text-ipl-accent border border-ipl-accent/30">RTN</span>}
      <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLOR[player.role]}`}>{player.role}</span>
      <span className="text-ipl-gold font-bold text-sm w-16 text-right">₹{player.soldPrice.toFixed(1)}Cr</span>
    </div>
  )
}

function scoreColor(s: number) {
  return s >= 70 ? 'text-green-400' : s >= 50 ? 'text-amber-400' : 'text-red-400'
}

function chancePill(chance: string) {
  const styles: Record<string, string> = {
    'Very High': 'bg-ipl-gold/20 text-ipl-gold border-ipl-gold/40',
    'High':      'bg-green-500/20 text-green-300 border-green-500/30',
    'Medium':    'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'Low':       'bg-red-500/20 text-red-300 border-red-500/30',
    'Very Low':  'bg-gray-500/20 text-gray-400 border-gray-500/20',
  }
  return styles[chance] ?? styles['Medium']
}

// ─── Fallback (rule-based) ────────────────────────────────────────────────────

function FallbackSquadReport({ squad }: { squad: SoldPlayerRecord[] }) {
  const { xi, overseasInXI } = useMemo(() => analyzeSquadFallback(squad), [squad])
  const roleCounts = { BAT: 0, BWL: 0, AR: 0, WK: 0 }
  for (const p of squad) if (p.role in roleCounts) roleCounts[p.role as keyof typeof roleCounts]++

  return (
    <div className="space-y-4">
      <div className="bg-ipl-card border border-ipl-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-ipl-gold/10 border-b border-ipl-gold/20 flex items-center justify-between">
          <p className="text-ipl-gold text-xs uppercase tracking-widest font-black">Best Playing XI</p>
          <p className="text-gray-500 text-xs">{overseasInXI}/4 overseas</p>
        </div>
        <div className="px-4">
          {xi.map((p, i) => (
            <div key={p.playerId} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
              <span className="text-gray-600 font-black text-xs w-5 text-center">{i + 1}</span>
              <span className="text-base w-6 text-center">{ROLE_ICON[p.role]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-white font-semibold text-sm truncate">{p.name}</p>
                  {p.isRetained && <span className="text-[9px] px-1 py-0.5 rounded bg-ipl-accent/20 text-ipl-accent border border-ipl-accent/30 font-bold shrink-0">RTN</span>}
                  {p.isOverseas && <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold shrink-0">OVS</span>}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLOR[p.role]}`}>{p.role}</span>
              <span className="text-ipl-gold font-bold text-xs w-14 text-right">₹{p.soldPrice.toFixed(1)}Cr</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-ipl-card border border-ipl-border rounded-2xl p-4">
        <p className="text-gray-400 text-xs uppercase tracking-widest font-black mb-3">Role Composition</p>
        <div className="grid grid-cols-4 gap-2">
          {(['WK', 'BAT', 'AR', 'BWL'] as const).map(role => (
            <div key={role} className="rounded-xl p-3 text-center border border-white/8 bg-white/5">
              <p className="text-lg">{ROLE_ICON[role]}</p>
              <p className="font-black text-xl text-white">{roleCounts[role]}</p>
              <p className="text-gray-500 text-[10px]">{role}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Deep Squad Report View ───────────────────────────────────────────────────

interface DeepSquadReportViewProps {
  report: AIDeepSquadReport
  squad: SoldPlayerRecord[]
  teamId: string
  isUserTeam: boolean
}

function DeepSquadReportView({ report, squad, teamId, isUserTeam }: DeepSquadReportViewProps) {
  const byName = useMemo(() => {
    const m = new Map<string, SoldPlayerRecord>()
    for (const p of squad) m.set(p.name.toLowerCase(), p)
    return m
  }, [squad])

  // Interactive XI swap (user team only)
  const [userXI, setUserXI] = useState<string[]>(() => report.bestXI.map(p => p.name))
  const [swapIdx, setSwapIdx] = useState<number | null>(null)

  const xiNameSet = new Set(userXI.map(n => n.toLowerCase()))
  const benchPlayers = squad.filter(p => !xiNameSet.has(p.name.toLowerCase()))
  const overseasInXI = userXI.filter(n => byName.get(n.toLowerCase())?.isOverseas).length

  function swapPlayer(bench: SoldPlayerRecord) {
    if (swapIdx === null) return
    const outRec = byName.get(userXI[swapIdx].toLowerCase())
    if (bench.isOverseas && !outRec?.isOverseas && overseasInXI >= 4) return
    setUserXI(prev => { const n = [...prev]; n[swapIdx] = bench.name; return n })
    setSwapIdx(null)
  }

  const scores = [
    { label: 'Overall',    value: report.squadOverallScore },
    { label: 'Leadership', value: report.leadershipScore },
    { label: 'Experience', value: report.experienceScore },
    { label: 'Youth',      value: report.youthPotentialScore },
  ]

  return (
    <div className="space-y-4">

      {/* Section 1 — Score Card */}
      <div className="grid grid-cols-2 gap-2">
        {scores.map(s => (
          <div key={s.label} className="bg-ipl-card border border-ipl-border rounded-2xl p-4 text-center">
            <p className={`font-black text-4xl leading-none ${scoreColor(s.value)}`}>{s.value}</p>
            <p className="text-gray-400 text-xs font-semibold mt-1.5 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Section 2 — Best XI with Backups */}
      <div className="bg-ipl-card border border-ipl-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-ipl-gold/10 border-b border-ipl-gold/20 flex items-center justify-between">
          <p className="text-ipl-gold text-xs uppercase tracking-widest font-black">
            {isUserTeam ? 'Your Playing XI' : 'Best Playing XI'}
          </p>
          <p className="text-gray-500 text-xs">{overseasInXI}/4 overseas</p>
        </div>
        <div className="px-4">
          {report.bestXI.map((entry, i) => {
            const displayName = isUserTeam ? userXI[i] : entry.name
            const rec = byName.get(displayName.toLowerCase())
            const isSwapping = isUserTeam && swapIdx === i
            return (
              <div key={i} className={`py-2.5 border-b border-white/5 last:border-0 ${isSwapping ? 'bg-ipl-accent/5' : ''}`}>
                {/* Main player row */}
                <div className="flex items-center gap-2.5">
                  <span className="text-gray-600 font-black text-xs w-5 text-center">{entry.battingOrder}</span>
                  <span className="text-base w-6 text-center">{ROLE_ICON[entry.role] ?? '🏏'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-white font-semibold text-sm">{displayName}</p>
                      {rec?.isRetained && <span className="text-[9px] px-1 py-0.5 rounded bg-ipl-accent/20 text-ipl-accent border border-ipl-accent/30 font-bold shrink-0">RTN</span>}
                      {rec?.isOverseas && <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold shrink-0">OVS</span>}
                    </div>
                    {!isUserTeam && <p className="text-gray-500 text-xs italic mt-0.5">{entry.reason}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ROLE_COLOR[entry.role] ?? 'bg-white/10 text-gray-400'}`}>{entry.role}</span>
                  {rec && <span className="text-ipl-gold font-bold text-xs w-14 text-right shrink-0">₹{rec.soldPrice.toFixed(1)}Cr</span>}
                  {isUserTeam && (
                    <button
                      onClick={() => { tap(); setSwapIdx(swapIdx === i ? null : i) }}
                      className={`ml-1 w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all ${isSwapping ? 'bg-ipl-accent text-white' : 'bg-white/8 text-gray-500'}`}
                    >⇄</button>
                  )}
                </div>
                {/* Backup row */}
                {entry.backup && (
                  <div className="flex items-center gap-2 mt-1 ml-11">
                    <span className="text-gray-600 text-[10px] shrink-0">↳ Backup:</span>
                    <span className="text-gray-400 text-xs font-semibold">{entry.backup}</span>
                    {entry.backupReason && <span className="text-gray-600 text-xs italic truncate">· {entry.backupReason}</span>}
                  </div>
                )}
                {/* Bench picker */}
                {isUserTeam && swapIdx === i && (
                  <div className="mt-2 ml-10 space-y-1">
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1.5">Swap with:</p>
                    {benchPlayers.map(bp => {
                      const canAdd = !(bp.isOverseas && !rec?.isOverseas && overseasInXI >= 4)
                      return (
                        <button key={bp.playerId} disabled={!canAdd} onClick={() => { tap(); swapPlayer(bp) }}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${canAdd ? 'bg-white/8 hover:bg-white/15 text-white' : 'bg-white/3 text-gray-600 cursor-not-allowed'}`}>
                          <span>{ROLE_ICON[bp.role]}</span>
                          <span className="flex-1 text-left font-semibold truncate">{bp.name}</span>
                          {bp.isOverseas && <span className="text-[9px] text-blue-400 font-bold">OVS</span>}
                          {!canAdd && <span className="text-[9px] text-red-400">OVS cap</span>}
                          <span className={`text-xs px-1.5 py-0.5 rounded ${ROLE_COLOR[bp.role]}`}>{bp.role}</span>
                          <span className="text-ipl-gold text-xs font-bold w-14 text-right">₹{bp.soldPrice.toFixed(1)}Cr</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 3 — Squad Completeness & Holes */}
      <div className="bg-ipl-card border border-ipl-border rounded-2xl p-4">
        <p className="text-gray-400 text-xs uppercase tracking-widest font-black mb-2">Squad Completeness</p>
        <p className="text-gray-200 text-sm leading-relaxed italic mb-3">"{report.squadCompleteness}"</p>
        {report.squadHoles.length > 0 && (
          <div className="space-y-2 border-t border-white/8 pt-3">
            <p className="text-gray-500 text-[10px] uppercase tracking-wider font-bold">Squad Holes</p>
            {report.squadHoles.map((hole, i) => {
              const style = hole.severity === 'critical'
                ? 'bg-red-500/15 border-red-500/30 text-red-300'
                : hole.severity === 'moderate'
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-white/8 border-white/15 text-gray-400'
              return (
                <div key={i} className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${style}`}>
                  <span className="font-black text-xs shrink-0 uppercase mt-0.5">{hole.role}</span>
                  <span className="text-xs leading-snug">{hole.comment}</span>
                  <span className="ml-auto text-[9px] font-black uppercase shrink-0">{hole.severity}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Section 4 — Breakout Stars */}
      {report.breakoutStars.length > 0 && (
        <div className="bg-ipl-card border border-ipl-border rounded-2xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-black mb-3">🌟 Breakout Stars</p>
          <div className="space-y-3">
            {report.breakoutStars.map((star, i) => {
              const rec = byName.get(star.name.toLowerCase())
              const tierColor = rec?.prospectTier === 'elite'
                ? 'bg-ipl-gold/20 text-ipl-gold border-ipl-gold/30'
                : rec?.prospectTier === 'promising'
                ? 'bg-green-500/20 text-green-300 border-green-500/30'
                : 'bg-white/10 text-gray-400 border-white/15'
              return (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-lg w-6 text-center mt-0.5">{ROLE_ICON[rec?.role ?? 'BAT']}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-white font-semibold text-sm">{star.name}</p>
                      {rec?.prospectTier && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-black uppercase ${tierColor}`}>{rec.prospectTier}</span>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs italic">{star.reason}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Section 5 — X Factors */}
      {report.xFactors.length > 0 && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4">
          <p className="text-green-400 text-xs uppercase tracking-widest font-black mb-3">⚡ X Factors</p>
          <div className="space-y-3">
            {report.xFactors.map((xf, i) => {
              const rec = byName.get(xf.name.toLowerCase())
              return (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-lg w-6 text-center mt-0.5">{ROLE_ICON[rec?.role ?? 'BAT']}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm mb-0.5">{xf.name}</p>
                    <p className="text-gray-400 text-xs italic">{xf.reason}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Section 6 — Stars to Build Around */}
      {report.starPlayersToBuildAround.length > 0 && (
        <div className="bg-ipl-gold/5 border border-ipl-gold/20 rounded-2xl p-4">
          <p className="text-ipl-gold text-xs uppercase tracking-widest font-black mb-3">🏆 Build Around</p>
          <div className="space-y-3">
            {report.starPlayersToBuildAround.map((star, i) => {
              const rec = byName.get(star.name.toLowerCase())
              return (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-lg w-6 text-center mt-0.5">{ROLE_ICON[rec?.role ?? 'BAT']}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-ipl-gold font-bold text-sm mb-0.5">{star.name}</p>
                    <p className="text-gray-400 text-xs italic">{star.reason}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Section 7 — Top 4 Chances */}
      {report.top4Chances.length > 0 && (
        <div className="bg-ipl-card border border-ipl-border rounded-2xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-black mb-3">📊 Season Top-4 Outlook</p>
          <div className="space-y-2.5">
            {report.top4Chances.map((t, i) => {
              const isSelected = t.teamId === teamId
              return (
                <div key={i} className={`flex items-start gap-3 rounded-xl p-2.5 ${isSelected ? 'bg-ipl-gold/8 border border-ipl-gold/20' : ''}`}>
                  <span className="text-gray-600 font-black text-xs w-4 text-center mt-0.5">{i + 1}</span>
                  <TeamBadge teamId={t.teamId} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`font-black text-xs ${isSelected ? 'text-ipl-gold' : 'text-white'}`}>{t.teamId}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full border font-black ${chancePill(t.chance)}`}>{t.chance}</span>
                    </div>
                    <p className="text-gray-500 text-xs leading-snug">{t.reasoning}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Section 8 — Final Verdict */}
      <div className="bg-ipl-gold/10 border-2 border-ipl-gold/40 rounded-2xl p-5">
        <p className="text-ipl-gold text-xs uppercase tracking-[0.22em] font-black mb-2">Final Verdict</p>
        <p className="text-ipl-gold font-black text-xl leading-tight mb-3">{report.verdictTitle}</p>
        <p className="text-gray-200 text-sm leading-relaxed italic">"{report.verdictComments}"</p>
      </div>

    </div>
  )
}

// ─── SquadReport — driven by pre-loaded report ────────────────────────────────

interface SquadReportProps {
  squad: SoldPlayerRecord[]
  teamId: TeamId
  preloadedReport: AIDeepSquadReport | 'loading' | 'error' | undefined
  isUserTeam: boolean
}

function SquadReport({ squad, teamId, preloadedReport, isUserTeam }: SquadReportProps) {
  if (preloadedReport === 'loading' || preloadedReport === undefined) {
    return (
      <div className="py-16">
        <LoadingSpinner label="Generating squad analysis with AI..." />
      </div>
    )
  }
  if (preloadedReport === 'error') return <FallbackSquadReport squad={squad} />
  return <DeepSquadReportView report={preloadedReport} squad={squad} teamId={teamId} isUserTeam={isUserTeam} />
}

function TeamSummaryCard({ teamId, active, reportStatus, onClick }: {
  teamId: string; active: boolean; reportStatus?: string | undefined; onClick: () => void
}) {
  const colors = TEAM_BADGE_COLORS[teamId] ?? { from: 'from-gray-500', to: 'to-gray-700', text: 'text-white', ring: 'ring-gray-400' }
  return (
    <button onClick={onClick}
      className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${
        active ? `bg-gradient-to-b ${colors.from} ${colors.to} shadow-lg scale-105` : 'bg-white/5 hover:bg-white/10'
      }`}
    >
      <TeamBadge teamId={teamId} size="md" showRing={active} />
      <span className={`text-xs font-bold ${active ? colors.text : 'text-gray-400'}`}>{teamId}</span>
      {reportStatus === 'loading' && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      )}
      {reportStatus === 'done' && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400" />
      )}
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
  const [allReports, setAllReports] = useState<Record<string, AIDeepSquadReport | 'loading' | 'error'>>({})
  const fetchedRef = useRef(false)

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
  const totalSpent = Object.values(gameState.teamStates).reduce((s, ts) =>
    s + ts.squad.reduce((ss, p) => ss + p.soldPrice, 0), 0)
  const topSale = [...gameState.soldPlayers].sort((a, b) => b.soldPrice - a.soldPrice)[0]
  const colors = TEAM_BADGE_COLORS[selectedTeam] ?? { from: 'from-gray-500', to: 'to-gray-700', text: 'text-white', ring: 'ring-gray-400' }

  // All teams summary for context (stable reference)
  const allTeamsSummary = useMemo(() =>
    allTeamIds.map(tid => {
      const ts = gameState.teamStates[tid]
      return {
        teamId: tid,
        playerCount: ts.squad.length,
        spent: ts.squad.reduce((s, p) => s + p.soldPrice, 0),
        purseLeft: ts.currentPurse,
      }
    }), [gameState.teamStates])

  // Pre-generate AI reports for all 10 teams on mount
  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    const initial: Record<string, AIDeepSquadReport | 'loading' | 'error'> = {}
    for (const tid of allTeamIds) initial[tid] = 'loading'
    setAllReports(initial)

    allTeamIds.forEach(tid => {
      const ts = gameState.teamStates[tid]
      const ctx: DeepSquadAnalysisContext = {
        teamId: tid,
        auctionYear: gameState.auctionYear,
        squad: ts.squad.map(p => ({
          name: p.name,
          role: p.role,
          country: p.country,
          soldPrice: p.soldPrice,
          isOverseas: p.isOverseas,
          cappedStatus: p.cappedStatus,
          isRetained: p.isRetained,
          boughtPrice: p.boughtPrice ?? null,
          previousTeam: p.previousTeam ?? null,
          ...(p.interestedTeams ? { interestedTeams: p.interestedTeams } : {}),
          ...(p.potential !== undefined ? { potential: p.potential } : {}),
          ...(p.prospectTier !== undefined ? { prospectTier: p.prospectTier } : {}),
          ...(p.age !== undefined ? { age: p.age } : {}),
        })),
        allTeams: allTeamsSummary,
      }
      callLLMJsonPremium<AIDeepSquadReport>(buildDeepSquadAnalysisMessages(ctx), { temperature: 0.6 })
        .then(r => {
          if (r && Array.isArray(r.bestXI) && r.bestXI.length > 0 && Array.isArray(r.top4Chances)) {
            setAllReports(prev => ({ ...prev, [tid]: r }))
          } else {
            setAllReports(prev => ({ ...prev, [tid]: 'error' }))
          }
        })
        .catch(() => setAllReports(prev => ({ ...prev, [tid]: 'error' })))
    })
  }, [])

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
          {allTeamIds.map(tid => {
            const r = allReports[tid]
            const status = r === undefined ? undefined : r === 'loading' ? 'loading' : 'done'
            return (
              <TeamSummaryCard
                key={tid} teamId={tid} active={tid === selectedTeam}
                reportStatus={status}
                onClick={() => { tap(); setSelectedTeam(tid as TeamId); setTab('squad') }}
              />
            )
          })}
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
                <div className={`text-xs py-1.5 rounded-lg font-bold ${ROLE_COLOR[role]}`}>{ROLE_ICON[role]} {roleCounts[role]}</div>
                <p className="text-gray-600 text-xs mt-1">{role}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab selector */}
      <div className="px-4 mb-4">
        <div className="flex bg-ipl-card rounded-xl p-1 border border-ipl-border">
          <button onClick={() => { tap(); setTab('squad') }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'squad' ? 'bg-ipl-accent text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>
            Squad
          </button>
          <button onClick={() => { tap(); setTab('report') }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'report' ? 'bg-ipl-accent text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>
            Squad Analysis
          </button>
        </div>
      </div>

      <div className="px-4">
        {tab === 'squad' && (
          <div className="bg-ipl-card rounded-2xl p-4 mb-4">
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">Squad · {squad.length} players</p>
            {squad.length === 0
              ? <p className="text-gray-600 text-sm text-center py-4">No players acquired</p>
              : squad.map(p => <PlayerRow key={p.playerId} player={p} />)
            }
          </div>
        )}

        {tab === 'report' && (
          <SquadReport
            squad={squad}
            teamId={selectedTeam}
            preloadedReport={allReports[selectedTeam]}
            isUserTeam={isUser}
          />
        )}

        <div className="flex flex-col gap-3 mt-4">
          <button onClick={() => navigate('/season-setup')}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-ipl-accent to-red-700 text-white font-black text-sm shadow-glow-accent hover:opacity-90 transition-opacity">
            🏆 Simulate the Season
          </button>
          <div className="flex gap-3">
            <button onClick={() => navigate('/unsold-players')}
              className="flex-1 py-3 rounded-xl bg-ipl-card border border-ipl-border text-gray-300 font-semibold text-sm hover:bg-ipl-card2 transition-colors">
              Unsold Players
            </button>
            <button onClick={() => navigate('/')}
              className="flex-1 py-3 rounded-xl bg-ipl-card border border-ipl-border text-gray-400 font-semibold text-sm hover:bg-ipl-card2 transition-colors">
              Home
            </button>
          </div>
        </div>
      </div>

      <BottomNav active="my-squad" />
    </div>
  )
}
