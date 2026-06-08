import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'

export function MatchSimScreen() {
  const navigate = useNavigate()
  const { setPhase } = useGameStore()

  const handleMatchEnd = () => {
    setPhase('post-match')
    navigate('/post-match')
  }

  return (
    <div className="min-h-screen bg-ipl-darker flex flex-col safe-top">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-white">Match Simulation</h1>
        <p className="text-gray-400 text-sm mt-1">Powerplay → Middle → Death overs</p>
      </div>

      <div className="flex-1 px-4 pb-6">
        <div className="bg-ipl-card border border-ipl-border rounded-2xl p-5 text-center">
          <p className="text-gray-500 text-sm">Live match simulation coming soon.</p>
        </div>
      </div>

      <div className="px-4 pb-8 safe-bottom">
        <button
          onClick={handleMatchEnd}
          className="w-full py-4 rounded-2xl font-bold text-base bg-ipl-accent text-white"
        >
          Simulate Match →
        </button>
      </div>
    </div>
  )
}
