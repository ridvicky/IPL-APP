import type { BidEntry } from '@/types/player'

interface BidTimelineProps {
  bids: BidEntry[]
}

const teamColors: Record<string, string> = {
  CSK: 'text-yellow-400', MI: 'text-blue-400', RCB: 'text-red-400',
  KKR: 'text-purple-400', DC: 'text-blue-300', RR: 'text-pink-400',
  SRH: 'text-orange-400', PBKS: 'text-red-300', GT: 'text-cyan-400', LSG: 'text-teal-400',
}

export function BidTimeline({ bids }: BidTimelineProps) {
  const sorted = [...bids].reverse()

  if (sorted.length === 0) {
    return (
      <div className="text-gray-600 text-sm text-center py-3">No bids yet — be the first!</div>
    )
  }

  return (
    <div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
      {sorted.map((bid, i) => {
        const color = teamColors[bid.teamId] ?? 'text-gray-300'
        const isLatest = i === 0
        return (
          <div
            key={`${bid.teamId}-${bid.timestamp}`}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
              isLatest
                ? 'bg-ipl-accent/15 border border-ipl-accent/50'
                : 'bg-ipl-dark/60'
            }`}
          >
            <div className="flex items-center gap-2">
              {isLatest && (
                <span className="w-1.5 h-1.5 rounded-full bg-ipl-accent animate-pulse inline-block" />
              )}
              <span className={`font-bold ${isLatest ? color : 'text-gray-500'}`}>
                {bid.teamId}
              </span>
            </div>
            <span className={`font-mono font-bold ${isLatest ? 'text-white' : 'text-gray-500'}`}>
              ₹{bid.amount.toFixed(2)} Cr
            </span>
          </div>
        )
      })}
    </div>
  )
}
