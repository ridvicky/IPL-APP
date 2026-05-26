import type { PlayerRecord, PlayerFormContext } from '@/types/player'

interface PlayerCardProps {
  player: PlayerRecord
  currentBid?: number | undefined
  currentLeader?: string | null | undefined
  formContext?: PlayerFormContext | null
}

const roleGradient: Record<string, string> = {
  BAT: 'from-yellow-500/20 via-yellow-900/8 to-transparent',
  BWL: 'from-blue-500/20 via-blue-900/8 to-transparent',
  AR:  'from-green-500/20 via-green-900/8 to-transparent',
  WK:  'from-red-500/20 via-red-900/8 to-transparent',
}
const roleStripe: Record<string, string> = {
  BAT: 'from-yellow-400 to-amber-500',
  BWL: 'from-blue-400 to-blue-600',
  AR:  'from-green-400 to-emerald-600',
  WK:  'from-red-400 to-red-600',
}
const roleAccent: Record<string, string> = {
  BAT: 'text-yellow-300 bg-yellow-400/15 border-yellow-500/30',
  BWL: 'text-blue-300 bg-blue-400/15 border-blue-500/30',
  AR:  'text-green-300 bg-green-400/15 border-green-500/30',
  WK:  'text-red-300 bg-red-400/15 border-red-500/30',
}
const roleLabel: Record<string, string> = {
  BAT: 'Batter', BWL: 'Bowler', AR: 'All-Rounder', WK: 'Wicket-Keeper',
}
const roleIcon: Record<string, string> = {
  BAT: '🏏', BWL: '🎯', AR: '⚡', WK: '🧤',
}
const FLAG: Record<string, string> = {
  India: '🇮🇳', Australia: '🇦🇺', England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'South Africa': '🇿🇦', 'New Zealand': '🇳🇿', 'West Indies': '🌴',
  Pakistan: '🇵🇰', Bangladesh: '🇧🇩', 'Sri Lanka': '🇱🇰',
  Afghanistan: '🇦🇫', Zimbabwe: '🇿🇼', Ireland: '🇮🇪',
  Netherlands: '🇳🇱', USA: '🇺🇸',
}

export function PlayerCard({ player, currentBid, currentLeader, formContext }: PlayerCardProps) {
  const hasActiveBid = currentBid !== undefined && currentBid > 0
  const gradient = roleGradient[player.role] ?? roleGradient.BAT
  const stripe   = roleStripe[player.role]   ?? roleStripe.BAT
  const accent   = roleAccent[player.role]   ?? roleAccent.BAT
  const icon     = roleIcon[player.role]     ?? '🏏'
  const flag     = FLAG[player.country]      ?? '🌐'
  const multiple = hasActiveBid && player.basePrice > 0
    ? Math.round(currentBid! / player.basePrice)
    : null

  return (
    <div className={`relative overflow-hidden rounded-3xl transition-all duration-500
      ${hasActiveBid
        ? 'border-2 border-ipl-accent/50 shadow-xl shadow-ipl-accent/10'
        : 'border border-ipl-border'
      } bg-ipl-card`}
    >
      {/* Role wash */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`} />

      {/* Top stripe */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${stripe}`} />

      <div className="relative px-5 pt-4 pb-5">

        {/* Role pill + status row */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className={`flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-xl border ${accent}`}>
            <span className="text-base leading-none">{icon}</span>
            {roleLabel[player.role]}
          </span>
          {player.isOverseas && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/25">
              {flag} Overseas
            </span>
          )}
          {!player.isOverseas && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/8">
              🇮🇳 Indian
            </span>
          )}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ml-auto
            ${player.cappedStatus === 'capped'
              ? 'bg-ipl-gold/10 text-ipl-gold border-ipl-gold/25'
              : 'bg-white/5 text-gray-500 border-white/8'
            }`}>
            {player.cappedStatus === 'capped' ? 'Intl Capped' : 'Uncapped'}
          </span>
        </div>

        {/* Player name — hero element */}
        <div className="mb-5">
          <h2 className="text-[2.4rem] font-black text-white leading-none tracking-tight">
            {player.name}
          </h2>
          <div className="flex items-center gap-3 mt-1.5">
            {formContext?.estimatedAge && (
              <span className="text-gray-500 text-xs font-semibold">
                ~{formContext.estimatedAge} yrs
              </span>
            )}
            {player.previousTeam && (
              <span className="text-gray-600 text-xs">
                ex · <span className="text-gray-400 font-semibold">{player.previousTeam}</span>
              </span>
            )}
          </div>
        </div>

        {/* Live bid block — hero when active, muted when not */}
        {hasActiveBid ? (
          <div className="relative overflow-hidden rounded-2xl bg-ipl-accent/12 border border-ipl-accent/35 px-5 py-4">
            <div className="absolute inset-0 bg-gradient-to-r from-ipl-accent/8 to-transparent animate-pulse pointer-events-none" />
            <div className="relative flex items-end justify-between gap-4">
              <div>
                <p className="text-ipl-accent text-[10px] font-black uppercase tracking-[0.2em] mb-1">Live Bid</p>
                <p className="text-white font-black leading-none">
                  <span className="text-4xl">₹{currentBid!.toFixed(2)}</span>
                  <span className="text-lg text-gray-400 font-semibold ml-1">Cr</span>
                </p>
                {multiple && multiple > 1 && (
                  <p className="text-ipl-accent/70 text-xs mt-1 font-semibold">{multiple}× base price</p>
                )}
              </div>
              {currentLeader && (
                <div className="text-right shrink-0">
                  <p className="text-gray-500 text-[10px] uppercase tracking-widest">Leading</p>
                  <p className="text-ipl-gold font-black text-2xl leading-none mt-0.5">{currentLeader}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-black/25 border border-white/6 px-5 py-4 flex items-end justify-between">
            <div>
              <p className="text-gray-600 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Base Price</p>
              <p className="text-ipl-gold font-black leading-none">
                <span className="text-4xl">₹{player.basePrice.toFixed(2)}</span>
                <span className="text-lg text-gray-500 font-semibold ml-1">Cr</span>
              </p>
            </div>
            <p className="text-gray-500 text-sm font-semibold">No bids yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
