import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { TeamBadge, TEAM_BADGE_COLORS } from '@components/ui/TeamBadge'
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
  if (phase === 'auction-complete') return 'text-green-400'
  if (phase.includes('auction') || phase.includes('bid') || phase.includes('set')) return 'text-ipl-gold'
  return 'text-gray-500'
}

/** Giant cricket ball SVG for the hero */
function CricketBallHero() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" className="drop-shadow-2xl">
      <defs>
        <radialGradient id="ballGrad" cx="38%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="50%" stopColor="#e94560" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </radialGradient>
        <radialGradient id="ballGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e94560" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#e94560" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Glow ring */}
      <circle cx="80" cy="80" r="78" fill="url(#ballGlow)" />
      {/* Ball body */}
      <circle cx="80" cy="80" r="70" fill="url(#ballGrad)" />
      {/* Highlight */}
      <ellipse cx="58" cy="52" rx="18" ry="12" fill="white" fillOpacity="0.12" />
      {/* Seam — vertical */}
      <path d="M44 18 Q52 50 44 80 Q36 110 44 142" stroke="white" strokeOpacity="0.55" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M116 18 Q108 50 116 80 Q124 110 116 142" stroke="white" strokeOpacity="0.55" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Seam stitches left */}
      {[24, 36, 48, 60, 72, 84, 96, 108, 120, 132].map((y, i) => (
        <line key={`sl${i}`}
          x1={44 + (i % 2 === 0 ? -3 : 3)} y1={y}
          x2={44 + (i % 2 === 0 ? 3 : -3)} y2={y + 6}
          stroke="white" strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round"
        />
      ))}
      {/* Seam stitches right */}
      {[24, 36, 48, 60, 72, 84, 96, 108, 120, 132].map((y, i) => (
        <line key={`sr${i}`}
          x1={116 + (i % 2 === 0 ? -3 : 3)} y1={y}
          x2={116 + (i % 2 === 0 ? 3 : -3)} y2={y + 6}
          stroke="white" strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

/** Decorative stumps SVG */
function StumpsSvg() {
  return (
    <svg width="48" height="56" viewBox="0 0 48 56" fill="none" className="opacity-20">
      <rect x="8"  y="16" width="5" height="38" rx="2.5" fill="#d4af37" />
      <rect x="21" y="14" width="5" height="40" rx="2.5" fill="#d4af37" />
      <rect x="34" y="16" width="5" height="38" rx="2.5" fill="#d4af37" />
      <rect x="5"  y="10" width="38" height="5" rx="2.5" fill="#d4af37" />
    </svg>
  )
}

/** Bat silhouette SVG */
function BatSvg() {
  return (
    <svg width="32" height="72" viewBox="0 0 32 72" fill="none" className="opacity-15">
      <ellipse cx="16" cy="28" rx="14" ry="22" fill="#d4af37" />
      <rect x="13" y="48" width="6" height="22" rx="3" fill="#d4af37" />
    </svg>
  )
}

const ALL_TEAMS = ['CSK','MI','RCB','KKR','DC','RR','SRH','PBKS','GT','LSG']

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
      {/* ── HERO HEADER ── */}
      <header className="relative overflow-hidden">
        {/* Stadium night radial glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-ipl-darker to-ipl-darker" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-ipl-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-ipl-gold/5 rounded-full blur-2xl pointer-events-none" />

        {/* Decorative cricket elements */}
        <div className="absolute top-6 left-4 pointer-events-none">
          <StumpsSvg />
        </div>
        <div className="absolute top-10 right-6 pointer-events-none">
          <BatSvg />
        </div>

        <div className="relative z-10 px-4 pt-10 pb-6 flex flex-col items-center text-center">
          {/* Top bar */}
          <div className="w-full flex items-center justify-between mb-8">
            <div className="text-left">
              <p className="text-gray-500 text-xs font-medium tracking-widest uppercase">Welcome back</p>
              <h2 className="text-white font-black text-base">@{displayName}</h2>
            </div>
            <button
              onClick={() => void signOut()}
              className="text-gray-600 hover:text-gray-400 text-xs py-1.5 px-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
            >
              Sign Out
            </button>
          </div>

          {/* Giant ball + title */}
          <div className="relative mb-4">
            <CricketBallHero />
          </div>

          <h1 className="text-white font-black text-4xl tracking-tight leading-none mb-1">
            IPL <span className="text-ipl-gold">AUCTION</span>
          </h1>
          <p className="text-ipl-gold font-bold text-sm tracking-[0.3em] uppercase mb-1">SIM 2025</p>
          <p className="text-gray-500 text-xs tracking-widest uppercase">Stadium Night · Bid Like a Pro</p>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-ipl-darker to-transparent" />
      </header>

      <main className="flex-1 px-4 py-5 flex flex-col gap-5">
        {/* New Session CTA */}
        <button
          onClick={() => navigate('/new-session')}
          className="relative overflow-hidden w-full rounded-2xl group"
        >
          {/* Outer glow border */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-ipl-accent via-red-500 to-ipl-accent opacity-80 blur-sm group-hover:opacity-100 transition-opacity" />
          <div className="relative bg-gradient-to-r from-ipl-accent/90 to-red-800 rounded-2xl px-6 py-5 flex items-center justify-between border border-ipl-accent/40">
            <div className="text-left">
              {/* Pulsing LIVE badge */}
              <div className="flex items-center gap-2 mb-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                <span className="text-white/80 text-xs font-bold tracking-widest uppercase">Live Auction</span>
              </div>
              <p className="text-white font-black text-xl leading-tight">Start New Auction</p>
              <p className="text-red-200 text-sm mt-0.5">Choose your franchise &amp; begin bidding</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <circle cx="22" cy="22" r="21" fill="rgba(255,255,255,0.1)" />
                <path d="M14 10 L14 34 L32 22 Z" fill="white" fillOpacity="0.9" />
              </svg>
            </div>
          </div>
        </button>

        {/* Team strip */}
        <div>
          <p className="text-gray-600 text-xs font-bold uppercase tracking-widest mb-2">All Franchises</p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {ALL_TEAMS.map(t => {
              const c = TEAM_BADGE_COLORS[t] ?? { from: 'from-gray-600', to: 'to-gray-800', text: 'text-white' }
              return (
                <div key={t} className="shrink-0 flex flex-col items-center gap-1">
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${c.from} ${c.to} flex items-center justify-center font-black ${c.text} text-sm shadow-lg ring-1 ring-white/10`}>
                    {t}
                  </div>
                  <span className="text-gray-600 text-xs font-medium">{t}</span>
                </div>
              )
            })}
          </div>
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
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl px-6 py-12 text-center">
              <div className="flex justify-center mb-3">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="19" fill="url(#emptyBall)" />
                  <path d="M12 8 Q15 20 12 32" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  <path d="M28 8 Q25 20 28 32" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  <defs>
                    <radialGradient id="emptyBall" cx="40%" cy="35%" r="65%">
                      <stop offset="0%" stopColor="#6b7280" />
                      <stop offset="100%" stopColor="#1f2937" />
                    </radialGradient>
                  </defs>
                </svg>
              </div>
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

  const colors = TEAM_BADGE_COLORS[s.userFranchise]
  // Team-colored left border accent using inline style since it's dynamic
  const accentColor = s.userFranchise === 'CSK' ? '#eab308'
    : s.userFranchise === 'MI'   ? '#2563eb'
    : s.userFranchise === 'RCB'  ? '#dc2626'
    : s.userFranchise === 'KKR'  ? '#7c3aed'
    : s.userFranchise === 'DC'   ? '#3b82f6'
    : s.userFranchise === 'RR'   ? '#ec4899'
    : s.userFranchise === 'SRH'  ? '#f97316'
    : s.userFranchise === 'PBKS' ? '#ef4444'
    : s.userFranchise === 'GT'   ? '#0891b2'
    : s.userFranchise === 'LSG'  ? '#14b8a6'
    : '#6b7280'

  return (
    <div
      className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all shadow-card"
      style={{ borderLeft: `3px solid ${accentColor}` }}
    >
      <button
        className="w-full text-left px-4 pt-4 pb-3"
        onClick={() => navigate(`/session/${s.id}`)}
      >
        <div className="flex items-center gap-3">
          <TeamBadge teamId={s.userFranchise} size="lg" showRing />
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{s.name}</p>
            <p className="text-gray-500 text-xs mt-0.5">
              IPL {s.auctionYear} · {s.auctionType}
            </p>
            {/* Team color pill */}
            <div className={`inline-flex mt-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r ${colors?.from ?? 'from-gray-600'} ${colors?.to ?? 'to-gray-800'} bg-opacity-20`}>
              <span className="text-white text-xs font-bold opacity-80">{s.userFranchise}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-xs font-bold ${phaseColor(s.phase)}`}>{phaseLabel(s.phase)}</p>
            <p className="text-gray-700 text-xs mt-0.5">{new Date(s.updatedAt).toLocaleDateString()}</p>
          </div>
        </div>
      </button>

      <div className="border-t border-white/5 px-4 py-2 flex items-center justify-between">
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
