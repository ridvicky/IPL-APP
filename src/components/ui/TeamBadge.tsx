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
  className?: string
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
  xl: 'w-20 h-20 text-xl',
}

export function TeamBadge({ teamId, size = 'md', showRing = false, className = '' }: TeamBadgeProps) {
  const colors = TEAM_BADGE_COLORS[teamId] ?? { from: 'from-gray-600', to: 'to-gray-800', text: 'text-white', ring: 'ring-gray-400' }

  return (
    <div
      className={[
        'rounded-full flex items-center justify-center font-black bg-gradient-to-br shrink-0',
        SIZE_CLASSES[size],
        colors.from,
        colors.to,
        colors.text,
        showRing ? `ring-2 ${colors.ring}` : '',
        className,
      ].join(' ')}
    >
      {teamId}
    </div>
  )
}
