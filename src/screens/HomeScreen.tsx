import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { TeamBadge } from '@components/ui/TeamBadge'
import { useAuthStore } from '@/store/authStore'
import { useSessionStore } from '@/store/sessionStore'
import type { SessionMeta } from '@/types/session'

const PHASE_LABEL: Record<string, string> = {
  'set-preview':       'In Auction',
  'bidding':           'In Auction',
  'sale-confirmed':    'In Auction',
  'unsold-confirmed':  'In Auction',
  'set-complete':      'In Auction',
  'auction-complete':  'Auction Complete',
  'retention':         'Retention Setup',
  'trade-window':      'Trade Window',
  'setup':             'Setup',
  'season-setup':      'Season Setup',
  'season-simulation': 'Simulating…',
  'season-complete':   'Season Complete',
}

function phaseLabel(phase: string) {
  return PHASE_LABEL[phase] ?? phase
}

function phaseColor(phase: string) {
  if (phase === 'auction-complete') return 'text-ipl-green'
  if (phase.includes('auction') || phase.includes('bid') || phase.includes('set')) return 'text-ipl-gold'
  return 'text-gray-500'
}

export function HomeScreen() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const { sessions, loadingSessions, fetchSessions, removeSession } = useSessionStore()

  useEffect(() => {
    void fetchSessions()
  }, [fetchSessions])

  const displayName = user?.email?.split('@')[0] ?? 'Manager'

  return (
    <div className="min-h-screen bg-ipl-darker flex flex-col">
      {/* Hero Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-ipl-dark to-ipl-darker border-b border-ipl-border">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-ipl-accent/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-ipl-gold/5 rounded-full blur-2xl pointer-events-none translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10 px-4 pt-10 pb-8">
          {/* Top bar */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-gray-500 text-xs font-medium tracking-widest uppercase mb-1">Welcome back</p>
              <h2 className="text-white font-black text-xl">@{displayName}</h2>
            </div>
            <button
              onClick={() => void signOut()}
              className="text-gray-600 hover:text-gray-400 text-sm py-1.5 px-3 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
            >
              Sign Out
            </button>
          </div>

          {/* Brand */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {/* Mini cricket ball */}
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <circle cx="18" cy="18" r="17" fill="url(#hbGrad)"/>
                <path d="M11 8 Q13 14 11 18 Q9 22 13 28" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                <path d="M25 8 Q23 14 25 18 Q27 22 23 28" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                <defs>
                  <linearGradient id="hbGrad" x1="0" y1="0" x2="36" y2="36">
                    <stop offset="0%" stopColor="#e94560"/>
                    <stop offset="100%" stopColor="#6b1220"/>
                  </linearGradient>
                </defs>
              </svg>
              <div>
                <p className="text-white font-black text-2xl leading-none tracking-tight">IPL</p>
                <p className="text-ipl-gold text-xs font-bold tracking-widest">AUCTION SIM</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 flex flex-col gap-5">
        {/* New Session CTA */}
        <button
          onClick={() => navigate('/new-session')}
          className="relative overflow-hidden w-full rounded-2xl bg-gradient-to-r from-ipl-accent to-red-700 p-px shadow-glow-accent"
        >
          <div className="bg-gradient-to-r from-ipl-accent/90 to-red-800 rounded-2xl px-6 py-5 flex items-center justify-between">
            <div className="text-left">
              <p className="text-white font-black text-lg">Start New Auction</p>
              <p className="text-red-200 text-sm">Choose your franchise &amp; begin bidding</p>
            </div>
            <div className="text-4xl">🔨</div>
          </div>
        </button>

        {/* Team preview strip */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {['CSK','MI','RCB','KKR','DC','RR','SRH','PBKS','GT','LSG'].map(t => (
            <TeamBadge key={t} teamId={t} size="md" className="shrink-0" />
          ))}
        </div>

        {/* Saved Sessions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-gray-400 text-xs font-bold uppercase tracking-widest">Saved Sessions</h2>
            {sessions.length > 0 && (
              <span className="text-gray-600 text-xs">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {loadingSessions ? (
            <div className="py-8">
              <LoadingSpinner label="Loading sessions..." />
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-ipl-card border border-ipl-border rounded-2xl px-6 py-12 text-center">
              <p className="text-4xl mb-3">🏏</p>
              <p className="text-gray-400 font-semibold">No saved sessions yet</p>
              <p className="text-gray-600 text-sm mt-1">Start a new auction to begin.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map(s => <SessionCard key={s.id} session={s} onDelete={() => void removeSession(s.id)} />)}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function SessionCard({ session: s, onDelete }: { session: SessionMeta; onDelete: () => void }) {
  const navigate = useNavigate()

  return (
    <div className="bg-ipl-card border border-ipl-border rounded-2xl overflow-hidden hover:border-ipl-border/60 transition-colors shadow-card">
      <button
        className="w-full text-left px-4 pt-4 pb-3"
        onClick={() => {
          if (s.phase === 'season-complete') navigate(`/session/${s.id}`)
          else navigate(`/session/${s.id}`)
        }}
      >
        <div className="flex items-center gap-3">
          <TeamBadge teamId={s.userFranchise} size="md" showRing />
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{s.name}</p>
            <p className="text-gray-500 text-xs mt-0.5">
              IPL {s.auctionYear} · {s.auctionType}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-xs font-bold ${phaseColor(s.phase)}`}>{phaseLabel(s.phase)}</p>
            <p className="text-gray-700 text-xs mt-0.5">{new Date(s.updatedAt).toLocaleDateString()}</p>
          </div>
        </div>
      </button>

      <div className="border-t border-ipl-border/50 px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => navigate(`/session/${s.id}`)}
          className="text-ipl-accent text-xs font-bold hover:text-red-400 transition-colors"
        >
          Continue →
        </button>
        <button
          onClick={onDelete}
          className="text-gray-700 hover:text-ipl-accent text-xs transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
