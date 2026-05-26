import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tap } from '@/utils/haptics'
import { useGameStore } from '@/store/gameStore'
import { TeamBadge, TEAM_BADGE_COLORS } from '@components/ui/TeamBadge'
import { BottomNav } from '@components/ui/BottomNav'
import type { TeamId } from '@/types/team'
import type { TeamSeasonResult, TeamReview } from '@/types/season'

type Tab = 'table' | 'awards' | 'myteam' | 'allteams'

const POSITION_COLOR = ['text-ipl-gold', 'text-gray-300', 'text-orange-400', 'text-blue-400']
const POSITION_MEDAL = ['🥇', '🥈', '🥉', '4️⃣']

function PositionBadge({ pos }: { pos: number }) {
  if (pos <= 4) {
    return (
      <span className={`font-black text-sm ${POSITION_COLOR[pos - 1] ?? 'text-gray-400'}`}>
        {POSITION_MEDAL[pos - 1] ?? pos}
      </span>
    )
  }
  return <span className="text-gray-600 font-bold text-sm">{pos}</span>
}

function PointsTableRow({ result, isUser }: { result: TeamSeasonResult; isUser: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 ${
      isUser ? 'bg-ipl-accent/5 rounded-xl px-2 -mx-2' : ''
    }`}>
      <PositionBadge pos={result.position} />
      <TeamBadge teamId={result.teamId} size="sm" />
      <span className={`flex-1 text-sm font-bold ${isUser ? 'text-ipl-accent' : 'text-white'}`}>
        {result.teamId} {isUser && '(You)'}
      </span>
      {result.qualifiedForPlayoffs && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">PO</span>
      )}
      <span className="text-white font-black text-sm w-8 text-right">{result.points}</span>
      <span className={`text-xs w-14 text-right ${result.nrr >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {result.nrr >= 0 ? '+' : ''}{result.nrr.toFixed(3)}
      </span>
    </div>
  )
}

function AwardCard({ icon, title, playerName, teamId, value, unit }: {
  icon: string; title: string; playerName: string; teamId: string; value: number; unit: string
}) {
  return (
    <div className="bg-ipl-card border border-ipl-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{icon}</span>
        <p className="text-gray-400 text-xs uppercase tracking-widest">{title}</p>
      </div>
      <div className="flex items-center gap-3">
        <TeamBadge teamId={teamId} size="sm" />
        <div>
          <p className="text-white font-black text-base">{playerName}</p>
          <p className="text-gray-500 text-xs">{teamId}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-ipl-gold font-black text-lg">{value}</p>
          <p className="text-gray-600 text-xs">{unit}</p>
        </div>
      </div>
    </div>
  )
}

function TeamReviewCard({ review, isUser }: { review: TeamReview; isUser: boolean }) {
  const ratingBar = (val: number) => (
    <div className="flex gap-0.5 mt-0.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className={`h-1.5 flex-1 rounded-full ${i < val ? 'bg-ipl-accent' : 'bg-white/10'}`} />
      ))}
    </div>
  )

  return (
    <div className={`bg-ipl-card border rounded-2xl p-4 ${isUser ? 'border-ipl-accent/50' : 'border-ipl-border'}`}>
      <div className="flex items-center gap-3 mb-3">
        <TeamBadge teamId={review.teamId} size="md" showRing={isUser} />
        <div className="flex-1">
          <p className={`font-black text-base ${isUser ? 'text-ipl-accent' : 'text-white'}`}>
            {review.teamId} {isUser && '(You)'}
          </p>
          <p className="text-gray-500 text-xs">Finished #{review.finalPosition}</p>
        </div>
        <span className="text-2xl">
          {review.finalPosition === 1 ? '🏆' : review.finalPosition <= 4 ? '🎯' : review.finalPosition <= 7 ? '😐' : '😞'}
        </span>
      </div>

      <p className="text-gray-300 text-sm mb-3 leading-relaxed">{review.summary}</p>

      <div className="space-y-2 mb-3">
        {[
          { label: 'Batting', val: review.battingRating },
          { label: 'Bowling', val: review.bowlingRating },
          { label: 'Squad Balance', val: review.squadBalanceRating },
          { label: 'Squad Depth', val: review.depthRating },
          { label: 'Auction Value', val: review.auctionValueRating },
        ].map(r => (
          <div key={r.label}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-500">{r.label}</span>
              <span className="text-gray-400 font-bold">{r.val}/10</span>
            </div>
            {ratingBar(r.val)}
          </div>
        ))}
      </div>

      {review.keyPerformers.length > 0 && (
        <div className="mb-2">
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Key Performers</p>
          <div className="flex flex-wrap gap-1">
            {review.keyPerformers.map(n => (
              <span key={n} className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/25">{n}</span>
            ))}
          </div>
        </div>
      )}

      {review.underperformers.length > 0 && (
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Underperformed</p>
          <div className="flex flex-wrap gap-1">
            {review.underperformers.map(n => (
              <span key={n} className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/25">{n}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function SeasonResultsScreen() {
  const navigate = useNavigate()
  const { gameState } = useGameStore()
  const [tab, setTab] = useState<Tab>('table')
  const [reviewTeam, setReviewTeam] = useState<TeamId | null>(null)

  if (!gameState?.seasonResult) {
    return (
      <div className="min-h-screen bg-ipl-darker flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-3">No season results yet</p>
          <button className="text-ipl-accent text-sm underline" onClick={() => navigate('/season-setup')}>
            Run Season Simulation
          </button>
        </div>
      </div>
    )
  }

  const result = gameState.seasonResult
  const userTeam = gameState.userFranchise as TeamId
  const userResult = result.pointsTable.find(t => t.teamId === userTeam)!
  const winColors = TEAM_BADGE_COLORS[result.winner]

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'table',    label: 'Points Table', icon: '📊' },
    { id: 'awards',   label: 'Awards',       icon: '🏅' },
    { id: 'myteam',   label: 'My Review',    icon: '⭐' },
    { id: 'allteams', label: 'All Teams',    icon: '🏟' },
  ]

  return (
    <div className="min-h-screen bg-ipl-darker pb-24">
      {/* Champion hero */}
      <div className={`bg-gradient-to-b ${winColors?.from ?? 'from-ipl-dark'} ${winColors?.to ?? 'to-ipl-darker'} px-4 pb-6 safe-top`}>
        <div className="text-center mb-4">
          <p className="text-white/60 text-sm uppercase tracking-widest mb-1">IPL {result.year} Champions</p>
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-5xl">🏆</span>
            <TeamBadge teamId={result.winner} size="xl" showRing />
            <span className="text-5xl">🏆</span>
          </div>
          <p className="text-white font-black text-3xl">{result.winner}</p>
          <p className="text-white/50 text-sm mt-1">Runner-up: {result.runnerUp}</p>
        </div>

        {/* User result strip */}
        <div className={`rounded-2xl p-3 flex items-center gap-3 ${
          userResult.qualifiedForPlayoffs
            ? 'bg-green-500/20 border border-green-500/30'
            : 'bg-white/10 border border-white/10'
        }`}>
          <TeamBadge teamId={userTeam} size="sm" />
          <div className="flex-1">
            <p className="text-white font-bold text-sm">Your team — {userTeam}</p>
            <p className={`text-xs ${userResult.qualifiedForPlayoffs ? 'text-green-300' : 'text-gray-400'}`}>
              Finished #{userResult.position} · {userResult.wins}W {userResult.losses}L · {userResult.points} pts
              {userResult.qualifiedForPlayoffs ? ' · Playoff Qualified 🎯' : ''}
            </p>
          </div>
          {userTeam === result.winner && <span className="text-2xl">🏆</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-ipl-border mx-4 mt-4 gap-1 overflow-x-auto scrollbar-none">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { tap(); setTab(t.id) }}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? 'border-ipl-accent text-ipl-accent'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {/* Points Table */}
        {tab === 'table' && (
          <div className="bg-ipl-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 text-xs uppercase tracking-widest">Final Standings</p>
              <div className="flex gap-3 text-xs text-gray-600">
                <span>W/L</span>
                <span className="w-8 text-right">Pts</span>
                <span className="w-14 text-right">NRR</span>
              </div>
            </div>
            {result.pointsTable.map(r => (
              <PointsTableRow key={r.teamId} result={r} isUser={r.teamId === userTeam} />
            ))}
            <p className="text-gray-600 text-xs text-center mt-3">PO = Qualified for Playoffs</p>
          </div>
        )}

        {/* Awards */}
        {tab === 'awards' && (
          <div className="space-y-3">
            <AwardCard icon="🟠" title="Orange Cap" playerName={result.orangeCap.playerName} teamId={result.orangeCap.teamId} value={result.orangeCap.value} unit="runs" />
            <AwardCard icon="🟣" title="Purple Cap" playerName={result.purpleCap.playerName} teamId={result.purpleCap.teamId} value={result.purpleCap.value} unit="wickets" />
            <AwardCard icon="⭐" title="Most Valuable Player" playerName={result.mvp.playerName} teamId={result.mvp.teamId} value={result.mvp.value} unit="impact pts" />
            <AwardCard icon="💰" title="Best Auction Buy" playerName={result.bestAuctionBuy.playerName} teamId={result.bestAuctionBuy.teamId} value={result.bestAuctionBuy.value} unit="value/cr" />
            <AwardCard icon="💸" title="Worst Auction Buy" playerName={result.worstAuctionBuy.playerName} teamId={result.worstAuctionBuy.teamId} value={result.worstAuctionBuy.value} unit="value/cr" />
          </div>
        )}

        {/* My team review */}
        {tab === 'myteam' && (
          <div>
            <TeamReviewCard review={result.teamReviews[userTeam]!} isUser />
          </div>
        )}

        {/* All teams */}
        {tab === 'allteams' && (
          <div className="space-y-3">
            {/* Team selector */}
            <div className="grid grid-cols-5 gap-2 mb-4">
              {result.pointsTable.map(r => (
                <button
                  key={r.teamId}
                  onClick={() => setReviewTeam(r.teamId as TeamId)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                    reviewTeam === r.teamId ? 'bg-white/10 ring-2 ring-ipl-accent' : 'bg-ipl-card hover:bg-ipl-card2'
                  }`}
                >
                  <TeamBadge teamId={r.teamId} size="sm" showRing={reviewTeam === r.teamId} />
                  <span className="text-xs font-bold text-gray-500">#{r.position}</span>
                </button>
              ))}
            </div>
            {reviewTeam && result.teamReviews[reviewTeam] && (
              <TeamReviewCard review={result.teamReviews[reviewTeam]!} isUser={reviewTeam === userTeam} />
            )}
            {!reviewTeam && (
              <p className="text-gray-600 text-sm text-center py-8">Select a franchise above to see their season review</p>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 mt-4 flex gap-3">
        <button
          onClick={() => navigate('/season-setup')}
          className="flex-1 py-3 rounded-xl bg-ipl-card border border-ipl-border text-gray-300 font-semibold text-sm hover:bg-ipl-card2 transition-colors"
        >
          🔄 Replay Season
        </button>
        <button
          onClick={() => navigate('/')}
          className="flex-1 py-3 rounded-xl bg-ipl-accent text-white font-bold text-sm hover:bg-ipl-accent/90 transition-colors shadow-glow-accent"
        >
          Back to Home
        </button>
      </div>

      <BottomNav active="my-squad" />
    </div>
  )
}
