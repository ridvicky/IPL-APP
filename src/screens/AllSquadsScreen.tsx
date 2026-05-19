import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { TeamBadge, TEAM_BADGE_COLORS } from '@components/ui/TeamBadge'
import { BottomNav } from '@components/ui/BottomNav'
import type { TeamId } from '@/types/team'
import { ALL_TEAM_IDS } from '@/types/team'
import type { SoldPlayerRecord } from '@/types/player'

const ROLE_COLOR: Record<string, string> = {
  BAT: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  BWL: 'bg-red-500/20 text-red-300 border-red-500/30',
  AR:  'bg-green-500/20 text-green-300 border-green-500/30',
  WK:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
}
const ROLE_LABEL: Record<string, string> = { BAT: 'BAT', BWL: 'BWL', AR: 'A/R', WK: 'WK' }
const ROLE_ORDER: Record<string, number> = { WK: 0, BAT: 1, AR: 2, BWL: 3 }

export function AllSquadsScreen() {
  const navigate = useNavigate()
  const { gameState } = useGameStore()
  const [selected, setSelected] = useState<TeamId>(ALL_TEAM_IDS[0])

  if (!gameState) {
    return (
      <div className="min-h-screen bg-ipl-darker flex items-center justify-center">
        <p className="text-gray-400">No active session.</p>
      </div>
    )
  }

  const teamState = gameState.teamStates[selected]
  const sorted = [...teamState.squad].sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9))
  const isUserTeam = selected === gameState.userFranchise
  const badgeColors = TEAM_BADGE_COLORS[selected]

  return (
    <div className="min-h-screen bg-ipl-darker flex flex-col pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-ipl-darker/95 backdrop-blur border-b border-ipl-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => navigate('/auction')}
          >
            ←
          </button>
          <h1 className="text-white font-bold text-base">All Squads</h1>
        </div>

        {/* Team selector — horizontal scroll */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
          {ALL_TEAM_IDS.map(id => {
            const isActive = selected === id
            const tc = TEAM_BADGE_COLORS[id]
            return (
              <button
                key={id}
                onClick={() => setSelected(id)}
                className={[
                  'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all',
                  isActive
                    ? `bg-gradient-to-r ${tc.from} ${tc.to} ${tc.text} border-transparent shadow-md`
                    : 'bg-ipl-card border-ipl-border text-gray-400 hover:border-ipl-border/80',
                ].join(' ')}
              >
                {id}
                {id === gameState.userFranchise && <span className="text-[10px]">★</span>}
              </button>
            )
          })}
        </div>

        {/* Selected team summary */}
        <div className={`mx-4 mb-3 rounded-xl bg-gradient-to-r ${badgeColors?.from ?? 'from-gray-700'} ${badgeColors?.to ?? 'to-gray-900'} p-px`}>
          <div className="bg-ipl-card rounded-xl px-4 py-3 flex items-center gap-3">
            <TeamBadge teamId={selected} size="md" showRing />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-white font-black text-base">{selected}</p>
                {isUserTeam && <span className="text-ipl-gold text-xs font-bold bg-ipl-gold/10 rounded px-1.5 py-px">YOUR TEAM</span>}
              </div>
              <p className="text-gray-500 text-xs">{teamState.squad.length} players · {teamState.overseasCount}/8 overseas</p>
            </div>
            <div className="text-right">
              <p className="text-ipl-gold font-black text-sm">₹{teamState.currentPurse.toFixed(1)}Cr</p>
              <p className="text-gray-600 text-xs">remaining</p>
            </div>
          </div>
        </div>
      </header>

      {/* Squad list */}
      <div className="flex-1 px-4 py-2 flex flex-col gap-2">
        {sorted.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <p className="text-5xl mb-3">👥</p>
            <p className="text-gray-400 font-semibold">{selected} have no players yet</p>
          </div>
        ) : (
          sorted.map(p => <PlayerRow key={p.playerId} player={p} />)
        )}
      </div>

      <BottomNav active="all-squads" />
    </div>
  )
}

function PlayerRow({ player: p }: { player: SoldPlayerRecord }) {
  return (
    <div className="bg-ipl-card border border-ipl-border rounded-xl px-4 py-3 flex items-center gap-3">
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

      <p className="shrink-0 text-ipl-gold font-black text-sm">₹{p.soldPrice.toFixed(2)} Cr</p>
    </div>
  )
}
