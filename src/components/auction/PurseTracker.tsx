import type { TeamId, TeamState } from '@/types/team'

interface PurseTrackerProps {
  teamStates: Record<string, TeamState>
  userTeam: TeamId
  highlightLeader?: TeamId | null
}

export function PurseTracker({ teamStates, userTeam, highlightLeader }: PurseTrackerProps) {
  const sorted = Object.entries(teamStates).sort(
    ([, a], [, b]) => b.currentPurse - a.currentPurse,
  )

  return (
    <div className="flex flex-col gap-1">
      {sorted.map(([teamId, ts]) => {
        const isUser = teamId === userTeam
        const isLeader = teamId === highlightLeader
        return (
          <div
            key={teamId}
            className={[
              'flex items-center justify-between px-3 py-1.5 rounded text-sm',
              isUser ? 'bg-ipl-accent/10 border border-ipl-accent' :
              isLeader ? 'bg-ipl-gold/10 border border-ipl-gold' :
              'bg-ipl-dark',
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <span className={`font-bold ${isUser ? 'text-ipl-accent' : isLeader ? 'text-ipl-gold' : 'text-gray-300'}`}>
                {teamId}
              </span>
              <span className="text-gray-500 text-xs">{ts.squad.length}p</span>
            </div>
            <span className="font-mono text-gray-200">₹{ts.currentPurse.toFixed(1)}Cr</span>
          </div>
        )
      })}
    </div>
  )
}
