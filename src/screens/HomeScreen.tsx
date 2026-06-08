import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { tap, action, warning } from '@/utils/haptics'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { TeamBadge, TEAM_BADGE_COLORS } from '@components/ui/TeamBadge'
import { useAuthStore } from '@/store/authStore'
import { useSessionStore } from '@/store/sessionStore'
import gplLogo from '@/assets/gpl_logo.svg'
import type { SessionMeta } from '@/types/session'

// ── Phase display helpers ─────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = {
  'setup':                'Setup',
  'retention':            'Retention',
  'trade-window':         'Trade Window',
  'set-preview':          'In Auction',
  'bidding':              'In Auction',
  'rtm-decision':         'In Auction',
  'sale-confirmed':       'In Auction',
  'unsold-confirmed':     'In Auction',
  'set-complete':         'In Auction',
  'auction-complete':     'Auction Done',
  'accelerated-selection':'In Auction',
  // legacy
  'season-setup':         'Season Setup',
  'season-simulation':    'Simulating…',
  // new season phases
  'preseason-strategy':   'Preseason',
  'preseason-training':   'Preseason',
  'season-hub':           'Season Active',
  'pre-match':            'Match Day',
  'match-sim':            'Match Live',
  'innings-break':        'Innings Break',
  'post-match':           'Post Match',
  'training':             'Training',
  'playoff':              'Playoffs',
  'season-complete':      'Season Complete',
}

function phaseLabel(phase: string) {
  return PHASE_LABEL[phase] ?? phase
}

function phaseColor(phase: string) {
  if (['season-complete'].includes(phase)) return 'text-green-400'
  if (['season-hub', 'pre-match', 'match-sim', 'innings-break', 'post-match', 'training', 'playoff'].includes(phase)) return 'text-ipl-gold'
  if (['preseason-strategy', 'preseason-training'].includes(phase)) return 'text-blue-400'
  if (['auction-complete'].includes(phase)) return 'text-green-400'
  if (phase.includes('auction') || phase.includes('bid') || phase.includes('set')) return 'text-ipl-gold'
  return 'text-gray-500'
}

function isSeasonPhase(phase: string) {
  return ['preseason-strategy', 'preseason-training', 'season-hub', 'pre-match', 'match-sim',
          'innings-break', 'post-match', 'training', 'playoff', 'season-complete',
          'season-setup', 'season-simulation'].includes(phase)
}

function sessionRoute(session: SessionMeta): string {
  switch (session.phase) {
    case 'preseason-strategy': return '/preseason-strategy'
    case 'preseason-training': return '/training'
    case 'season-hub':         return '/season-hub'
    case 'pre-match':          return '/pre-match'
    case 'match-sim':          return '/match-sim'
    case 'innings-break':      return '/match-sim'
    case 'post-match':         return '/post-match'
    case 'training':           return '/training'
    case 'playoff':            return '/playoff'
    case 'season-complete':    return '/season-results'
    case 'season-setup':       return '/season-setup'
    case 'season-simulation':  return '/season-results'
    case 'auction-complete':   return '/final-squad'
    default:                   return `/session/${session.id}`
  }
}

// ── Primary CTA (based on most recent session) ───────────────────────────────

interface PrimaryCTA {
  label: string
  sublabel: string
  badge?: string
  route: string
  isNew?: boolean
}

function getPrimaryCTA(mostRecent: SessionMeta | undefined): PrimaryCTA {
  if (!mostRecent) {
    return { label: 'Start New Season', sublabel: 'Choose your franchise & begin', badge: 'NEW', route: '/new-session', isNew: true }
  }
  const p = mostRecent.phase
  if (['preseason-strategy'].includes(p))
    return { label: 'Set Team Philosophy', sublabel: `${mostRecent.userFranchise} — choose your seasonal identity`, badge: 'PRESEASON', route: '/preseason-strategy' }
  if (['preseason-training'].includes(p))
    return { label: 'Preseason Training', sublabel: `${mostRecent.userFranchise} — sharpen the squad`, badge: 'PRESEASON', route: '/training' }
  if (['season-hub', 'post-match', 'training'].includes(p))
    return { label: 'Continue Season', sublabel: `${mostRecent.userFranchise} — Season Hub`, badge: 'LIVE', route: '/season-hub' }
  if (['pre-match'].includes(p))
    return { label: 'Match Day Setup', sublabel: `${mostRecent.userFranchise} — select your XI`, badge: 'MATCH DAY', route: '/pre-match' }
  if (['match-sim', 'innings-break'].includes(p))
    return { label: 'Match In Progress', sublabel: `${mostRecent.userFranchise} — resume live match`, badge: 'LIVE', route: '/match-sim' }
  if (['playoff'].includes(p))
    return { label: 'Playoff Match', sublabel: `${mostRecent.userFranchise} — knockout stage`, badge: 'PLAYOFFS', route: '/playoff' }
  if (['season-complete', 'season-simulation'].includes(p))
    return { label: 'Season Report', sublabel: `${mostRecent.userFranchise} — view final standings`, badge: 'DONE', route: '/season-results' }
  if (['auction-complete'].includes(p))
    return { label: 'Review Your Squad', sublabel: `${mostRecent.userFranchise} — finalize before season`, badge: 'NEXT', route: '/final-squad' }
  if (['season-setup'].includes(p))
    return { label: 'Season Setup', sublabel: `${mostRecent.userFranchise} — set captain & tactics`, badge: 'NEXT', route: '/season-setup' }
  // auction in progress
  return { label: 'Continue Auction', sublabel: `${mostRecent.userFranchise} — resume bidding`, badge: 'LIVE', route: `/session/${mostRecent.id}` }
}

// ── Franchise strip ───────────────────────────────────────────────────────────

const ALL_TEAMS = ['CSK','MI','RCB','KKR','DC','RR','SRH','PBKS','GT','LSG']

// ── Main component ────────────────────────────────────────────────────────────

export function HomeScreen() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const { sessions, loadingSessions, fetchSessions, removeSession } = useSessionStore()

  useEffect(() => { void fetchSessions() }, [fetchSessions])

  const displayName = user?.email?.split('@')[0] ?? 'Manager'
  const cta = getPrimaryCTA(sessions[0])

  return (
    <div className="min-h-screen bg-ipl-darker flex flex-col">
      {/* ── HERO HEADER ── */}
      <header className="relative overflow-hidden safe-top">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-ipl-darker to-ipl-darker" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-ipl-accent/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 px-4 pt-6 pb-4 flex flex-col items-center text-center">
          <div className="w-full flex items-center justify-between mb-4">
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

          <img src={gplLogo} alt="GPL Season" className="w-52 h-auto drop-shadow-[0_0_24px_rgba(201,162,39,0.35)]" />

          {/* Journey steps */}
          <div className="flex items-center gap-1.5 mt-3">
            {['Auction', 'Build', 'Simulate'].map((step, i) => (
              <span key={step} className="flex items-center gap-1.5">
                <span className="text-gray-600 text-xs font-semibold">{step}</span>
                {i < 2 && <span className="text-gray-700 text-xs">→</span>}
              </span>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-ipl-darker to-transparent" />
      </header>

      <main className="flex-1 px-4 py-5 flex flex-col gap-5">

        {/* ── PRIMARY CTA ── */}
        <button
          onClick={() => { action(); navigate(cta.route) }}
          className="relative overflow-hidden w-full rounded-2xl group"
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-ipl-accent via-red-500 to-ipl-accent opacity-80 blur-sm group-hover:opacity-100 transition-opacity" />
          <div className="relative bg-gradient-to-r from-ipl-accent/90 to-red-800 rounded-2xl px-6 py-5 flex items-center justify-between border border-ipl-accent/40">
            <div className="text-left">
              <div className="flex items-center gap-2 mb-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                <span className="text-white/80 text-xs font-bold tracking-widest uppercase">{cta.badge ?? 'LIVE'}</span>
              </div>
              <p className="text-white font-black text-xl leading-tight">{cta.label}</p>
              <p className="text-red-200 text-sm mt-0.5">{cta.sublabel}</p>
            </div>
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <circle cx="22" cy="22" r="21" fill="rgba(255,255,255,0.1)" />
              <path d="M14 10 L14 34 L32 22 Z" fill="white" fillOpacity="0.9" />
            </svg>
          </div>
        </button>

        {/* Start new (secondary) if they have an existing session */}
        {sessions.length > 0 && (
          <button
            onClick={() => { tap(); navigate('/new-session') }}
            className="w-full py-3 rounded-xl border border-ipl-border text-gray-400 text-sm font-semibold hover:border-gray-500 hover:text-gray-300 transition-colors"
          >
            + Start New Season
          </button>
        )}

        {/* ── FRANCHISE STRIP ── */}
        <div>
          <p className="text-gray-600 text-xs font-bold uppercase tracking-widest mb-2">Franchises</p>
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

        {/* ── SAVED SESSIONS ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-gray-400 text-xs font-bold uppercase tracking-widest">Saved Sessions</h2>
            {sessions.length > 0 && (
              <span className="text-gray-600 text-xs">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {loadingSessions ? (
            <div className="py-8"><LoadingSpinner label="Loading sessions..." /></div>
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
              <p className="text-gray-600 text-sm mt-1">Start a new season to begin.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <HeroSessionCard session={sessions[0]} onDelete={() => void removeSession(sessions[0].id)} />
              {sessions.slice(1).map(s => <SessionCard key={s.id} session={s} onDelete={() => void removeSession(s.id)} />)}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ── Session cards ─────────────────────────────────────────────────────────────

function HeroSessionCard({ session: s, onDelete }: { session: SessionMeta; onDelete: () => void }) {
  const navigate = useNavigate()
  const colors = TEAM_BADGE_COLORS[s.userFranchise] ?? { from: 'from-gray-600', to: 'to-gray-800', text: 'text-white', ring: 'ring-gray-400' }
  const route = sessionRoute(s)

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colors.from} ${colors.to}`}>
      <svg className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10 w-28 h-28" viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="38" stroke="white" strokeWidth="4" />
        <path d="M22 6 Q28 40 22 74" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M58 6 Q52 40 58 74" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>

      <button className="relative z-10 w-full text-left p-5" onClick={() => { tap(); navigate(route) }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <span className="text-white/70 text-xs font-bold uppercase tracking-widest">
            {phaseLabel(s.phase)}
          </span>
        </div>

        <p className={`font-black text-2xl ${colors.text} leading-tight`}>{s.userFranchise}</p>
        <p className="text-white/75 text-sm font-semibold mt-0.5">{s.name}</p>
        <p className="text-white/50 text-xs mt-0.5">GPL {s.auctionYear} · {s.auctionType}</p>

        {isSeasonPhase(s.phase) && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1">
            <span className="text-white/80 text-xs font-semibold">🏏 Season in progress</span>
          </div>
        )}

        <p className="text-white/40 text-xs mt-3">Last played {new Date(s.updatedAt).toLocaleDateString()}</p>
      </button>

      <div className="relative z-10 border-t border-white/15 px-5 py-3 flex items-center justify-between">
        <button
          onClick={() => { tap(); navigate(route) }}
          className="bg-white/20 hover:bg-white/30 text-white font-black text-sm px-5 py-2 rounded-xl transition-colors"
        >
          Continue →
        </button>
        <button onClick={() => { warning(); onDelete() }} className="text-white/40 hover:text-white/70 text-xs transition-colors">
          Delete
        </button>
      </div>
    </div>
  )
}

function SessionCard({ session: s, onDelete }: { session: SessionMeta; onDelete: () => void }) {
  const navigate = useNavigate()
  const colors = TEAM_BADGE_COLORS[s.userFranchise]
  const route = sessionRoute(s)

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
      <button className="w-full text-left px-4 pt-4 pb-3" onClick={() => { tap(); navigate(route) }}>
        <div className="flex items-center gap-3">
          <TeamBadge teamId={s.userFranchise} size="lg" showRing />
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{s.name}</p>
            <p className="text-gray-500 text-xs mt-0.5">GPL {s.auctionYear} · {s.auctionType}</p>
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
        <button onClick={() => { tap(); navigate(route) }} className="text-ipl-accent text-xs font-bold hover:text-red-400 transition-colors">
          Continue →
        </button>
        <button onClick={() => { warning(); onDelete() }} className="text-gray-700 hover:text-ipl-accent text-xs transition-colors">
          Delete
        </button>
      </div>
    </div>
  )
}
