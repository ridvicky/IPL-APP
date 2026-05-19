import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@components/ui/Button'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { TeamBadge } from '@components/ui/TeamBadge'
import { useGameStore } from '@/store/gameStore'
import { useSessionStore } from '@/store/sessionStore'
import { loadDataset } from '@/dataset/datasetLoader'
import { applyRetentions } from '@/engine/retentionEngine'
import { createSession } from '@/session/sessionManager'
import type { TeamId } from '@/types/team'
import type { GameState } from '@/types/game'
import { ALL_TEAM_IDS } from '@/types/team'

const DIFFICULTIES = ['easy', 'normal', 'hard'] as const

const TEAM_COLORS: Record<string, { selected: string; dot: string }> = {
  CSK:  { selected: 'bg-yellow-500/20 border-yellow-400 text-yellow-300 shadow-yellow-500/20',  dot: 'bg-yellow-400' },
  MI:   { selected: 'bg-blue-500/20   border-blue-400   text-blue-300   shadow-blue-500/20',    dot: 'bg-blue-400' },
  RCB:  { selected: 'bg-red-500/20    border-red-400    text-red-300    shadow-red-500/20',      dot: 'bg-red-400' },
  KKR:  { selected: 'bg-purple-500/20 border-purple-400 text-purple-300 shadow-purple-500/20',  dot: 'bg-purple-400' },
  DC:   { selected: 'bg-sky-500/20    border-sky-400    text-sky-300    shadow-sky-500/20',      dot: 'bg-sky-400' },
  RR:   { selected: 'bg-pink-500/20   border-pink-400   text-pink-300   shadow-pink-500/20',    dot: 'bg-pink-400' },
  SRH:  { selected: 'bg-orange-500/20 border-orange-400 text-orange-300 shadow-orange-500/20',  dot: 'bg-orange-400' },
  PBKS: { selected: 'bg-rose-500/20   border-rose-400   text-rose-300   shadow-rose-500/20',    dot: 'bg-rose-400' },
  GT:   { selected: 'bg-cyan-500/20   border-cyan-400   text-cyan-300   shadow-cyan-500/20',    dot: 'bg-cyan-400' },
  LSG:  { selected: 'bg-teal-500/20   border-teal-400   text-teal-300   shadow-teal-500/20',    dot: 'bg-teal-400' },
}

const DIFFICULTY_COLORS = {
  easy:   { selected: 'bg-green-500/20 border-green-400 text-green-300', icon: '🟢' },
  normal: { selected: 'bg-ipl-accent/20 border-ipl-accent text-ipl-gold', icon: '🟡' },
  hard:   { selected: 'bg-red-500/20 border-red-500 text-red-300', icon: '🔴' },
}

const DIFFICULTY_DESC = {
  easy:   'AI teams bid conservatively — good for learning.',
  normal: 'AI teams follow realistic IPL auction patterns.',
  hard:   'AI teams are aggressive and fight for every target.',
}

export function NewSessionScreen() {
  const navigate = useNavigate()
  const { initFromSession } = useGameStore()
  const { setActiveSession } = useSessionStore()

  const [name, setName] = useState('IPL 2025 Mega Auction')
  const [franchise, setFranchise] = useState<TeamId>('MI')
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStart = async () => {
    setLoading(true)
    setError(null)

    try {
      const dataset = await loadDataset(2025)
      const retentionResult = applyRetentions(dataset, 'historical')
      if (retentionResult.errors.length > 0) {
        setError(`Retention error: ${retentionResult.errors[0]}`)
        setLoading(false)
        return
      }

      const initialState: GameState = {
        sessionId: '',
        userFranchise: franchise,
        auctionYear: 2025,
        phase: 'set-preview',
        currentSetIndex: 0,
        currentPlayerIndex: 0,
        currentBidState: null,
        teamStates: retentionResult.teamStates,
        soldPlayers: [],
        unsoldPlayers: [],
        releasedRetainedPlayers: [],
        tradeHistory: [],
        auctionLog: [`Auction started — ${franchise} selected — ${difficulty} difficulty`],
        seasonSetup: null,
        seasonResult: null,
      }

      const session = await createSession({
        name,
        auctionYear: 2025,
        auctionType: 'mega',
        userFranchise: franchise,
        difficulty,
        initialState: { ...initialState, sessionId: '' },
      })

      const finalState: GameState = { ...session.state, sessionId: session.id }
      const finalSession = { ...session, state: finalState }

      initFromSession(finalSession)
      setActiveSession(finalSession)
      navigate('/retention-setup')
    } catch (err) {
      setError(String(err))
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-ipl-darker flex flex-col">
      {/* Header */}
      <header className="px-4 pt-10 pb-4">
        <button
          className="text-gray-500 hover:text-white text-sm flex items-center gap-1.5 mb-4 transition-colors"
          onClick={() => navigate('/')}
        >
          ← Back
        </button>
        <h1 className="text-white font-black text-2xl">New Auction</h1>
        <p className="text-gray-500 text-sm mt-1">Choose your franchise and settings</p>
      </header>

      <main className="flex-1 px-4 pb-8 flex flex-col gap-6 max-w-lg mx-auto w-full">

        {/* Session name */}
        <div>
          <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Session Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-ipl-card border border-ipl-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-ipl-accent focus:ring-1 focus:ring-ipl-accent/20 transition-colors placeholder-gray-700"
            placeholder="IPL 2025 Mega Auction"
          />
        </div>

        {/* Franchise selection */}
        <div>
          <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Your Franchise</label>

          {/* Selected team hero */}
          {franchise && (
            <div className={`flex items-center gap-4 rounded-2xl p-4 border-2 mb-3 transition-all ${TEAM_COLORS[franchise]?.selected ?? ''}`}>
              <TeamBadge teamId={franchise} size="lg" showRing />
              <div>
                <p className="text-white font-black text-xl">{franchise}</p>
                <p className="text-gray-400 text-sm">Selected franchise</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-5 gap-2">
            {ALL_TEAM_IDS.map(id => {
              const isSelected = franchise === id
              const colors = TEAM_COLORS[id]
              return (
                <button
                  key={id}
                  onClick={() => setFranchise(id)}
                  className={[
                    'relative rounded-xl py-3 text-sm font-black border-2 transition-all duration-200',
                    isSelected
                      ? `${colors.selected} shadow-lg scale-105`
                      : 'bg-white/3 border-white/10 text-gray-600 hover:border-white/30 hover:text-gray-400',
                  ].join(' ')}
                >
                  {isSelected && (
                    <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                  )}
                  {id}
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
              const colors = DIFFICULTY_COLORS[d]
              return (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={[
                    'flex items-center gap-4 py-3.5 px-4 rounded-xl text-sm font-bold border-2 capitalize transition-all duration-200 text-left',
                    isSelected
                      ? `${colors.selected} shadow-md`
                      : 'bg-white/3 border-white/10 text-gray-600 hover:border-white/30 hover:text-gray-400',
                  ].join(' ')}
                >
                  <span className="text-xl">{colors.icon}</span>
                  <div className="flex-1">
                    <p className={isSelected ? '' : 'text-gray-400'}>{d.charAt(0).toUpperCase() + d.slice(1)}</p>
                    {isSelected && (
                      <p className="text-xs font-normal mt-0.5 opacity-80">{DIFFICULTY_DESC[d]}</p>
                    )}
                  </div>
                  {isSelected && <span className="text-xs opacity-60">✓</span>}
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
