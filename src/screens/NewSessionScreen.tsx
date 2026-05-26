import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@components/ui/Button'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { TEAM_BADGE_COLORS } from '@components/ui/TeamBadge'
import { useGameStore } from '@/store/gameStore'
import { useSessionStore } from '@/store/sessionStore'
import { loadDataset } from '@/dataset/datasetLoader'
import { applyRetentions } from '@/engine/retentionEngine'
import { createSession } from '@/session/sessionManager'
import type { TeamId } from '@/types/team'
import type { GameState } from '@/types/game'
import { ALL_TEAM_IDS } from '@/types/team'

const AUCTION_YEARS = [
  { year: 2025, type: 'Mega Auction', teams: 10, available: true },
  { year: 2024, type: 'Mini Auction', teams: 10, available: false },
  { year: 2023, type: 'Mini Auction', teams: 10, available: false },
  { year: 2022, type: 'Mega Auction', teams: 10, available: false },
  { year: 2021, type: 'Mini Auction', teams: 8,  available: false },
  { year: 2020, type: 'Mini Auction', teams: 8,  available: false },
]

const DIFFICULTIES = ['easy', 'normal', 'hard'] as const

const TEAM_TAGLINES: Record<string, string> = {
  CSK:  'Whistle Podu',
  MI:   'Duniya Hila De',
  RCB:  'Ee Sala Cup Namde',
  KKR:  'Korbo Lorbo Jeetbo',
  DC:   'Roar Macha',
  RR:   'Halla Bol',
  SRH:  'Orange Army',
  PBKS: 'Sher Punjab Da',
  GT:   'Aava De',
  LSG:  'Lucknow Ki Aawaz',
}

const TEAM_FULL_NAMES: Record<string, string> = {
  CSK:  'Chennai Super Kings',
  MI:   'Mumbai Indians',
  RCB:  'Royal Challengers Bangalore',
  KKR:  'Kolkata Knight Riders',
  DC:   'Delhi Capitals',
  RR:   'Rajasthan Royals',
  SRH:  'Sunrisers Hyderabad',
  PBKS: 'Punjab Kings',
  GT:   'Gujarat Titans',
  LSG:  'Lucknow Super Giants',
}

const DIFFICULTY_INFO = {
  easy: {
    label: 'Easy',
    desc: 'AI teams bid conservatively — good for learning.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="10" fill="#22c55e" fillOpacity="0.2" stroke="#22c55e" strokeWidth="1.5" />
        <path d="M7 11 L10 14 L15 8" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    selected: 'bg-green-500/15 border-green-400 text-green-300',
    glow: 'shadow-green-500/20',
  },
  normal: {
    label: 'Normal',
    desc: 'AI teams follow realistic IPL auction patterns.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="10" fill="#d4af37" fillOpacity="0.2" stroke="#d4af37" strokeWidth="1.5" />
        <path d="M11 6 L13 10 L17 10.5 L14 13.5 L14.5 18 L11 16 L7.5 18 L8 13.5 L5 10.5 L9 10 Z" fill="#d4af37" fillOpacity="0.8" />
      </svg>
    ),
    selected: 'bg-ipl-gold/15 border-ipl-gold text-ipl-gold',
    glow: 'shadow-yellow-500/20',
  },
  hard: {
    label: 'Hard',
    desc: 'AI teams are aggressive and fight for every target.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="10" fill="#ef4444" fillOpacity="0.2" stroke="#ef4444" strokeWidth="1.5" />
        <path d="M13 4 L10 10 L13 10 L9 18 L12 12 L9 12 Z" fill="#ef4444" fillOpacity="0.9" />
      </svg>
    ),
    selected: 'bg-red-500/15 border-red-500 text-red-300',
    glow: 'shadow-red-500/20',
  },
}

export function NewSessionScreen() {
  const navigate = useNavigate()
  const { initFromSession } = useGameStore()
  const { setActiveSession } = useSessionStore()

  const [selectedYear, setSelectedYear] = useState(2025)
  const [name, setName] = useState('IPL 2025 Mega Auction')
  const [franchise, setFranchise] = useState<TeamId>('CSK')
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStart = async () => {
    setLoading(true)
    setError(null)

    try {
      const dataset = await loadDataset(selectedYear)
      const retentionResult = applyRetentions(dataset, 'historical')
      if (retentionResult.errors.length > 0) {
        setError(`Retention error: ${retentionResult.errors[0]}`)
        setLoading(false)
        return
      }

      const initialState: GameState = {
        sessionId: '',
        userFranchise: franchise,
        auctionYear: selectedYear,
        phase: 'set-preview',
        currentSetIndex: 0,
        currentPlayerIndex: 0,
        currentBidState: null,
        teamStates: retentionResult.teamStates,
        soldPlayers: [],
        unsoldPlayers: [],
        releasedRetainedPlayers: [],
        setPlayerOrder: {},
        isReauction: false,
        reauctionPool: [],
        reauctionIndex: 0,
        acceleratedPicks: [],
        tradeHistory: [],
        auctionLog: [`Auction started — ${franchise} selected — ${difficulty} difficulty`],
        seasonSetup: null,
        seasonResult: null,
      }

      const session = await createSession({
        name,
        auctionYear: selectedYear,
        auctionType: AUCTION_YEARS.find(y => y.year === selectedYear)?.type.toLowerCase().startsWith('mega') ? 'mega' : 'mini',
        userFranchise: franchise,
        difficulty,
        initialState: { ...initialState, sessionId: '' },
      })

      const finalState: GameState = { ...session.state, sessionId: session.id }
      const finalSession = { ...session, state: finalState }

      initFromSession(finalSession)
      setActiveSession(finalSession)
      navigate('/trade-window')
    } catch (err) {
      setError(String(err))
    }

    setLoading(false)
  }

  const teamColors = TEAM_BADGE_COLORS[franchise] ?? { from: 'from-gray-600', to: 'to-gray-800', text: 'text-white', ring: 'ring-gray-400' }

  return (
    <div className="min-h-screen bg-ipl-darker flex flex-col">
      {/* Header */}
      <header className="relative overflow-hidden px-4 pb-4 safe-top">
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <button
            className="text-gray-500 hover:text-white text-sm flex items-center gap-1.5 mb-4 transition-colors"
            onClick={() => navigate('/')}
          >
            ← Back
          </button>
          <h1 className="text-white font-black text-2xl">New Auction</h1>
          <p className="text-gray-500 text-sm mt-1">Choose your franchise and settings</p>
        </div>
      </header>

      <main className="flex-1 px-4 pb-8 flex flex-col gap-6 max-w-lg mx-auto w-full">

        {/* Auction Year */}
        <div>
          <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Auction Year</label>
          <div className="grid grid-cols-2 gap-2">
            {AUCTION_YEARS.map(({ year, type, teams, available }) => {
              const isSelected = selectedYear === year
              return (
                <button
                  key={year}
                  disabled={!available}
                  onClick={() => available && setSelectedYear(year)}
                  className={[
                    'relative flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all duration-200',
                    available
                      ? isSelected
                        ? 'bg-ipl-gold/15 border-ipl-gold shadow-md'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                      : 'bg-white/3 border-white/5 opacity-50 cursor-not-allowed',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className={`font-black text-lg ${isSelected && available ? 'text-ipl-gold' : available ? 'text-white' : 'text-gray-600'}`}>
                      {year}
                    </span>
                    {available
                      ? isSelected && <span className="text-ipl-gold text-sm">✓</span>
                      : <span className="text-xs bg-white/10 text-gray-500 px-1.5 py-0.5 rounded font-medium">Soon</span>
                    }
                  </div>
                  <p className={`text-xs ${available ? 'text-gray-400' : 'text-gray-600'}`}>{type}</p>
                  <p className={`text-xs ${available ? 'text-gray-500' : 'text-gray-700'}`}>{teams} teams</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Session name */}
        <div>
          <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Session Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-ipl-accent focus:ring-1 focus:ring-ipl-accent/20 transition-colors placeholder-gray-700"
            placeholder="IPL 2025 Mega Auction"
          />
        </div>

        {/* Franchise selection */}
        <div>
          <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Your Franchise</label>

          {/* Full-width team banner */}
          <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${teamColors.from} ${teamColors.to} p-5 mb-4`}>
            {/* Seam decoration */}
            <svg className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10 w-24 h-24" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="38" stroke="white" strokeWidth="4" />
              <path d="M22 6 Q28 40 22 74" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M58 6 Q52 40 58 74" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
            <div className="relative z-10">
              <p className={`font-black text-3xl tracking-tight ${teamColors.text} leading-none`}>{franchise}</p>
              <p className="text-white/90 font-bold text-base mt-0.5">{TEAM_FULL_NAMES[franchise] ?? franchise}</p>
              <p className="text-white/60 text-sm italic mt-1">"{TEAM_TAGLINES[franchise] ?? ''}"</p>
            </div>
          </div>

          {/* Team grid */}
          <div className="grid grid-cols-5 gap-2">
            {ALL_TEAM_IDS.map(id => {
              const isSelected = franchise === id
              const c = TEAM_BADGE_COLORS[id] ?? { from: 'from-gray-600', to: 'to-gray-800', text: 'text-white' }
              return (
                <button
                  key={id}
                  onClick={() => setFranchise(id)}
                  className={[
                    'relative rounded-xl py-4 flex items-center justify-center font-black text-sm transition-all duration-200',
                    `bg-gradient-to-br ${c.from} ${c.to}`,
                    isSelected
                      ? `scale-110 shadow-lg ring-2 ${c.text}`
                      : 'opacity-40 hover:opacity-70 scale-100',
                  ].join(' ')}
                  style={isSelected ? { boxShadow: `0 0 16px rgba(255,255,255,0.2)` } : {}}
                >
                  <span className={isSelected ? c.text : 'text-white'}>{id}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Difficulty</label>
          <div className="flex flex-col gap-2">
            {DIFFICULTIES.map(d => {
              const isSelected = difficulty === d
              const info = DIFFICULTY_INFO[d]
              return (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={[
                    'flex items-center gap-4 py-4 px-5 rounded-xl text-sm font-bold border-2 transition-all duration-200 text-left',
                    isSelected
                      ? `${info.selected} shadow-md ${info.glow}`
                      : 'bg-white/5 border-white/10 text-gray-600 hover:border-white/20 hover:text-gray-400',
                  ].join(' ')}
                >
                  <span className="shrink-0">{info.icon}</span>
                  <div className="flex-1">
                    <p className={`font-black ${isSelected ? '' : 'text-gray-400'}`}>{info.label}</p>
                    {isSelected && (
                      <p className="text-xs font-normal mt-0.5 opacity-75">{info.desc}</p>
                    )}
                  </div>
                  {isSelected && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="currentColor" fillOpacity="0.2" />
                      <path d="M5 8 L7 10 L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="bg-ipl-accent/10 border border-ipl-accent/30 rounded-xl px-4 py-3">
            <p className="text-ipl-accent text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <LoadingSpinner label="Setting up auction..." />
        ) : (
          <Button variant="primary" size="lg" onClick={() => void handleStart()} disabled={!name.trim()} className="h-14 text-base font-black">
            Begin Auction Setup →
          </Button>
        )}
      </main>
    </div>
  )
}
