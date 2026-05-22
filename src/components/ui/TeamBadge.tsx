/** Team badge colours — also exported for use in history/squad screens */
export const TEAM_BADGE_COLORS: Record<string, { from: string; to: string; text: string; ring: string }> = {
  CSK:  { from: 'from-yellow-500', to: 'to-yellow-700',  text: 'text-yellow-900', ring: 'ring-yellow-400' },
  MI:   { from: 'from-blue-600',   to: 'to-blue-900',    text: 'text-blue-100',   ring: 'ring-blue-400' },
  RCB:  { from: 'from-red-600',    to: 'to-neutral-900', text: 'text-red-100',    ring: 'ring-red-500' },
  KKR:  { from: 'from-purple-700', to: 'to-yellow-600',  text: 'text-yellow-100', ring: 'ring-purple-400' },
  DC:   { from: 'from-blue-500',   to: 'to-red-600',     text: 'text-white',      ring: 'ring-sky-400' },
  RR:   { from: 'from-pink-500',   to: 'to-blue-700',    text: 'text-pink-100',   ring: 'ring-pink-400' },
  SRH:  { from: 'from-orange-500', to: 'to-red-700',     text: 'text-orange-100', ring: 'ring-orange-400' },
  PBKS: { from: 'from-red-500',    to: 'to-slate-700',   text: 'text-red-100',    ring: 'ring-red-400' },
  GT:   { from: 'from-cyan-700',   to: 'to-slate-800',   text: 'text-cyan-100',   ring: 'ring-cyan-400' },
  LSG:  { from: 'from-teal-500',   to: 'to-blue-800',    text: 'text-teal-100',   ring: 'ring-teal-400' },
}

interface TeamBadgeProps {
  teamId: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showRing?: boolean
  showName?: boolean
  className?: string
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
  xl: 'w-24 h-24 text-2xl',
}

/** Cricket ball seam SVG overlay — subtle curved lines like a real ball */
function SeamOverlay() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
      viewBox="0 0 40 40"
      fill="none"
    >
      <path
        d="M10 6 Q14 20 10 34"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M30 6 Q26 20 30 34"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function TeamBadge({ teamId, size = 'md', showRing = false, showName = false, className = '' }: TeamBadgeProps) {
  const colors = TEAM_BADGE_COLORS[teamId] ?? { from: 'from-gray-600', to: 'to-gray-800', text: 'text-white', ring: 'ring-gray-400' }

  const badge = (
    <div
      className={[
        'relative rounded-full flex items-center justify-center font-black bg-gradient-to-br shrink-0 shadow-inner overflow-hidden',
        SIZE_CLASSES[size],
        colors.from,
        colors.to,
        colors.text,
        showRing ? `ring-2 ${colors.ring}` : '',
        showName ? '' : className,
      ].join(' ')}
    >
      <SeamOverlay />
      <span className="relative z-10">{teamId}</span>
    </div>
  )

  if (showName) {
    return (
      <div className={`flex flex-col items-center gap-1 ${className}`}>
        {badge}
        <span className="text-gray-400 text-xs font-bold tracking-wide">{teamId}</span>
      </div>
    )
  }

  return badge
}
