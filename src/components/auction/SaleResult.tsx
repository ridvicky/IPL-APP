import { Button } from '@components/ui/Button'
import { TeamBadge } from '@components/ui/TeamBadge'
import { tap, success } from '@/utils/haptics'
import type { SoldPlayerRecord, UnsoldPlayerRecord } from '@/types/player'

interface SaleResultProps {
  result: { type: 'sold'; record: SoldPlayerRecord } | { type: 'unsold'; record: UnsoldPlayerRecord }
  onContinue: () => void
}

const teamColors: Record<string, string> = {
  CSK: '#f5a623', MI: '#005da0', RCB: '#c8102e', KKR: '#3a225d',
  DC: '#1a5276', RR: '#ea1a8e', SRH: '#f26522', PBKS: '#d71921',
  GT: '#1d3461', LSG: '#a8d8a8',
}

const OWNER_NAMES: Record<string, string> = {
  CSK: 'Chennai', MI: 'Mumbai', RCB: 'Bangalore', KKR: 'Kolkata',
  DC: 'Delhi', RR: 'Rajasthan', SRH: 'Hyderabad', PBKS: 'Punjab',
  GT: 'Gujarat', LSG: 'Lucknow',
}

export function SaleResult({ result, onContinue }: SaleResultProps) {
  if (result.type === 'sold') {
    const { record } = result
    const teamColor = teamColors[record.soldTo] ?? '#e8c96d'
    return (
      <div
        className="relative overflow-hidden bg-ipl-card rounded-2xl p-7 flex flex-col items-center gap-4 text-center border-2"
        style={{ borderColor: teamColor }}
      >
        {/* Top team-color stripe */}
        <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl" style={{ backgroundColor: teamColor }} />

        {/* Full-card team color flood */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 25%, ${teamColor}28 0%, ${teamColor}08 55%, transparent 80%)` }}
        />

        {/* SOLD! banner — bid-pop on mount for hammer-drop feel */}
        <div className="relative mt-1">
          <p
            className="text-ipl-gold font-black tracking-widest drop-shadow-[0_0_20px_rgba(245,166,35,0.7)] animate-bid-pop"
            style={{ fontSize: '3.5rem', lineHeight: 1 }}
          >
            SOLD!
          </p>
        </div>

        {/* Player name */}
        <div className="relative">
          <p className="text-white text-2xl font-black leading-tight">{record.name}</p>
          <p className="text-gray-400 text-sm mt-0.5">{record.country}</p>
        </div>

        {/* HAMMER PRICE — slides up with delay */}
        <div
          className="relative bg-black/50 border rounded-2xl px-8 py-4 w-full animate-slide-up"
          style={{ borderColor: `${teamColor}40`, animationDelay: '0.15s', animationFillMode: 'both' }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500 mb-1.5">HAMMER PRICE</p>
          <p className="text-white font-black font-mono leading-none">
            <span style={{ fontSize: '2.75rem' }}>₹{record.soldPrice.toFixed(2)}</span>
            <span className="text-xl text-gray-400 font-semibold ml-1.5">Cr</span>
          </p>
        </div>

        {/* To franchise — fades in with delay */}
        <div
          className="relative w-full rounded-xl px-4 py-3.5 flex items-center justify-center gap-4 animate-fade-in border"
          style={{
            backgroundColor: `${teamColor}18`,
            borderColor: `${teamColor}50`,
            animationDelay: '0.28s',
            animationFillMode: 'both',
          }}
        >
          <TeamBadge teamId={record.soldTo as import('@/types/team').TeamId} size="md" />
          <div className="text-left">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Franchise</p>
            <p className="font-black text-xl tracking-wide" style={{ color: teamColor }}>
              {OWNER_NAMES[record.soldTo] ?? record.soldTo}
            </p>
          </div>
        </div>

        <Button variant="primary" size="lg" onClick={() => { success(); onContinue() }} className="relative w-full">
          Next Player →
        </Button>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden bg-ipl-card border-2 border-gray-700/80 rounded-2xl p-8 flex flex-col items-center gap-5 text-center">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/60 to-transparent pointer-events-none" />
      <p className="relative text-gray-400 font-black tracking-widest animate-slide-up" style={{ fontSize: '3rem' }}>
        UNSOLD
      </p>
      <p className="relative text-white text-2xl font-bold">{result.record.name}</p>
      <p className="relative text-gray-500 text-sm italic">No bids received</p>
      <Button variant="secondary" size="lg" onClick={() => { tap(); onContinue() }} className="relative w-full">
        Next Player →
      </Button>
    </div>
  )
}
