import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { BottomNav } from '@components/ui/BottomNav'
import { TEAM_BADGE_COLORS } from '@components/ui/TeamBadge'
import type { SoldPlayerRecord } from '@/types/player'

const ROLE_COLOR: Record<string, string> = {
  BAT: 'bg-blue-500/20 text-blue-300',
  BWL: 'bg-red-500/20 text-red-300',
  AR:  'bg-green-500/20 text-green-300',
  WK:  'bg-yellow-500/20 text-yellow-300',
}
const ROLE_LABEL: Record<string, string> = { BAT: 'Bat', BWL: 'Bowl', AR: 'A/R', WK: 'WK' }

type Tab = 'sales' | 'log'

export function AuctionHistoryScreen() {
  const navigate = useNavigate()
  const { gameState } = useGameStore()
  const [tab, setTab] = useState<Tab>('sales')
  const [search, setSearch] = useState('')

  if (!gameState) {
    return (
      <div className="min-h-screen bg-ipl-dark flex items-center justify-center">
        <p className="text-gray-400">No active session. <button className="text-ipl-accent underline" onClick={() => navigate('/')}>Go home</button></p>
      </div>
    )
  }

  const soldPlayers = gameState.soldPlayers
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.soldTo.toLowerCase().includes(search.toLowerCase()))
    .slice()
    .reverse()

  const totalSpend = gameState.soldPlayers.reduce((s, p) => s + p.soldPrice, 0)
  const highestSale = gameState.soldPlayers.reduce<SoldPlayerRecord | null>((best, p) => {
    if (!best || p.soldPrice > best.soldPrice) return p
    return best
  }, null)

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
          <h1 className="text-white font-bold text-base leading-tight">Auction History</h1>
          <p className="text-gray-500 text-xs">{gameState.soldPlayers.length} sold · ₹{totalSpend.toFixed(1)} Cr total</p>
        </div>
      </header>

      {/* Summary strip */}
      <div className="px-4 py-3 flex gap-3">
        <div className="flex-1 bg-ipl-card border border-ipl-border rounded-xl p-3 text-center">
          <p className="text-ipl-gold text-lg font-black">{gameState.soldPlayers.length}</p>
          <p className="text-gray-500 text-xs">Sold</p>
        </div>
        <div className="flex-1 bg-ipl-card border border-ipl-border rounded-xl p-3 text-center">
          <p className="text-ipl-green text-lg font-black">₹{totalSpend.toFixed(1)}Cr</p>
          <p className="text-gray-500 text-xs">Total Spend</p>
        </div>
        <div className="flex-1 bg-ipl-card border border-ipl-border rounded-xl p-3 text-center">
          <p className="text-ipl-accent text-lg font-black">
            {highestSale ? `₹${highestSale.soldPrice.toFixed(1)}` : '—'}
          </p>
          <p className="text-gray-500 text-xs">Highest Sale</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pb-3 flex gap-2">
        {(['sales', 'log'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'flex-1 py-2 rounded-xl text-sm font-bold border transition-all',
              tab === t
                ? 'bg-ipl-accent border-ipl-accent text-white'
                : 'bg-ipl-card border-ipl-border text-gray-400',
            ].join(' ')}
          >
            {t === 'sales' ? '🏏 Sales' : '📋 Log'}
          </button>
        ))}
      </div>

      {tab === 'sales' && (
        <>
          <div className="px-4 pb-3">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search player or team..."
              className="w-full bg-ipl-card border border-ipl-border rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-ipl-accent"
            />
          </div>
          <div className="flex-1 px-4 flex flex-col gap-2">
            {soldPlayers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                <p className="text-5xl mb-3">🔨</p>
                <p className="text-gray-400 font-semibold">No sales yet</p>
              </div>
            ) : (
              soldPlayers.map((p, i) => <SaleRow key={`${p.playerId}-${i}`} player={p} rank={gameState.soldPlayers.length - i} />)
            )}
          </div>
        </>
      )}

      {tab === 'log' && (
        <div className="flex-1 px-4 flex flex-col gap-1 overflow-auto">
          {gameState.auctionLog.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-gray-500">No log entries yet</p>
            </div>
          ) : (
            [...gameState.auctionLog].reverse().map((entry, i) => (
              <div key={i} className="py-2 border-b border-ipl-border/40 flex gap-3 items-start">
                <span className="shrink-0 text-gray-700 text-xs font-mono pt-0.5">
                  #{gameState.auctionLog.length - i}
                </span>
                <p className="text-gray-300 text-sm leading-snug">{entry}</p>
              </div>
            ))
          )}
        </div>
      )}

      <BottomNav active="auction" />
    </div>
  )
}

function SaleRow({ player: p, rank }: { player: SoldPlayerRecord; rank: number }) {
  const teamColors = TEAM_BADGE_COLORS[p.soldTo] ?? { from: 'from-gray-600', to: 'to-gray-800', text: 'text-white' }

  return (
    <div className="bg-ipl-card border border-ipl-border rounded-xl px-4 py-3 flex items-center gap-3">
      <span className="shrink-0 text-gray-600 text-xs font-mono w-5 text-right">{rank}</span>

      <span className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black ${ROLE_COLOR[p.role]}`}>
        {ROLE_LABEL[p.role]}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{p.name}</p>
        <p className="text-gray-500 text-xs">{p.country}{p.isOverseas ? ' 🌍' : ''}{p.isRetained ? ' · Retained' : ''}</p>
      </div>

      <div className="shrink-0 text-right">
        <div className={`inline-flex items-center gap-1 bg-gradient-to-r ${teamColors.from} ${teamColors.to} rounded-lg px-2 py-1 mb-1`}>
          <span className={`text-xs font-black ${teamColors.text}`}>{p.soldTo}</span>
        </div>
        <p className="text-ipl-gold text-sm font-black text-right">₹{p.soldPrice.toFixed(2)} Cr</p>
      </div>
    </div>
  )
}
