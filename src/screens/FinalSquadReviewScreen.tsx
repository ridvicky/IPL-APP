import { useState } from 'react'
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
        ₹{player.soldPrice.toFixed(1)}
      </span>
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

  // Default selected = user's team
  const [selectedTeam, setSelectedTeam] = useState<TeamId>(userTeam)

  const teamState = gameState.teamStates[selectedTeam]
  const squad = [...teamState.squad].sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9))
  const spent = squad.reduce((s, p) => s + p.soldPrice, 0)
  const overseas = squad.filter(p => p.isOverseas).length
  const retained = squad.filter(p => p.isRetained).length
  const isUser = selectedTeam === userTeam

  const roleCounts = { BAT: 0, BWL: 0, AR: 0, WK: 0 }
  for (const p of squad) { if (p.role in roleCounts) roleCounts[p.role as keyof typeof roleCounts]++ }

  // Auction summary
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
            <p className="text-white/60 text-sm">IPL {gameState.auctionYear}</p>
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
              onClick={() => setSelectedTeam(tid)}
            />
          ))}
        </div>
      </div>

      {/* Squad detail */}
      <div className="px-4">
        {/* Team header */}
        <div className={`rounded-2xl bg-gradient-to-br ${colors.from} ${colors.to} p-4 mb-4 flex items-center gap-4`}>
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

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
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

        {/* Role composition bar */}
        <div className="bg-ipl-card rounded-xl p-3 mb-4">
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

        {/* Player list */}
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

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/season-setup')}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-ipl-accent to-red-700 text-white font-black text-sm shadow-glow-accent hover:opacity-90 transition-opacity"
          >
            🏆 Simulate the Season
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/unsold')}
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

