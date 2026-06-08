import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'

export function SeasonHubScreen() {
  const navigate = useNavigate()
  const { gameState, setPhase } = useGameStore()

  const handlePlayMatch = () => {
    setPhase('pre-match')
    navigate('/pre-match')
  }

  return (
    <div className="min-h-screen bg-ipl-darker flex flex-col safe-top">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-white">Season Hub</h1>
        <p className="text-gray-400 text-sm mt-1">
          {gameState?.userFranchise?.toUpperCase()} — Match {(gameState?.currentMatchIndex ?? 0) + 1} of 14
        </p>
      </div>

      <div className="flex-1 px-4 pb-6 flex flex-col gap-4">
        <div className="bg-ipl-card border border-ipl-border rounded-2xl p-5 text-center">
          <p className="text-gray-500 text-sm">Season Hub — fixtures, table and stats coming soon.</p>
        </div>
      </div>

      <div className="px-4 pb-8 safe-bottom">
        <button
          onClick={handlePlayMatch}
          className="w-full py-4 rounded-2xl font-bold text-base bg-ipl-accent text-white"
        >
          Match Day →
        </button>
      </div>
    </div>
  )
}
