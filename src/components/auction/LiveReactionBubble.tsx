/**
 * LiveReactionBubble — floating speech bubble that shows the latest LLM owner comment.
 * Appears when a new bid/pass lands, auto-dismisses after 4 seconds.
 * Shown on mobile above the paddles strip.
 */
import { useEffect, useState, useRef } from 'react'
import { TEAM_BADGE_COLORS } from '@components/ui/TeamBadge'

interface Reaction {
  teamId: string
  comment: string
  type: 'bid' | 'pass'
  id: number
}

interface LiveReactionBubbleProps {
  log: string[]
}

function parseReaction(entry: string, id: number): Reaction | null {
  const m = entry.match(/^\[([A-Z]+)\]\s*(.+)$/)
  if (!m) return null
  const [, teamId, comment] = m
  // Skip system entries like "SOLD:", "---", "UNSOLD:"
  if (comment.startsWith('SOLD:') || comment.startsWith('---') || comment.startsWith('UNSOLD:')) return null
  const type = comment.toLowerCase().includes('pass') || comment.toLowerCase().includes('no') ? 'pass' : 'bid'
  return { teamId, comment, type, id }
}

const teamColors: Record<string, string> = {
  CSK: 'border-yellow-400 bg-yellow-400/10 text-yellow-200',
  MI:  'border-blue-400 bg-blue-400/10 text-blue-200',
  RCB: 'border-red-400 bg-red-400/10 text-red-200',
  KKR: 'border-purple-400 bg-purple-400/10 text-purple-200',
  DC:  'border-sky-400 bg-sky-400/10 text-sky-200',
  RR:  'border-pink-400 bg-pink-400/10 text-pink-200',
  SRH: 'border-orange-400 bg-orange-400/10 text-orange-200',
  PBKS:'border-rose-400 bg-rose-400/10 text-rose-200',
  GT:  'border-cyan-400 bg-cyan-400/10 text-cyan-200',
  LSG: 'border-teal-400 bg-teal-400/10 text-teal-200',
}

export function LiveReactionBubble({ log }: LiveReactionBubbleProps) {
  const [visible, setVisible] = useState<Reaction | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastLogLen = useRef(0)
  const idRef = useRef(0)

  useEffect(() => {
    if (log.length <= lastLogLen.current) return
    const newEntries = log.slice(lastLogLen.current)
    lastLogLen.current = log.length

    // Find the latest team comment (last entry that matches)
    let latest: Reaction | null = null
    for (const entry of newEntries) {
      const r = parseReaction(entry, ++idRef.current)
      if (r) latest = r
    }
    if (!latest) return

    setVisible(latest)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(null), 4000)
  }, [log])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  if (!visible) return null

  const colorClass = teamColors[visible.teamId] ?? 'border-gray-400 bg-gray-400/10 text-gray-200'
  const badgeColors = TEAM_BADGE_COLORS[visible.teamId]
  const dotClass = badgeColors
    ? `bg-gradient-to-br ${badgeColors.from} ${badgeColors.to}`
    : 'bg-gray-500'

  return (
    <div
      key={visible.id}
      className={`animate-slide-up flex items-start gap-2.5 border rounded-2xl px-4 py-3 shadow-lg ${colorClass}`}
    >
      {/* Team dot */}
      <div className={`w-7 h-7 rounded-full flex-shrink-0 ${dotClass} flex items-center justify-center`}>
        <span className="text-white text-xs font-black">{visible.teamId.slice(0, 2)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-xs mb-0.5 opacity-70">{visible.teamId}</p>
        <p className="text-sm font-medium leading-snug">{visible.comment}</p>
      </div>
      <button
        onClick={() => setVisible(null)}
        className="text-current opacity-40 hover:opacity-70 ml-1 flex-shrink-0 text-lg leading-none"
      >
        ×
      </button>
    </div>
  )
}
