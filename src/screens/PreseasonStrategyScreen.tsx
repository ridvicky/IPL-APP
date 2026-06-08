import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import type { TeamPhilosophy } from '@/types/season'

const PHILOSOPHIES: { id: TeamPhilosophy; icon: string; label: string; description: string }[] = [
  { id: 'power-hitters',     icon: '⚡', label: 'Power Hitters',     description: 'Aggressive batting, attack first in every phase' },
  { id: 'pace-attack',       icon: '🎯', label: 'Pace Attack',       description: 'Fast bowling focused — exploit pace-friendly conditions' },
  { id: 'spin-web',          icon: '🌀', label: 'Spin Web',          description: 'Spin-dominant bowling plan, strangle in the middle overs' },
  { id: 'experience-first',  icon: '🧠', label: 'Experience First',  description: 'Veteran-led, steady and composed under pressure' },
  { id: 'youth-revolution',  icon: '🌱', label: 'Youth Revolution',  description: 'Build around potential — back the young guns' },
  { id: 'balanced',          icon: '⚖️', label: 'Balanced',          description: 'No strong bias — adapt to conditions and opponents' },
]

export function PreseasonStrategyScreen() {
  const navigate = useNavigate()
  const { gameState, setPhase } = useGameStore()
  const selected = gameState?.teamPhilosophy

  const handleSelect = (philosophy: TeamPhilosophy) => {
    useGameStore.getState().updateSeasonField('teamPhilosophy', philosophy)
  }

  const handleContinue = () => {
    if (!selected) return
    setPhase('preseason-training')
    navigate('/training')
  }

  return (
    <div className="min-h-screen bg-ipl-darker flex flex-col safe-top">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-white">Team Philosophy</h1>
        <p className="text-gray-400 text-sm mt-1">Choose your seasonal identity — this shapes how your team approaches every match.</p>
      </div>

      <div className="flex-1 px-4 pb-6 flex flex-col gap-3">
        {PHILOSOPHIES.map(p => (
          <button
            key={p.id}
            onClick={() => handleSelect(p.id)}
            className={`w-full text-left p-4 rounded-2xl border transition-all ${
              selected === p.id
                ? 'bg-ipl-accent/15 border-ipl-accent shadow-glow-accent'
                : 'bg-ipl-card border-ipl-border'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{p.icon}</span>
              <div>
                <p className="font-bold text-white">{p.label}</p>
                <p className="text-gray-400 text-sm">{p.description}</p>
              </div>
              {selected === p.id && (
                <span className="ml-auto text-ipl-accent font-bold text-lg">✓</span>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="px-4 pb-8 safe-bottom">
        <button
          onClick={handleContinue}
          disabled={!selected}
          className="w-full py-4 rounded-2xl font-bold text-base transition-all bg-ipl-accent text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Begin Preseason Training →
        </button>
      </div>
    </div>
  )
}
