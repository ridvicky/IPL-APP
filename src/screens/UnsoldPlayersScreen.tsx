import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tap } from '@/utils/haptics'
import { useGameStore } from '@/store/gameStore'
import { BottomNav } from '@components/ui/BottomNav'
import type { UnsoldPlayerRecord } from '@/types/player'

const ROLE_LABEL: Record<string, string> = { BAT: 'Bat', BWL: 'Bowl', AR: 'A/R', WK: 'WK' }
const ROLE_COLOR: Record<string, string> = {
  BAT: 'bg-blue-500/20 text-blue-300',
  BWL: 'bg-red-500/20 text-red-300',
  AR:  'bg-green-500/20 text-green-300',
  WK:  'bg-yellow-500/20 text-yellow-300',
}

type FilterRole = 'ALL' | 'BAT' | 'BWL' | 'AR' | 'WK'

export function UnsoldPlayersScreen() {
  const navigate = useNavigate()
  const { gameState } = useGameStore()
  const [filter, setFilter] = useState<FilterRole>('ALL')
  const [search, setSearch] = useState('')

  if (!gameState) {
    return (
      <div className="min-h-screen bg-ipl-dark flex items-center justify-center">
        <p className="text-gray-400">No active session. <button className="text-ipl-accent underline" onClick={() => navigate('/')}>Go home</button></p>
      </div>
    )
  }

  const players = gameState.unsoldPlayers
    .filter(p => filter === 'ALL' || p.role === filter)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.basePrice - a.basePrice)

  const total = gameState.unsoldPlayers.length
  const byRole = {
    BAT: gameState.unsoldPlayers.filter(p => p.role === 'BAT').length,
    BWL: gameState.unsoldPlayers.filter(p => p.role === 'BWL').length,
    AR:  gameState.unsoldPlayers.filter(p => p.role === 'AR').length,
    WK:  gameState.unsoldPlayers.filter(p => p.role === 'WK').length,
  }

  return (
    <div className="min-h-screen bg-ipl-dark flex flex-col pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-ipl-dark/95 backdrop-blur border-b border-ipl-border px-4 py-3 flex items-center gap-3 safe-top">
        <button
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          onClick={() => navigate('/auction')}
        >
          ←
        </button>
        <div className="flex-1">
          <h1 className="text-white font-bold text-base leading-tight">Opportunity Board</h1>
          <p className="text-gray-500 text-xs">{total} players available · sorted by base price</p>
        </div>
      </header>

      {/* Summary cards */}
      <div className="px-4 py-3 grid grid-cols-4 gap-2">
        {(['BAT', 'BWL', 'AR', 'WK'] as const).map(role => (
          <button
            key={role}
            onClick={() => { tap(); setFilter(filter === role ? 'ALL' : role) }}
            className={[
              'rounded-xl p-2.5 text-center border transition-all',
              filter === role
                ? `${ROLE_COLOR[role]} border-current`
                : 'bg-ipl-card border-ipl-border',
            ].join(' ')}
          >
            <p className={`text-lg font-black ${filter === role ? '' : 'text-white'}`}>{byRole[role]}</p>
            <p className={`text-xs font-semibold ${filter === role ? '' : 'text-gray-500'}`}>{ROLE_LABEL[role]}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search player..."
          className="w-full bg-ipl-card border border-ipl-border rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-ipl-accent"
        />
      </div>

      {/* Player list */}
      <div className="flex-1 px-4 flex flex-col gap-2">
        {players.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <p className="text-5xl mb-3">🏏</p>
            <p className="text-gray-400 font-semibold">
              {total === 0 ? 'No unsold players yet' : 'No players match filter'}
            </p>
          </div>
        ) : (
          players.map(p => <UnsoldPlayerRow key={p.playerId} player={p} />)
        )}
      </div>

      <BottomNav active="unsold" />
    </div>
  )
}

function UnsoldPlayerRow({ player: p }: { player: UnsoldPlayerRecord }) {
  return (
    <div className="bg-ipl-card border border-ipl-border rounded-xl px-4 py-3 flex items-center gap-3">
      {/* Role badge */}
      <span className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black ${ROLE_COLOR[p.role]}`}>
        {ROLE_LABEL[p.role]}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-white font-semibold text-sm truncate">{p.name}</p>
          {p.isOverseas && <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold shrink-0">OVS</span>}
          {p.cappedStatus === 'capped' && <span className="text-[9px] px-1 py-0.5 rounded bg-ipl-gold/20 text-ipl-gold border border-ipl-gold/30 font-bold shrink-0">INT'L</span>}
        </div>
        <p className="text-gray-500 text-xs">{p.country}</p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-white font-black text-sm">₹{p.basePrice.toFixed(1)}Cr</p>
        <p className="text-gray-600 text-[10px]">base price</p>
      </div>
    </div>
  )
}
