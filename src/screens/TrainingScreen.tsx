import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'

export function TrainingScreen() {
  const navigate = useNavigate()
  const { gameState, setPhase } = useGameStore()
  const isPreseason = gameState?.phase === 'preseason-training'

  const handleContinue = () => {
    if (isPreseason) {
      setPhase('season-hub')
      navigate('/season-hub')
    } else {
      setPhase('season-hub')
      navigate('/season-hub')
    }
  }

  return (
    <div className="min-h-screen bg-ipl-darker flex flex-col items-center justify-center safe-top px-6">
      <div className="text-center mb-8">
        <span className="text-5xl">🎯</span>
        <h1 className="text-2xl font-bold text-white mt-4">
          {isPreseason ? 'Preseason Training' : 'Training Session'}
        </h1>
        <p className="text-gray-400 text-sm mt-2">
          {isPreseason
            ? 'Set your team focus areas before the season kicks off.'
            : 'Assign training to sharpen players before the next match.'}
        </p>
      </div>

      <div className="w-full max-w-sm bg-ipl-card border border-ipl-border rounded-2xl p-6 text-center">
        <p className="text-gray-500 text-sm">Training system coming soon.</p>
      </div>

      <div className="mt-8 w-full max-w-sm flex flex-col gap-3">
        <button
          onClick={handleContinue}
          className="w-full py-4 rounded-2xl font-bold text-base bg-ipl-accent text-white"
        >
          {isPreseason ? 'Start Season →' : 'Next Match →'}
        </button>
        {!isPreseason && (
          <button
            onClick={handleContinue}
            className="w-full py-3 rounded-2xl font-semibold text-sm text-gray-400 border border-ipl-border"
          >
            Skip Training
          </button>
        )}
      </div>
    </div>
  )
}
