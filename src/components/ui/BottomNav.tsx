import { useNavigate } from 'react-router-dom'
import { tap } from '../../utils/haptics'

type NavItem = 'auction' | 'my-squad' | 'all-squads' | 'unsold'

interface BottomNavProps {
  active: NavItem
}

const NAV_ITEMS: { id: NavItem; label: string; icon: string; path: string }[] = [
  { id: 'auction',    label: 'Auction',   icon: '🔨', path: '/auction' },
  { id: 'my-squad',  label: 'My Squad',  icon: '⭐', path: '/my-squad' },
  { id: 'all-squads', label: 'Squads',   icon: '🏟', path: '/all-squads' },
  { id: 'unsold',    label: 'Unsold',    icon: '📋', path: '/unsold-players' },
]

export function BottomNav({ active }: BottomNavProps) {
  const navigate = useNavigate()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-ipl-dark/95 backdrop-blur border-t border-ipl-border safe-bottom">
      <div className="flex">
        {NAV_ITEMS.map(item => {
          const isActive = item.id === active
          return (
            <button
              key={item.id}
              onClick={() => { tap(); navigate(item.path) }}
              className={[
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-h-[56px]',
                isActive ? 'text-ipl-accent' : 'text-gray-600 hover:text-gray-400',
              ].join(' ')}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className={`text-[10px] font-semibold leading-none ${isActive ? 'text-ipl-accent' : ''}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-6 h-0.5 bg-ipl-accent rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
