import type { TeamId, TeamState } from '@/types/team'
import type { BidState } from '@/types/game'

interface TeamPaddlesProps {
  teamStates: Record<string, TeamState>
  bidState: BidState | null
  userTeam: TeamId
  maximumSquadSize: number
  nextBidAmount: number
}

type PaddleStatus = 'leading' | 'active' | 'passed' | 'skipped'

const TEAM_COLORS: Record<string, {
  bg: string; border: string; text: string; glow: string; dot: string
}> = {
  CSK:  { bg: 'bg-yellow-900/50',  border: 'border-yellow-400',  text: 'text-yellow-300', glow: 'shadow-yellow-500/30',  dot: 'bg-yellow-400' },
  MI:   { bg: 'bg-blue-900/50',    border: 'border-blue-400',    text: 'text-blue-300',   glow: 'shadow-blue-500/30',    dot: 'bg-blue-400' },
  RCB:  { bg: 'bg-red-900/50',     border: 'border-red-400',     text: 'text-red-300',    glow: 'shadow-red-500/30',     dot: 'bg-red-400' },
  KKR:  { bg: 'bg-purple-900/50',  border: 'border-purple-400',  text: 'text-purple-300', glow: 'shadow-purple-500/30',  dot: 'bg-purple-400' },
  DC:   { bg: 'bg-sky-900/50',     border: 'border-sky-400',     text: 'text-sky-300',    glow: 'shadow-sky-500/30',     dot: 'bg-sky-400' },
  RR:   { bg: 'bg-pink-900/50',    border: 'border-pink-400',    text: 'text-pink-300',   glow: 'shadow-pink-500/30',    dot: 'bg-pink-400' },
  SRH:  { bg: 'bg-orange-900/50',  border: 'border-orange-400',  text: 'text-orange-300', glow: 'shadow-orange-500/30',  dot: 'bg-orange-400' },
  PBKS: { bg: 'bg-rose-900/50',    border: 'border-rose-400',    text: 'text-rose-300',   glow: 'shadow-rose-500/30',    dot: 'bg-rose-400' },
  GT:   { bg: 'bg-cyan-900/50',    border: 'border-cyan-400',    text: 'text-cyan-300',   glow: 'shadow-cyan-500/30',    dot: 'bg-cyan-400' },
  LSG:  { bg: 'bg-teal-900/50',    border: 'border-teal-400',    text: 'text-teal-300',   glow: 'shadow-teal-500/30',    dot: 'bg-teal-400' },
}

const DEFAULT_COLORS = { bg: 'bg-gray-800', border: 'border-gray-600', text: 'text-gray-300', glow: 'shadow-gray-500/20', dot: 'bg-gray-400' }

function getStatus(teamId: string, bidState: BidState | null): PaddleStatus {
  if (!bidState) return 'active'
  if ((bidState.permanentPass ?? []).includes(teamId as TeamId)) return 'skipped'
  if (bidState.currentLeader === teamId) return 'leading'
  if (bidState.teamsPassed.includes(teamId as TeamId)) return 'passed'
  return 'active'
}

export function TeamPaddles({ teamStates, bidState, userTeam, maximumSquadSize, nextBidAmount }: TeamPaddlesProps) {
  const teams = Object.keys(teamStates) as TeamId[]

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      {teams.map(teamId => {
        const status = getStatus(teamId, bidState)
        const isUser = teamId === userTeam
        const ts     = teamStates[teamId]
        const c      = TEAM_COLORS[teamId] ?? DEFAULT_COLORS
        const isLeading = status === 'leading'
        const isDead    = status === 'passed' || status === 'skipped'

        const squadCount  = ts?.squad.length ?? 0
        const isFull      = squadCount >= maximumSquadSize
        const isLowPurse  = !isFull && (ts?.currentPurse ?? 0) < nextBidAmount && status !== 'leading'

        return (
          <div
            key={teamId}
            className={`relative flex-shrink-0 flex flex-col items-center rounded-2xl border transition-all duration-300
              px-3 py-2 min-w-[68px]
              ${isLeading
                ? `${c.bg} ${c.border} shadow-lg ${c.glow} scale-105`
                : isDead
                ? 'bg-gray-900/40 border-gray-800/60 opacity-40 scale-95'
                : isFull
                ? 'bg-amber-900/20 border-amber-700/40 opacity-60 scale-95'
                : `${c.bg} border-white/10`
              }
              ${isUser ? 'ring-2 ring-white/30 ring-offset-1 ring-offset-ipl-darker' : ''}
            `}
          >
            {/* Status dot */}
            <div className="absolute top-1.5 right-1.5">
              {isLeading && (
                <span className={`w-2 h-2 rounded-full ${c.dot} animate-pulse block`} />
              )}
              {status === 'active' && !isFull && !isLowPurse && (
                <span className="w-2 h-2 rounded-full bg-green-400 block" />
              )}
              {status === 'passed' && (
                <span className="text-[9px] text-gray-700 font-black leading-none">—</span>
              )}
              {status === 'skipped' && (
                <span className="text-[9px] text-gray-800 font-black leading-none">✕</span>
              )}
            </div>

            {/* Team name */}
            <span className={`font-black text-sm leading-tight ${
              isLeading ? c.text : isDead || isFull ? 'text-gray-700' : 'text-gray-200'
            }`}>
              {teamId}
            </span>

            {/* Squad count */}
            <span className={`text-[10px] font-bold mt-0.5 ${
              isFull ? 'text-amber-500' : isLeading ? c.text : 'text-gray-600'
            }`}>
              {squadCount}/{maximumSquadSize}
            </span>

            {/* Purse */}
            <span className={`text-[11px] font-mono font-bold mt-0.5 ${
              isLeading ? c.text : isDead || isFull ? 'text-gray-800' : isLowPurse ? 'text-red-700' : 'text-gray-500'
            }`}>
              ₹{ts?.currentPurse.toFixed(0)}Cr
            </span>

            {/* Status label */}
            {isFull && (
              <span className="text-[9px] font-black mt-0.5 uppercase tracking-wide text-amber-600">
                FULL
              </span>
            )}
            {isLowPurse && !isFull && (
              <span className="text-[9px] font-black mt-0.5 uppercase tracking-wide text-red-800">
                LOW
              </span>
            )}
            {isLeading && !isFull && (
              <span className={`text-[9px] font-black mt-0.5 uppercase tracking-wide ${c.text}`}>
                LEAD
              </span>
            )}
            {isUser && !isLeading && !isFull && !isLowPurse && (
              <span className="text-white text-[9px] font-black mt-0.5 uppercase tracking-wide">
                YOU
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
