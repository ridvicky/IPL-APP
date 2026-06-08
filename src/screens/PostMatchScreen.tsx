import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'

export function PostMatchScreen() {
  const navigate = useNavigate()
  const { gameState, setPhase } = useGameStore()

  const matchIndex = gameState?.currentMatchIndex ?? 0
  const isSeasonOver = matchIndex >= 13

  const handleNext = () => {
    if (isSeasonOver) {
      setPhase('season-complete')
      navigate('/season-results')
    } else {
      setPhase('season-hub')
      navigate('/season-hub')
    }
  }

  return (
    <div className="min-h-screen bg-ipl-darker flex flex-col safe-top">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-white">Match Report</h1>
        <p className="text-gray-400 text-sm mt-1">Scorecard, commentary and points table.</p>
      </div>

      <div className="flex-1 px-4 pb-6">
        <div className="bg-ipl-card border border-ipl-border rounded-2xl p-5 text-center">
          <p className="text-gray-500 text-sm">Post-match scorecards and LLM commentary coming soon.</p>
        </div>
      </div>

      <div className="px-4 pb-8 safe-bottom flex flex-col gap-3">
        <button
          onClick={() => { setPhase('training'); navigate('/training') }}
          className="w-full py-3 rounded-2xl font-semibold text-sm border border-ipl-border text-gray-300"
        >
          Training Session
        </button>
        <button
          onClick={handleNext}
          className="w-full py-4 rounded-2xl font-bold text-base bg-ipl-accent text-white"
        >
          {isSeasonOver ? 'Season Report →' : 'Next Match →'}
        </button>
      </div>
    </div>
  )
}
