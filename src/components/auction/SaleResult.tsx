import { Button } from '@components/ui/Button'
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

export function SaleResult({ result, onContinue }: SaleResultProps) {
  if (result.type === 'sold') {
    const { record } = result
    const teamColor = teamColors[record.soldTo] ?? '#e8c96d'
    return (
      <div className="relative overflow-hidden bg-ipl-card border-2 border-ipl-gold/60 rounded-2xl p-8 flex flex-col items-center gap-5 text-center">
        {/* Radial glow */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at center, ${teamColor} 0%, transparent 70%)` }}
        />

        {/* SOLD banner */}
        <div className="relative">
          <p className="text-ipl-gold text-6xl font-black tracking-widest drop-shadow-lg animate-pulse">
            SOLD!
          </p>
        </div>

        {/* Player name */}
        <div className="relative">
          <p className="text-white text-2xl font-black">{record.name}</p>
          <p className="text-gray-400 text-sm mt-1">{record.country}</p>
        </div>

        {/* Price */}
        <div className="relative bg-black/40 rounded-2xl px-8 py-4 w-full">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Sold for</p>
          <p className="text-white text-4xl font-black">₹{record.soldPrice.toFixed(2)} Cr</p>
        </div>

        {/* To team */}
        <div
          className="relative w-full rounded-xl px-4 py-3 flex items-center justify-center gap-3"
          style={{ backgroundColor: `${teamColor}20`, borderColor: `${teamColor}60`, border: '1px solid' }}
        >
          <span className="text-gray-300 text-sm">to</span>
          <span className="font-black text-2xl tracking-wide" style={{ color: teamColor }}>
            {record.soldTo}
          </span>
        </div>

        <Button variant="primary" size="lg" onClick={onContinue} className="relative w-full mt-1">
          Next Player →
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-ipl-card border-2 border-gray-700 rounded-2xl p-8 flex flex-col items-center gap-5 text-center">
      <p className="text-gray-500 text-5xl font-black tracking-widest">UNSOLD</p>
      <p className="text-white text-2xl font-bold">{result.record.name}</p>
      <p className="text-gray-500 text-sm">No bids received</p>
      <Button variant="secondary" size="lg" onClick={onContinue} className="w-full mt-1">
        Next Player →
      </Button>
    </div>
  )
}
