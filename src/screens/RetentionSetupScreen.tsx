import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { loadDataset, getPlayersInSet, getReleasedPlayerSet } from '@/dataset/datasetLoader'
import { Button } from '@components/ui/Button'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import type { AuctionDataset, HistoricalRetentionRecord } from '@/types/dataset'
import type { PlayerRecord } from '@/types/player'
import type { TeamId, TeamState } from '@/types/team'
import type { SoldPlayerRecord } from '@/types/player'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RetainedPlayerEntry {
  playerId: string
  name: string
  retentionPrice: number
  isOverseas: boolean
  role: 'BAT' | 'BWL' | 'AR' | 'WK'
  bowlingType?: 'pace' | 'spin'
  released: boolean   // user toggled this off
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TEAM_COLORS: Record<string, { bg: string; border: string; text: string; dot: string; ring: string }> = {
  CSK:  { bg: 'bg-yellow-900/25', border: 'border-yellow-600/40', text: 'text-yellow-300', dot: 'bg-yellow-400', ring: 'ring-yellow-500/30' },
  MI:   { bg: 'bg-blue-900/25',   border: 'border-blue-600/40',   text: 'text-blue-300',   dot: 'bg-blue-400',   ring: 'ring-blue-500/30' },
  RCB:  { bg: 'bg-red-900/25',    border: 'border-red-600/40',    text: 'text-red-300',    dot: 'bg-red-400',    ring: 'ring-red-500/30' },
  KKR:  { bg: 'bg-purple-900/25', border: 'border-purple-600/40', text: 'text-purple-300', dot: 'bg-purple-400', ring: 'ring-purple-500/30' },
  DC:   { bg: 'bg-sky-900/25',    border: 'border-sky-600/40',    text: 'text-sky-300',    dot: 'bg-sky-400',    ring: 'ring-sky-500/30' },
  RR:   { bg: 'bg-pink-900/25',   border: 'border-pink-600/40',   text: 'text-pink-300',   dot: 'bg-pink-400',   ring: 'ring-pink-500/30' },
  SRH:  { bg: 'bg-orange-900/25', border: 'border-orange-600/40', text: 'text-orange-300', dot: 'bg-orange-400', ring: 'ring-orange-500/30' },
  PBKS: { bg: 'bg-rose-900/25',   border: 'border-rose-600/40',   text: 'text-rose-300',   dot: 'bg-rose-400',   ring: 'ring-rose-500/30' },
  GT:   { bg: 'bg-cyan-900/25',   border: 'border-cyan-600/40',   text: 'text-cyan-300',   dot: 'bg-cyan-400',   ring: 'ring-cyan-500/30' },
  LSG:  { bg: 'bg-teal-900/25',   border: 'border-teal-600/40',   text: 'text-teal-300',   dot: 'bg-teal-400',   ring: 'ring-teal-500/30' },
}

const ROLE_LABEL: Record<string, string> = { BAT: 'Bat', BWL: 'Bowl', AR: 'AR', WK: 'WK' }

type Tab = 'retentions' | 'pool'

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTeamRetentions(
  dataset: AuctionDataset,
  teamStates?: import('@/types/game').GameState['teamStates'] | null,
): Map<TeamId, RetainedPlayerEntry[]> {
  // Build a flat lookup: playerId → retention record (for prices/metadata)
  const retentionMeta = new Map<string, import('@/types/dataset').HistoricalRetentionRecord['retainedPlayers'][number]>()
  for (const rec of dataset.historicalRetentions ?? []) {
    for (const p of rec.retainedPlayers) {
      retentionMeta.set(p.playerId, p)
    }
  }

  const map = new Map<TeamId, RetainedPlayerEntry[]>()

  if (teamStates) {
    // Post-trade: use gameState squads as the source of truth for who is on each team.
    // Look up retention metadata (price, bowlingType) from the dataset by playerId.
    for (const [teamId, ts] of Object.entries(teamStates) as [TeamId, import('@/types/team').TeamState][]) {
      const entries: RetainedPlayerEntry[] = ts.squad.map(p => {
        const meta = retentionMeta.get(p.playerId)
        return {
          playerId: p.playerId,
          name: p.name,
          retentionPrice: meta?.retentionPrice ?? p.soldPrice,
          isOverseas: p.isOverseas,
          role: p.role,
          ...(meta?.bowlingType ? { bowlingType: meta.bowlingType } : {}),
          released: false,
        }
      })
      map.set(teamId, entries)
    }
  } else {
    // Initial load (no trades yet) — build from dataset retentions directly
    for (const rec of dataset.historicalRetentions ?? []) {
      map.set(rec.teamId, rec.retainedPlayers.map(p => ({
        playerId: p.playerId,
        name: p.name ?? p.playerId,
        retentionPrice: p.retentionPrice,
        isOverseas: p.isOverseas,
        role: p.role ?? 'BAT' as const,
        ...(p.bowlingType ? { bowlingType: p.bowlingType } : {}),
        released: false,
      })))
    }
  }

  return map
}

function buildPlayerRecord(
  p: RetainedPlayerEntry,
  previousTeam: TeamId,
  dataset: AuctionDataset,
): PlayerRecord {
  const targetSet = getReleasedPlayerSet(p.role, p.isOverseas, p.bowlingType, p.retentionPrice)
  // Place released stars at front of their set (they outrank regular pool entries)
  const existingInSet = getPlayersInSet(dataset, targetSet)
  const minOrder = existingInSet.length > 0 ? Math.min(...existingInSet.map(e => e.auctionSetOrder)) - 1 : 1
  return {
    playerId: p.playerId,
    name: p.name,
    role: p.role,
    nationality: p.isOverseas ? 'overseas' : 'indian',
    country: p.isOverseas ? 'Unknown' : 'India',
    cappedStatus: 'capped',
    isOverseas: p.isOverseas,
    basePrice: 2.0,   // released stars default base price
    auctionSet: targetSet,
    auctionSetOrder: minOrder,
    previousTeam,
    rtmEligibleFor: previousTeam,  // released retained players keep RTM eligibility for their old team
  }
}

function computeTeamStateFromEdits(
  teamId: TeamId,
  entries: RetainedPlayerEntry[],
  originalRecord: HistoricalRetentionRecord | undefined,
): TeamState {
  const retained = entries.filter(e => !e.released)
  const squad: SoldPlayerRecord[] = retained.map(e => ({
    playerId: e.playerId,
    name: e.name,
    role: e.role,
    nationality: e.isOverseas ? 'overseas' : 'indian',
    country: e.isOverseas ? 'Unknown' : 'India',
    cappedStatus: 'capped',
    isOverseas: e.isOverseas,
    basePrice: e.retentionPrice,
    auctionSet: '',
    auctionSetOrder: 0,
    previousTeam: teamId,
    rtmEligibleFor: null,
    soldPrice: e.retentionPrice,
    soldTo: teamId,
    isRetained: true,
  }))
  const retentionCost = retained.reduce((s, e) => s + e.retentionPrice, 0)
  const startingPurse = (originalRecord?.purseAfterRetention ?? 0) +
    (originalRecord?.retainedPlayers.reduce((s, p) => s + p.retentionPrice, 0) ?? 0)
  return {
    currentPurse: startingPurse - retentionCost,
    squad,
    rtmSlotsAvailable: originalRecord?.rtmSlotsAvailable ?? 0,
    rtmSlotsUsed: 0,
    overseasCount: retained.filter(e => e.isOverseas).length,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RetentionSetupScreen() {
  const navigate = useNavigate()
  const { gameState, applyRetentionEdits } = useGameStore()
  const [dataset, setDataset] = useState<AuctionDataset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('retentions')
  const [expandedTeam, setExpandedTeam] = useState<TeamId | null>(null)
  // retentions[teamId] = list of players with released toggles
  const [retentions, setRetentions] = useState<Map<TeamId, RetainedPlayerEntry[]>>(new Map())

  useEffect(() => {
    if (!gameState) return
    loadDataset(gameState.auctionYear)
      .then(ds => {
        setDataset(ds)
        // Use gameState.teamStates if squads exist (post-trade) — otherwise fall back to dataset
        const hasTrades = Object.values(gameState.teamStates).some(ts => ts.squad.length > 0)
        setRetentions(buildTeamRetentions(ds, hasTrades ? gameState.teamStates : null))
      })
      .catch(e => setError(String(e)))
  }, [gameState?.auctionYear])

  const toggleRelease = useCallback((teamId: TeamId, playerId: string) => {
    setRetentions(prev => {
      const next = new Map(prev)
      const entries = next.get(teamId)?.map(e =>
        e.playerId === playerId ? { ...e, released: !e.released } : e,
      ) ?? []
      next.set(teamId, entries)
      return next
    })
  }, [])

  const resetTeam = useCallback((teamId: TeamId) => {
    if (!dataset || !gameState) return
    const hasTrades = Object.values(gameState.teamStates).some(ts => ts.squad.length > 0)
    const original = buildTeamRetentions(dataset, hasTrades ? gameState.teamStates : null).get(teamId) ?? []
    setRetentions(prev => { const n = new Map(prev); n.set(teamId, original); return n })
  }, [dataset, gameState])

  const handleBeginAuction = useCallback(() => {
    if (!dataset || !gameState) return

    const newTeamStates: Record<TeamId, TeamState> = {} as Record<TeamId, TeamState>
    const allReleased: PlayerRecord[] = []

    for (const teamId of dataset.teams) {
      const entries = retentions.get(teamId) ?? []
      const originalRecord = dataset.historicalRetentions?.find(r => r.teamId === teamId)
      newTeamStates[teamId] = computeTeamStateFromEdits(teamId, entries, originalRecord)
      const released = entries.filter(e => e.released)
        .map(e => buildPlayerRecord(e, teamId, dataset))
      allReleased.push(...released)
    }

    applyRetentionEdits(newTeamStates, allReleased)
    navigate('/auction')
  }, [dataset, gameState, retentions, applyRetentionEdits, navigate])

  // ── Loading / error states ─────────────────────────────────────────────────

  if (!gameState) return (
    <div className="min-h-screen bg-ipl-dark flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-gray-400 mb-4">No active session.</p>
        <Button variant="secondary" size="md" onClick={() => navigate('/')}>Home</Button>
      </div>
    </div>
  )

  if (!dataset) {
    if (error) return (
      <div className="min-h-screen bg-ipl-dark flex items-center justify-center p-4">
        <div className="text-center gap-3 flex flex-col">
          <p className="text-ipl-accent font-bold">Error loading dataset</p>
          <p className="text-gray-500 text-sm">{error}</p>
          <Button variant="secondary" size="md" onClick={() => navigate('/')}>Home</Button>
        </div>
      </div>
    )
    return <div className="min-h-screen bg-ipl-dark flex items-center justify-center"><LoadingSpinner label="Loading retentions..." /></div>
  }

  const userTeam = gameState.userFranchise as TeamId
  const totalReleased = [...retentions.values()].flatMap(e => e).filter(e => e.released).length
  const totalRetained = [...retentions.values()].flatMap(e => e).filter(e => !e.released).length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">

      {/* Header */}
      <header className="border-b border-white/10 bg-black/60 px-5 py-4 flex items-center justify-between flex-shrink-0 safe-top">
        <div>
          <p className="text-ipl-gold font-black text-lg">IPL {gameState.auctionYear} Mega Auction</p>
          <p className="text-gray-500 text-xs mt-0.5">Review and edit team retentions before the auction</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-green-900/40 border border-green-700/40 text-green-300 rounded-lg px-3 py-1.5">
            {totalRetained} retained
          </span>
          {totalReleased > 0 && (
            <span className="bg-orange-900/40 border border-orange-700/40 text-orange-300 rounded-lg px-3 py-1.5">
              {totalReleased} released
            </span>
          )}
          <span className="bg-white/5 border border-white/10 text-gray-400 rounded-lg px-3 py-1.5">
            {dataset.players.length + totalReleased} in pool
          </span>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-white/10 flex-shrink-0">
        {(['retentions', 'pool'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-6 py-3 text-sm font-semibold capitalize transition-colors border-b-2 ${
              tab === t ? 'border-ipl-accent text-white' : 'border-transparent text-gray-600 hover:text-gray-400'
            }`}
          >
            {t === 'retentions' ? 'Team Retentions' : 'Auction Pool'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── Retentions tab ─────────────────────────────────────────────── */}
        {tab === 'retentions' && (
          <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-3">
            <p className="text-gray-600 text-xs">
              Click a player to release them — they'll enter the auction in their role's set. Click again to restore.
            </p>

            {dataset.teams.map(teamId => {
              const entries = retentions.get(teamId) ?? []
              const retained = entries.filter(e => !e.released)
              const released = entries.filter(e => e.released)
              const originalRecord = dataset.historicalRetentions?.find(r => r.teamId === teamId)
              const colors = TEAM_COLORS[teamId] ?? { bg: 'bg-gray-900', border: 'border-gray-700', text: 'text-gray-300', dot: 'bg-gray-400', ring: 'ring-gray-500/30' }
              const isUser = teamId === userTeam
              const isExpanded = expandedTeam === teamId
              const hasChanges = released.length > 0

              // Recompute purse for live feedback
              const retentionCost = retained.reduce((s, e) => s + e.retentionPrice, 0)
              const startingPurse = (originalRecord?.purseAfterRetention ?? 0) +
                (originalRecord?.retainedPlayers.reduce((s, p) => s + p.retentionPrice, 0) ?? 0)
              const livePurse = startingPurse - retentionCost

              return (
                <div key={teamId}
                  className={`rounded-xl border overflow-hidden transition-all ${colors.bg} ${colors.border} ${isUser ? `ring-2 ${colors.ring}` : ''}`}
                >
                  {/* Team header */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                    onClick={() => setExpandedTeam(isExpanded ? null : teamId as TeamId)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                      <span className={`font-black text-base ${colors.text}`}>{teamId}</span>
                      {isUser && <span className="text-white text-xs bg-white/10 rounded px-1.5 py-0.5 font-bold">YOU</span>}
                      {hasChanges && <span className="text-orange-400 text-xs bg-orange-900/30 border border-orange-700/30 rounded px-1.5 py-0.5">{released.length} released</span>}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className={`font-bold text-sm ${hasChanges ? 'text-ipl-gold' : 'text-white'}`}>
                          ₹{livePurse.toFixed(1)} Cr
                        </p>
                        <p className="text-gray-600 text-xs">{retained.length} retained</p>
                      </div>
                      <span className={`text-gray-500 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                  </button>

                  {/* Expanded player list */}
                  {isExpanded && (
                    <div className="border-t border-white/5 px-4 pb-4 pt-3">
                      {entries.length === 0 ? (
                        <p className="text-gray-600 text-sm py-1">No retentions — full purse available.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {entries.map(entry => {
                            const targetSet = getReleasedPlayerSet(entry.role, entry.isOverseas, entry.bowlingType, entry.retentionPrice)
                            return (
                              <div
                                key={entry.playerId}
                                onClick={() => toggleRelease(teamId as TeamId, entry.playerId)}
                                className={`flex items-center justify-between rounded-lg px-3 py-2.5 border cursor-pointer transition-all select-none ${
                                  entry.released
                                    ? 'bg-red-950/40 border-red-800/40 opacity-60'
                                    : 'bg-white/5 border-white/8 hover:bg-white/8'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className={`text-xs font-bold rounded px-1.5 py-0.5 flex-shrink-0 ${
                                    entry.released ? 'bg-red-900/50 text-red-400' : 'bg-white/10 text-gray-400'
                                  }`}>
                                    {entry.released ? 'OUT' : 'IN'}
                                  </span>
                                  <span className={`font-medium text-sm truncate ${entry.released ? 'line-through text-gray-600' : 'text-gray-200'}`}>
                                    {entry.name}
                                  </span>
                                  <span className="text-gray-700 text-xs flex-shrink-0">
                                    {ROLE_LABEL[entry.role]}{entry.bowlingType ? ` (${entry.bowlingType})` : ''}
                                  </span>
                                  {entry.isOverseas && (
                                    <span className="text-blue-500 text-xs flex-shrink-0">Overseas</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                                  {entry.released && (
                                    <span className="text-gray-600 text-xs hidden sm:block">→ {targetSet}</span>
                                  )}
                                  <span className={`font-bold text-sm ${entry.released ? 'text-gray-600' : colors.text}`}>
                                    ₹{entry.retentionPrice.toFixed(1)} Cr
                                  </span>
                                </div>
                              </div>
                            )
                          })}

                          {/* Summary row */}
                          <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-2">
                            <div className="flex items-center gap-3">
                              <span className="text-gray-600 text-xs">
                                Cost: ₹{retentionCost.toFixed(1)} Cr
                              </span>
                              {hasChanges && (
                                <button
                                  onClick={e => { e.stopPropagation(); resetTeam(teamId as TeamId) }}
                                  className="text-gray-600 hover:text-gray-400 text-xs underline"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                            <span className={`text-sm font-bold ${hasChanges ? 'text-ipl-gold' : 'text-white'}`}>
                              Purse: ₹{livePurse.toFixed(1)} Cr
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Auction pool tab ───────────────────────────────────────────── */}
        {tab === 'pool' && (
          <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-4">
            {/* Released players notice */}
            {totalReleased > 0 && (
              <div className="bg-orange-900/20 border border-orange-700/30 rounded-xl px-4 py-3">
                <p className="text-orange-300 text-sm font-medium">
                  {totalReleased} released player{totalReleased !== 1 ? 's' : ''} will be added to their respective sets
                </p>
              </div>
            )}

            {dataset.auctionSets.map(setName => {
              const releasedForSet = [...retentions.values()]
                .flatMap(entries => entries.filter(e => e.released))
                .filter(e => getReleasedPlayerSet(e.role, e.isOverseas, e.bowlingType, e.retentionPrice) === setName)

              const regular = getPlayersInSet(dataset, setName)
              const total = regular.length + releasedForSet.length


              return (
                <div key={setName} className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                    <span className="text-white font-bold text-sm">{setName}</span>
                    <span className="text-gray-500 text-xs">
                      {total} player{total !== 1 ? 's' : ''}
                      {releasedForSet.length > 0 && (
                        <span className="text-orange-400 ml-1.5">+{releasedForSet.length} released</span>
                      )}
                    </span>
                  </div>

                  <div className="px-4 py-2.5 flex flex-wrap gap-1.5">
                      {releasedForSet.map(e => (
                        <span key={e.playerId} className="text-xs text-orange-300 bg-orange-900/30 border border-orange-700/30 rounded px-2 py-0.5">
                          {e.name} ★
                        </span>
                      ))}
                      {regular.slice(0, 18).map(p => (
                        <span key={p.playerId} className="text-xs text-gray-400 bg-white/5 border border-white/8 rounded px-2 py-0.5"
                          title={`Base: ₹${p.basePrice} Cr · ${p.role}`}>
                          {p.name}
                        </span>
                      ))}
                      {regular.length > 18 && (
                        <span className="text-xs text-gray-600 px-2 py-0.5">+{regular.length - 18} more</span>
                      )}
                    </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 bg-black/60 px-5 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-gray-400 text-sm">
            Playing as <span className="text-white font-bold">{userTeam}</span>
            {totalReleased > 0 && <span className="text-orange-400 ml-2 text-xs">· {totalReleased} custom release{totalReleased !== 1 ? 's' : ''}</span>}
          </p>
          <p className="text-gray-600 text-xs mt-0.5">
            Your purse: ₹{((() => {
              const entries = retentions.get(userTeam) ?? []
              const retained = entries.filter(e => !e.released)
              const originalRecord = dataset.historicalRetentions?.find(r => r.teamId === userTeam)
              const retentionCost = retained.reduce((s, e) => s + e.retentionPrice, 0)
              const startingPurse = (originalRecord?.purseAfterRetention ?? 0) +
                (originalRecord?.retainedPlayers.reduce((s, p) => s + p.retentionPrice, 0) ?? 0)
              return startingPurse - retentionCost
            })()).toFixed(1)} Cr · {(retentions.get(userTeam) ?? []).filter(e => !e.released).length} retained
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={handleBeginAuction}>
          Begin Auction →
        </Button>
      </div>
    </div>
  )
}
