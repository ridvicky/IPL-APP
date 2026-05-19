import type { TeamId, TeamState } from '@/types/team'
import type { BidState } from '@/types/game'

interface TeamPaddlesProps {
  teamStates: Record<string, TeamState>
  bidState: BidState | null
  userTeam: TeamId
}

type PaddleStatus = 'leading' | 'active' | 'passed' | 'skipped'

const TEAM_SHORT: Record<string, string> = {
  CSK: 'CSK', MI: 'MI', RCB: 'RCB', KKR: 'KKR', DC: 'DC',
  RR: 'RR', SRH: 'SRH', PBKS: 'PBKS', GT: 'GT', LSG: 'LSG',
}

const TEAM_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  CSK:  { bg: 'bg-yellow-900/40',  border: 'border-yellow-500',   text: 'text-yellow-300' },
  MI:   { bg: 'bg-blue-900/40',    border: 'border-blue-500',     text: 'text-blue-300' },
  RCB:  { bg: 'bg-red-900/40',     border: 'border-red-500',      text: 'text-red-300' },
  KKR:  { bg: 'bg-purple-900/40',  border: 'border-purple-500',   text: 'text-purple-300' },
  DC:   { bg: 'bg-sky-900/40',     border: 'border-sky-500',      text: 'text-sky-300' },
  RR:   { bg: 'bg-pink-900/40',    border: 'border-pink-500',     text: 'text-pink-300' },
  SRH:  { bg: 'bg-orange-900/40',  border: 'border-orange-500',   text: 'text-orange-300' },
  PBKS: { bg: 'bg-rose-900/40',    border: 'border-rose-500',     text: 'text-rose-300' },
  GT:   { bg: 'bg-cyan-900/40',    border: 'border-cyan-500',     text: 'text-cyan-300' },
  LSG:  { bg: 'bg-teal-900/40',    border: 'border-teal-500',     text: 'text-teal-300' },
}

function getStatus(teamId: string, bidState: BidState | null): PaddleStatus {
  if (!bidState) return 'active'
  if ((bidState.permanentPass ?? []).includes(teamId as TeamId)) return 'skipped'
  if (bidState.currentLeader === teamId) return 'leading'
  if (bidState.teamsPassed.includes(teamId as TeamId)) return 'passed'
  return 'active'
}

export function TeamPaddles({ teamStates, bidState, userTeam }: TeamPaddlesProps) {
  const teams = Object.keys(teamStates) as TeamId[]

  return (
    <div className="grid grid-cols-5 gap-1.5">
      {teams.map(teamId => {
        const status = getStatus(teamId, bidState)
        const isUser = teamId === userTeam
        const ts = teamStates[teamId]
        const colors = TEAM_COLORS[teamId] ?? { bg: 'bg-gray-800', border: 'border-gray-600', text: 'text-gray-300' }

        const containerClass = [
          'relative flex flex-col items-center justify-center rounded-xl py-2.5 px-1 border transition-all duration-300',
          status === 'leading'
            ? `${colors.bg} ${colors.border} shadow-lg scale-105`
            : status === 'active'
            ? `${colors.bg} ${colors.border} opacity-90`
            : status === 'passed'
            ? 'bg-gray-900/60 border-gray-700 opacity-50'
            : 'bg-gray-900/30 border-gray-800 opacity-30',
          isUser ? 'ring-2 ring-white/40' : '',
        ].join(' ')

        return (
          <div key={teamId} className={containerClass}>
            {/* Status indicator */}
            <div className="absolute top-1 right-1">
              {status === 'leading' && (
                <span className={`w-2 h-2 rounded-full ${colors.text.replace('text-', 'bg-')} animate-pulse block`} />
              )}
              {status === 'active' && (
                <span className="w-2 h-2 rounded-full bg-green-400 block" />
              )}
              {status === 'passed' && (
                <span className="text-gray-600 text-xs leading-none">—</span>
              )}
              {status === 'skipped' && (
                <span className="text-gray-700 text-xs leading-none">✕</span>
              )}
            </div>

            {/* Team name */}
            <span className={`font-black text-sm leading-tight ${
              status === 'leading' ? colors.text :
              status === 'active' ? 'text-gray-200' :
              'text-gray-600'
            }`}>
              {TEAM_SHORT[teamId]}
            </span>

            {/* Purse */}
            <span className={`text-xs font-mono mt-0.5 ${
              status === 'leading' ? colors.text :
              status === 'active' ? 'text-gray-400' :
              'text-gray-700'
            }`}>
              ₹{ts?.currentPurse.toFixed(0)}Cr
            </span>

            {/* Leading label */}
            {status === 'leading' && (
              <span className={`text-xs font-bold mt-0.5 ${colors.text}`}>LEAD</span>
            )}

            {/* User indicator */}
            {isUser && (
              <span className="text-white text-xs mt-0.5 font-bold">YOU</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
