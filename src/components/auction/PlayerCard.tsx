import { Badge } from '@components/ui/Badge'
import type { PlayerRecord } from '@/types/player'

interface PlayerCardProps {
  player: PlayerRecord
  currentBid?: number | undefined
  currentLeader?: string | null | undefined
}

const roleLabels: Record<string, string> = {
  BAT: 'Batter', BWL: 'Bowler', AR: 'All-Rounder', WK: 'Wicket-Keeper',
}
const roleGradient: Record<string, string> = {
  BAT: 'from-yellow-600/30 via-yellow-900/10 to-transparent',
  BWL: 'from-blue-600/30 via-blue-900/10 to-transparent',
  AR:  'from-green-600/30 via-green-900/10 to-transparent',
  WK:  'from-red-600/30 via-red-900/10 to-transparent',
}
const roleStripe: Record<string, string> = {
  BAT: 'from-yellow-400 to-yellow-600',
  BWL: 'from-blue-400 to-blue-600',
  AR:  'from-green-400 to-green-600',
  WK:  'from-red-400 to-red-600',
}
const roleVariant: Record<string, 'gold' | 'blue' | 'green' | 'red'> = {
  BAT: 'gold', BWL: 'blue', AR: 'green', WK: 'red',
}
const roleIcon: Record<string, string> = {
  BAT: '🏏', BWL: '🎯', AR: '⚡', WK: '🧤',
}

// Country → flag emoji map (common cricket nations)
const FLAG: Record<string, string> = {
  India: '🇮🇳',
  Australia: '🇦🇺',
  England: '🏴',
  'South Africa': '🇿🇦',
  'New Zealand': '🇳🇿',
  'West Indies': '🌴',
  Pakistan: '🇵🇰',
  Bangladesh: '🇧🇩',
  'Sri Lanka': '🇱🇰',
  Afghanistan: '🇦🇫',
  Zimbabwe: '🇿🇼',
  Ireland: '🇮🇪',
  Netherlands: '🇳🇱',
  USA: '🇺🇸',
}

export function PlayerCard({ player, currentBid, currentLeader }: PlayerCardProps) {
  const hasActiveBid = currentBid !== undefined && currentBid > 0
  const gradient = roleGradient[player.role] ?? roleGradient.BAT
  const stripe = roleStripe[player.role] ?? roleStripe.BAT
  const icon = roleIcon[player.role] ?? '🏏'
  const flag = FLAG[player.country] ?? '🌐'

  return (
    <div className="relative overflow-hidden rounded-2xl border border-ipl-border bg-ipl-card">
      {/* Role colour gradient wash */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`} />

      {/* Top colour stripe */}
      <div className={`h-1 w-full bg-gradient-to-r ${stripe}`} />

      <div className="relative p-5">
        {/* Role icon + badges row */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-2xl leading-none">{icon}</span>
          <Badge variant={roleVariant[player.role]}>{roleLabels[player.role]}</Badge>
          {player.isOverseas && <Badge variant="blue">Overseas</Badge>}
          <Badge variant={player.cappedStatus === 'capped' ? 'gold' : 'gray'}>
            {player.cappedStatus === 'capped' ? 'Intl Capped' : 'Uncapped'}
          </Badge>
          {player.previousTeam && (
            <span className="text-gray-600 text-xs ml-auto">
              Prev: <span className="text-gray-400">{player.previousTeam}</span>
            </span>
          )}
        </div>

        {/* Player name + country with flag */}
        <div className="mb-5">
          <h2 className="text-3xl font-black text-white leading-tight tracking-tight">
            {player.name}
          </h2>
          <p className="text-gray-400 text-sm mt-1 flex items-center gap-1.5">
            <span>{flag}</span>
            <span>{player.country}</span>
          </p>
        </div>

        {/* Price display */}
        <div className="grid grid-cols-2 gap-3">
          {/* Base price */}
          <div className="bg-black/30 rounded-xl px-4 py-3">
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Base Price</p>
            <p className="text-ipl-gold font-black text-xl">₹{player.basePrice.toFixed(2)} Cr</p>
          </div>

          {/* Live bid — prominent when active */}
          {hasActiveBid ? (
            <div className="relative overflow-hidden bg-ipl-accent/15 border border-ipl-accent/50 rounded-xl px-4 py-3">
              <div className="absolute inset-0 bg-ipl-accent/5 animate-pulse pointer-events-none" />
              <p className="text-gray-300 text-xs uppercase tracking-widest mb-1 relative">Live Bid</p>
              <p className="text-white font-black text-xl relative">₹{currentBid.toFixed(2)} Cr</p>
            </div>
          ) : (
            <div className="bg-black/20 rounded-xl px-4 py-3 flex items-center justify-center">
              <p className="text-gray-600 text-sm">No bids yet</p>
            </div>
          )}
        </div>

        {/* Leader strip */}
        {currentLeader && (
          <div className="mt-3 bg-ipl-gold/10 border border-ipl-gold/30 rounded-xl px-4 py-2 flex items-center justify-between">
            <span className="text-gray-400 text-sm">Highest bid by</span>
            <span className="text-ipl-gold font-black text-base tracking-wide">{currentLeader}</span>
          </div>
        )}
      </div>
    </div>
  )
}
