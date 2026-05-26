import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { TeamBadge } from '@components/ui/TeamBadge'
import { BottomNav } from '@components/ui/BottomNav'
import type { TeamId } from '@/types/team'
import type { SoldPlayerRecord } from '@/types/player'

const ROLE_COLOR: Record<string, string> = {
  BAT: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  BWL: 'bg-red-500/20 text-red-300 border-red-500/30',
  AR:  'bg-green-500/20 text-green-300 border-green-500/30',
  WK:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
}
const ROLE_LABEL: Record<string, string> = { BAT: 'BAT', BWL: 'BWL', AR: 'A/R', WK: 'WK' }
const ROLE_ORDER: Record<string, number> = { WK: 0, BAT: 1, AR: 2, BWL: 3 }

export function MySquadScreen() {
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
  const teamState = gameState.teamStates[userTeam]
  const spent = teamState.squad.reduce((sum, p) => sum + p.soldPrice, 0)
  const totalPurse = teamState.currentPurse + spent
  const sorted = [...teamState.squad].sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9))

  const overseas = teamState.squad.filter(p => p.isOverseas).length
  const retained = teamState.squad.filter(p => p.isRetained).length

  return (
    <div className="min-h-screen bg-ipl-darker flex flex-col pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-ipl-darker/95 backdrop-blur border-b border-ipl-border safe-top">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => navigate('/auction')}
          >
            ←
          </button>
          <TeamBadge teamId={userTeam} size="md" showRing />
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-black text-base leading-tight">{userTeam} Squad</h1>
            <p className="text-gray-500 text-xs">{teamState.squad.length} players · My Team</p>
          </div>
        </div>

        {/* Purse bar */}
        <div className="px-4 pb-3 grid grid-cols-3 gap-2">
          <div className="bg-ipl-card rounded-xl px-3 py-2 text-center">
            <p className="text-ipl-gold font-black text-base">₹{teamState.currentPurse.toFixed(1)}Cr</p>
            <p className="text-gray-600 text-xs">Remaining</p>
          </div>
          <div className="bg-ipl-card rounded-xl px-3 py-2 text-center">
            <p className="text-ipl-accent font-black text-base">₹{spent.toFixed(1)}Cr</p>
            <p className="text-gray-600 text-xs">Spent</p>
          </div>
          <div className="bg-ipl-card rounded-xl px-3 py-2 text-center">
            <p className="text-white font-black text-base">{overseas}/8</p>
            <p className="text-gray-600 text-xs">Overseas</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className="h-1.5 bg-ipl-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-ipl-accent to-ipl-gold rounded-full transition-all"
              style={{ width: `${Math.min(100, (spent / totalPurse) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <p className="text-gray-700 text-xs">₹0</p>
            <p className="text-gray-700 text-xs">₹{totalPurse.toFixed(0)} Cr budget</p>
          </div>
        </div>
      </header>

      {/* Squad list */}
      <div className="flex-1 px-4 py-3 flex flex-col gap-2">
        {sorted.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <p className="text-5xl mb-3">👤</p>
            <p className="text-gray-400 font-semibold">No players yet</p>
            <p className="text-gray-600 text-sm mt-1">Win some bids to build your squad</p>
          </div>
        ) : (
          <>
            {retained > 0 && (
              <p className="text-gray-600 text-xs uppercase tracking-widest px-1 pt-2 pb-1">Retained ({retained})</p>
            )}
            {sorted.filter(p => p.isRetained).map(p => <PlayerRow key={p.playerId} player={p} />)}
            {teamState.squad.some(p => !p.isRetained) && (
              <p className="text-gray-600 text-xs uppercase tracking-widest px-1 pt-3 pb-1">
                Bought at Auction ({teamState.squad.filter(p => !p.isRetained).length})
              </p>
            )}
            {sorted.filter(p => !p.isRetained).map(p => <PlayerRow key={p.playerId} player={p} />)}
          </>
        )}
      </div>

      <BottomNav active="my-squad" />
    </div>
  )
}

function PlayerRow({ player: p }: { player: SoldPlayerRecord }) {
  return (
    <div className="bg-ipl-card border border-ipl-border rounded-xl px-4 py-3 flex items-center gap-3 animate-fade-in">
      <span className={`shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center text-xs font-black ${ROLE_COLOR[p.role]}`}>
        {ROLE_LABEL[p.role]}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-white font-semibold text-sm truncate">{p.name}</p>
          {p.isOverseas && <span className="text-xs">🌍</span>}
          {p.isRetained && <span className="text-xs bg-ipl-gold/20 text-ipl-gold rounded px-1 py-px text-[10px] font-bold">RTN</span>}
        </div>
        <p className="text-gray-500 text-xs truncate">{p.country} · {p.cappedStatus === 'uncapped' ? 'Uncapped' : 'Capped'}</p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-ipl-gold font-black text-sm">₹{p.soldPrice.toFixed(2)}</p>
        <p className="text-gray-600 text-xs">Cr</p>
      </div>
    </div>
  )
}
