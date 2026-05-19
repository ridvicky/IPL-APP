const teamColors: Record<string, string> = {
  CSK: 'text-yellow-400', MI: 'text-blue-400', RCB: 'text-red-400',
  KKR: 'text-purple-400', DC: 'text-blue-300', RR: 'text-pink-400',
  SRH: 'text-orange-400', PBKS: 'text-red-300', GT: 'text-cyan-400', LSG: 'text-teal-400',
}

interface OpponentReactionsProps {
  log: string[]
}

function parseTeamFromEntry(entry: string): string | null {
  const m = entry.match(/^\[([A-Z]+)\]/)
  return m ? m[1] : null
}

export function OpponentReactions({ log }: OpponentReactionsProps) {
  const recent = log.slice(-8).reverse()

  return (
    <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
      {recent.length === 0 && (
        <p className="text-gray-600 text-sm text-center py-3">The room is quiet...</p>
      )}
      {recent.map((entry, i) => {
        const team = parseTeamFromEntry(entry)
        const color = team ? (teamColors[team] ?? 'text-gray-300') : 'text-gray-400'
        const isLatest = i === 0
        return (
          <div
            key={i}
            className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${
              isLatest ? 'bg-ipl-dark border border-ipl-border' : 'bg-transparent'
            }`}
          >
            {team && (
              <span className={`font-bold flex-shrink-0 ${color}`}>{team}</span>
            )}
            <span className={isLatest ? 'text-gray-300' : 'text-gray-600'}>
              {team ? entry.replace(/^\[[A-Z]+\]\s*/, '') : entry}
            </span>
          </div>
        )
      })}
    </div>
  )
}
