import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { LoginScreen } from '@screens/LoginScreen'
import { HomeScreen } from '@screens/HomeScreen'
import { NewSessionScreen } from '@screens/NewSessionScreen'
import { AuctionRoomScreen } from '@screens/AuctionRoomScreen'
import { MySquadScreen } from '@screens/MySquadScreen'
import { AllSquadsScreen } from '@screens/AllSquadsScreen'
import { RetentionSetupScreen } from '@screens/RetentionSetupScreen'
import { UnsoldPlayersScreen } from '@screens/UnsoldPlayersScreen'
import { AuctionHistoryScreen } from '@screens/AuctionHistoryScreen'
import { FinalSquadReviewScreen } from '@screens/FinalSquadReviewScreen'
import { TradeWindowScreen } from '@screens/TradeWindowScreen'
import { SeasonSetupScreen } from '@screens/SeasonSetupScreen'
import { SeasonResultsScreen } from '@screens/SeasonResultsScreen'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) {
    return (
      <div className="min-h-screen bg-ipl-darker flex items-center justify-center">
        <LoadingSpinner label="Authenticating..." />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/" element={<RequireAuth><HomeScreen /></RequireAuth>} />
        <Route path="/new-session" element={<RequireAuth><NewSessionScreen /></RequireAuth>} />
        <Route path="/session/:id" element={<RequireAuth><AuctionRoomScreen /></RequireAuth>} />
        <Route path="/auction" element={<RequireAuth><AuctionRoomScreen /></RequireAuth>} />
        <Route path="/retention-setup" element={<RequireAuth><RetentionSetupScreen /></RequireAuth>} />
        <Route path="/my-squad" element={<RequireAuth><MySquadScreen /></RequireAuth>} />
        <Route path="/all-squads" element={<RequireAuth><AllSquadsScreen /></RequireAuth>} />
        <Route path="/unsold" element={<RequireAuth><UnsoldPlayersScreen /></RequireAuth>} />
        <Route path="/history" element={<RequireAuth><AuctionHistoryScreen /></RequireAuth>} />
        <Route path="/final-squad" element={<RequireAuth><FinalSquadReviewScreen /></RequireAuth>} />
        <Route path="/trade-window" element={<RequireAuth><TradeWindowScreen /></RequireAuth>} />
        <Route path="/season-setup" element={<RequireAuth><SeasonSetupScreen /></RequireAuth>} />
        <Route path="/season-results" element={<RequireAuth><SeasonResultsScreen /></RequireAuth>} />
        {/* Legacy paths kept for backward compat with menu links */}
        <Route path="/unsold-players" element={<Navigate to="/unsold" replace />} />
        <Route path="/auction-history" element={<Navigate to="/history" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
