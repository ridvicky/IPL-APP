import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'

export function PreMatchScreen() {
  const navigate = useNavigate()
  const { setPhase } = useGameStore()

  const handleStartMatch = () => {
    setPhase('match-sim')
    navigate('/match-sim')
  }

  return (
    <div className="min-h-screen bg-ipl-darker flex flex-col safe-top">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-white">Pre-Match Setup</h1>
        <p className="text-gray-400 text-sm mt-1">Select your XI, tactics and captain before the match.</p>
      </div>

      <div className="flex-1 px-4 pb-6">
        <div className="bg-ipl-card border border-ipl-border rounded-2xl p-5 text-center">
          <p className="text-gray-500 text-sm">XI selection, tactics and toss coming soon.</p>
        </div>
      </div>

      <div className="px-4 pb-8 safe-bottom">
        <button
          onClick={handleStartMatch}
          className="w-full py-4 rounded-2xl font-bold text-base bg-ipl-accent text-white"
        >
          Start Match →
        </button>
      </div>
    </div>
  )
}
