import { useEffect, useCallback, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@components/ui/Button'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { PlayerCard } from '@components/auction/PlayerCard'
import { BidTimeline } from '@components/auction/BidTimeline'
import { UserActionPanel } from '@components/auction/UserActionPanel'
import { TeamPaddles } from '@components/auction/TeamPaddles'
import { OpponentReactions } from '@components/auction/OpponentReactions'
import { LiveReactionBubble } from '@components/auction/LiveReactionBubble'
import { SaleResult } from '@components/auction/SaleResult'
import { BottomNav } from '@components/ui/BottomNav'
import { TeamBadge } from '@components/ui/TeamBadge'
import { useGameStore } from '@/store/gameStore'
import { useSessionStore } from '@/store/sessionStore'
import { loadSession } from '@/session/sessionManager'
import {
  userBid, userInterruptBid, userPass, userSkipPlayer, userExerciseRTM, userDeclineRTM,
  pickAIAcceleratedPlayers, ACCELERATED_TOTAL, USER_MAX_PICKS,
  runOneAIDecision, isBiddingOver, resolvePlayerSale,
  startPlayerAuction, advanceAuction,
} from '@/controllers/auctionController'
import { getCurrentAuctionPlayer } from '@/engine/biddingEngine'
import { getBidIncrement, getPlayersInSet, loadDataset } from '@/dataset/datasetLoader'
import { fetchAuctioneerComment, getFormContext } from '@/llm/personaLayer'
import type { AuctionDataset } from '@/types/dataset'
import type { GameState } from '@/types/game'
import type { TeamId } from '@/types/team'

const BID_TIMER_SECONDS    = 10
const BASE_AI_DELAY_MS     = 350   // scaled by speed
const BASE_CALL_MS         = 1500  // scaled by speed (was 3000)

type CallingStage = 0 | 1 | 2 | 3   // 0=none, 1=going once, 2=twice, 3=thrice→SOLD

const STAGE_TEXT = ['', 'Going once…', 'Going twice…', '🔨 SOLD!']
const STAGE_SUB  = ['', 'Any advance?', 'Last chance to bid!', '']

// ─── Mobile Owner Reactions Feed ─────────────────────────────────────────────

const TEAM_CHIP_COLORS: Record<string, string> = {
  CSK: 'text-yellow-300 bg-yellow-400/10 border-yellow-500/30',
  MI:  'text-blue-300 bg-blue-400/10 border-blue-500/30',
  RCB: 'text-red-300 bg-red-400/10 border-red-500/30',
  KKR: 'text-purple-300 bg-purple-400/10 border-purple-500/30',
  DC:  'text-sky-300 bg-sky-400/10 border-sky-500/30',
  RR:  'text-pink-300 bg-pink-400/10 border-pink-500/30',
  SRH: 'text-orange-300 bg-orange-400/10 border-orange-500/30',
  PBKS:'text-rose-300 bg-rose-400/10 border-rose-500/30',
  GT:  'text-cyan-300 bg-cyan-400/10 border-cyan-500/30',
  LSG: 'text-teal-300 bg-teal-400/10 border-teal-500/30',
}

function MobileReactionsFeed({ log }: { log: string[] }) {
  const [open, setOpen] = useState(true)

  const entries = log
    .filter(e => /^\[[A-Z]+\]/.test(e) && !e.includes('SOLD:') && !e.includes('UNSOLD:') && !e.includes('---'))
    .slice(-5)
    .reverse()

  if (entries.length === 0) return null

  return (
    <div className="rounded-2xl overflow-hidden border border-white/8 bg-black/30">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-gray-400 text-xs font-semibold uppercase tracking-widest">Owner Reactions</span>
        </div>
        <span className="text-gray-600 text-xs">{open ? '▲' : '▼'} {entries.length} recent</span>
      </button>
      {open && (
        <div className="divide-y divide-white/5">
          {entries.map((entry, i) => {
            const m = entry.match(/^\[([A-Z]+)\]\s*(.+)$/)
            if (!m) return null
            const [, teamId, comment] = m
            const chip = TEAM_CHIP_COLORS[teamId] ?? 'text-gray-300 bg-gray-500/10 border-gray-500/30'
            return (
              <div key={i} className={`flex items-start gap-3 px-4 py-3 ${i === 0 ? 'bg-white/4' : ''}`}>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0 mt-0.5 ${chip}`}>
                  {teamId}
                </span>
                <p className={`text-sm leading-snug flex-1 ${i === 0 ? 'text-gray-200' : 'text-gray-500'}`}>
                  {comment}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function AuctionRoomScreen() {
  const navigate = useNavigate()
  const { id: sessionIdParam } = useParams<{ id?: string }>()
  const { gameState, initFromSession } = useGameStore()
  const { setActiveSession } = useSessionStore()
  const [dataset, setDataset] = useState<AuctionDataset | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [resuming, setResuming] = useState(false)
  const [aiRunning, setAiRunning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(BID_TIMER_SECONDS)
  const [callingStage, setCallingStage] = useState<CallingStage>(0)

  const [menuOpen, setMenuOpen] = useState(false)
  const [quitConfirm, setQuitConfirm] = useState(false)
  const [speed, setSpeed] = useState<1 | 2 | 3>(() => (Number(localStorage.getItem('auctionSpeed')) as 1|2|3) || 1)
  const [auctioneeerLine, setAuctioneeerLine] = useState<string | null>(null)

  const aiLoopRef = useRef(false)
  const callingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasAutoPassedRef = useRef(false)
  const speedRef = useRef<1|2|3>(speed)
  const commentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    speedRef.current = speed
    localStorage.setItem('auctionSpeed', String(speed))
  }, [speed])

  const showComment = useCallback((text: string) => {
    if (commentTimerRef.current) clearTimeout(commentTimerRef.current)
    setAuctioneeerLine(text)
    commentTimerRef.current = setTimeout(() => setAuctioneeerLine(null), 6000)
  }, [])

  // ── Session resume from URL param (/session/:id) ─────────────────────────
  useEffect(() => {
    if (!sessionIdParam) return
    // If already loaded with the right session, skip
    if (gameState?.sessionId === sessionIdParam) return
    setResuming(true)
    loadSession(sessionIdParam)
      .then(session => {
        if (!session) {
          setActionError('Session not found. It may have been deleted.')
          return
        }
        initFromSession(session)
        setActiveSession(session)
      })
      .catch(e => setActionError(`Failed to load session: ${String(e)}`))
      .finally(() => setResuming(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdParam])

  // ── Dataset ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameState) return
    loadDataset(gameState.auctionYear)
      .then(setDataset)
      .catch(e => setActionError(`Failed to load dataset: ${String(e)}`))
  }, [gameState?.auctionYear])

  // ── Auto-start on set-preview ─────────────────────────────────────────────
  useEffect(() => {
    if (!dataset || !gameState) return
    if (gameState.phase === 'set-preview') {
      setCallingStage(0)
      startPlayerAuction(dataset)
    }
  }, [dataset, gameState?.phase, gameState?.currentSetIndex, gameState?.currentPlayerIndex])

  // ── Auctioneer commentary ─────────────────────────────────────────────────
  const lastPlayerIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!gameState || !dataset) return
    const player = getCurrentAuctionPlayer(gameState, dataset)
    if (!player || player.playerId === lastPlayerIdRef.current) return
    if (gameState.phase !== 'bidding') return
    lastPlayerIdRef.current = player.playerId
    void fetchAuctioneerComment('intro', player).then(c => { if (c) showComment(c) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.phase, gameState?.currentPlayerIndex, gameState?.isReauction, gameState?.reauctionIndex])

  useEffect(() => {
    if (!gameState) return
    if (gameState.phase === 'sale-confirmed') {
      const last = gameState.soldPlayers[gameState.soldPlayers.length - 1]
      if (last) void fetchAuctioneerComment('sold', last, { team: last.soldTo, price: last.soldPrice }).then(c => { if (c) showComment(c) })
    } else if (gameState.phase === 'unsold-confirmed') {
      const last = gameState.unsoldPlayers[gameState.unsoldPlayers.length - 1]
      if (last) void fetchAuctioneerComment('unsold', last).then(c => { if (c) showComment(c) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.phase])

  // ── Auctioneer calling ────────────────────────────────────────────────────
  const clearCalling = () => {
    callingTimersRef.current.forEach(clearTimeout)
    callingTimersRef.current = []
  }

  const startCalling = useCallback((ds: AuctionDataset) => {
    clearCalling()
    setCallingStage(1)
    const callMs = Math.round(BASE_CALL_MS / speedRef.current)
    const t1 = setTimeout(() => setCallingStage(2), callMs)
    const t2 = setTimeout(() => setCallingStage(3), callMs * 2)
    const t3 = setTimeout(() => {
      setCallingStage(0)
      try {
        resolvePlayerSale(ds)
      } catch {
        advanceAuction(ds)
      }
    }, callMs * 3)
    callingTimersRef.current = [t1, t2, t3]
  }, [])

  const cancelCalling = () => {
    clearCalling()
    setCallingStage(0)
  }

  // ── Bid timer ─────────────────────────────────────────────────────────────
  const bidState = gameState?.currentBidState ?? null
  const uTeam = gameState?.userFranchise as TeamId | undefined
  const userIsLeader   = !!(uTeam && bidState?.currentLeader === uTeam)
  const userHasPassed  = !!(uTeam && bidState?.teamsPassed.includes(uTeam ?? '' as TeamId))
  const userHasSkipped = !!(uTeam && (bidState?.permanentPass ?? []).includes(uTeam ?? '' as TeamId))
  const isCalling = callingStage > 0

  // User can bid the normal panel: bidding phase, not leader, not out, not calling
  const userCanBidNormal = gameState?.phase === 'bidding'
    && !userIsLeader && !userHasPassed && !userHasSkipped && !aiRunning && !isCalling

  // User can interrupt calling: calling is active, user is not permanently skipped, not leader
  const userCanInterrupt = isCalling && !userIsLeader

  useEffect(() => {
    if (!userCanBidNormal || !dataset) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      return
    }
    hasAutoPassedRef.current = false
    setTimeLeft(BID_TIMER_SECONDS)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!); timerRef.current = null
          if (!hasAutoPassedRef.current) {
            hasAutoPassedRef.current = true
            userPass()
            startAILoop(dataset)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCanBidNormal, dataset])

  // ── AI loop ───────────────────────────────────────────────────────────────
  const startAILoop = useCallback(async (ds: AuctionDataset) => {
    if (aiLoopRef.current) return
    aiLoopRef.current = true
    setAiRunning(true)

    while (true) {
      const state = useGameStore.getState().gameState
      if (!state || state.phase !== 'bidding') break

      const bs = state.currentBidState
      const ut = state.userFranchise as TeamId
      const uOut = (bs?.teamsPassed ?? []).includes(ut) || (bs?.permanentPass ?? []).includes(ut)
      const uLead = bs?.currentLeader === ut

      // Stop if user can participate
      if (!uOut && !uLead) break

      const result = await runOneAIDecision(ds)
      await new Promise(r => setTimeout(r, Math.round(BASE_AI_DELAY_MS / speedRef.current)))

      const fresh = useGameStore.getState().gameState
      if (!fresh || fresh.phase !== 'bidding') break

      if (isBiddingOver(ds) || result === 'none') {
        aiLoopRef.current = false
        setAiRunning(false)
        startCalling(ds)
        return
      }

      // Re-check after a bid resets teamsPassed — user might be able to participate again
      const fb = fresh.currentBidState
      const nowOut = (fb?.teamsPassed ?? []).includes(ut) || (fb?.permanentPass ?? []).includes(ut)
      if (!nowOut && fb?.currentLeader !== ut) break
    }

    if (isBiddingOver(ds)) {
      aiLoopRef.current = false
      setAiRunning(false)
      startCalling(ds)
      return
    }

    aiLoopRef.current = false
    setAiRunning(false)
  }, [startCalling])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleBid = useCallback((amount: number) => {
    if (!dataset) return
    cancelCalling()
    setActionError(null)
    const err = userBid(dataset, amount)
    if (err) { setActionError(err); return }
    void startAILoop(dataset)
  }, [dataset, startAILoop])

  // Used by the auctioneer calling interrupt button — clears round-pass before bidding
  const handleInterruptBid = useCallback((amount: number) => {
    if (!dataset) return
    cancelCalling()
    setActionError(null)
    const err = userInterruptBid(dataset, amount)
    if (err) { setActionError(err); return }
    void startAILoop(dataset)
  }, [dataset, startAILoop])

  const handlePassBid = useCallback(() => {
    if (!dataset) return
    const err = userPass()
    if (err) { setActionError(err); return }
    void startAILoop(dataset)
  }, [dataset, startAILoop])

  const handleSkipPlayer = useCallback(() => {
    if (!dataset) return
    userSkipPlayer()
    void startAILoop(dataset)
  }, [dataset, startAILoop])

  const handleContinue = () => advanceAuction(dataset!)

  // ── Session resuming from URL ────────────────────────────────────────────
  if (resuming) {
    return (
      <div className="min-h-screen bg-ipl-darker flex items-center justify-center">
        <LoadingSpinner label="Resuming session..." />
      </div>
    )
  }

  // ── No game state — session lost on refresh ───────────────────────────────
  if (!gameState) {
    return (
      <div className="min-h-screen bg-ipl-dark flex flex-col items-center justify-center gap-6 p-4">
        <p className="text-gray-400 text-lg">No active auction session found.</p>
        <p className="text-gray-600 text-sm">Your session may have been lost on page refresh.</p>
        <Button variant="primary" size="lg" onClick={() => navigate('/')}>Go to Home → Resume Session</Button>
      </div>
    )
  }

  // ── Dataset loading / error ────────────────────────────────────────────────
  if (!dataset) {
    if (actionError) {
      return (
        <div className="min-h-screen bg-ipl-dark flex flex-col items-center justify-center gap-4 p-4">
          <p className="text-ipl-accent text-lg font-bold">Dataset Error</p>
          <p className="text-gray-400 text-sm text-center max-w-md">{actionError}</p>
          <Button variant="secondary" size="md" onClick={() => navigate('/')}>Back to Home</Button>
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-ipl-dark flex items-center justify-center">
        <LoadingSpinner label="Loading auction room..." />
      </div>
    )
  }

  const currentPlayer = getCurrentAuctionPlayer(gameState, dataset)
  const userTeam = gameState.userFranchise as TeamId

  // ── Set complete ─────────────────────────────────────────────────────────
  if (gameState.phase === 'set-complete') {
    const completedSet = gameState.isReauction ? 'Re-auction' : (dataset.auctionSets[gameState.currentSetIndex - 1] ?? 'Previous Set')
    const nextSet = gameState.isReauction ? '' : (dataset.auctionSets[gameState.currentSetIndex] ?? '')
    const nextPlayers = nextSet ? getPlayersInSet(dataset, nextSet, gameState.releasedRetainedPlayers ?? []) : []
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
          <div className="text-6xl">✅</div>
          <div>
            <p className="text-gray-500 text-sm uppercase tracking-widest mb-1">Set Complete</p>
            <p className="text-white font-black text-2xl">{completedSet}</p>
          </div>
          {nextSet && (
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-5">
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Next Up</p>
              <p className="text-ipl-gold font-black text-xl mb-1">{nextSet}</p>
              <p className="text-gray-500 text-sm">{nextPlayers.length} players</p>
            </div>
          )}
          <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex justify-between text-sm">
            <span className="text-gray-500">{userTeam} purse</span>
            <span className="text-white font-bold">₹{gameState.teamStates[userTeam]?.currentPurse.toFixed(1)} Cr</span>
          </div>
          <Button variant="primary" size="lg" className="w-full" onClick={handleContinue}>
            {nextSet ? `Start ${nextSet} →` : 'Continue →'}
          </Button>
        </div>
      </div>
    )
  }

  // ── Auction complete ──────────────────────────────────────────────────────
  if (gameState.phase === 'auction-complete') {
    const unsoldCount = gameState.unsoldPlayers.length
    const canAccelerate = unsoldCount > 0
    return (
      <div className="min-h-screen bg-ipl-darker flex items-center justify-center p-4">
        <div className="text-center max-w-md animate-fade-in w-full">
          <div className="text-8xl mb-6 animate-bounce">🏆</div>
          <p className="text-ipl-gold text-4xl font-black mb-2">Auction Complete!</p>
          <p className="text-gray-400 mb-2">
            {gameState.soldPlayers.length} players sold · {unsoldCount} unsold
          </p>
          <p className="text-gray-500 text-sm mb-6">IPL {gameState.auctionYear}</p>

          {canAccelerate && (
            <div className="mb-6 bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 text-left">
              <p className="text-amber-400 font-black text-sm mb-1">⚡ Accelerated Auction</p>
              <p className="text-amber-200/70 text-xs leading-relaxed">
                {unsoldCount} players went unsold. Pick up to {USER_MAX_PICKS} players you want — AI teams will nominate the rest to fill {ACCELERATED_TOTAL} slots at 50% base price.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            {canAccelerate && (
              <Button variant="secondary" size="lg" onClick={() => useGameStore.getState().startAcceleratedSelection()}>
                ⚡ Start Accelerated Auction
              </Button>
            )}
            <Button variant="primary" size="lg" onClick={() => navigate('/final-squad')}>
              🏏 View Final Squads
            </Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/my-squad')}>
              My Squad
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Accelerated auction selection ─────────────────────────────────────────
  if (gameState.phase === 'accelerated-selection') {
    return (
      <AcceleratedSelectionScreen
        dataset={dataset}
        gameState={gameState}
      />
    )
  }

  // ── Sale / unsold result ──────────────────────────────────────────────────
  if (gameState.phase === 'sale-confirmed') {
    const last = gameState.soldPlayers[gameState.soldPlayers.length - 1]
    if (last) return (
      <div className="min-h-screen bg-black/95 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <SaleResult result={{ type: 'sold', record: last }} onContinue={handleContinue} />
        </div>
      </div>
    )
  }
  if (gameState.phase === 'unsold-confirmed') {
    const last = gameState.unsoldPlayers[gameState.unsoldPlayers.length - 1]
    if (last) return (
      <div className="min-h-screen bg-black/95 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <SaleResult result={{ type: 'unsold', record: last }} onContinue={handleContinue} />
        </div>
      </div>
    )
  }

  // ── RTM ───────────────────────────────────────────────────────────────────
  if (gameState.phase === 'rtm-decision' && bidState?.rtmPending === userTeam && currentPlayer) {
    const userTs = gameState.teamStates[userTeam]
    const rtmSlotsLeft = (userTs?.rtmSlotsAvailable ?? 0) - (userTs?.rtmSlotsUsed ?? 0)
    return (
      <div className="min-h-screen bg-black/95 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-ipl-card border-2 border-ipl-gold rounded-2xl p-7 flex flex-col gap-5">
          <div className="text-center">
            <p className="text-ipl-gold text-3xl font-black mb-1">RTM Available!</p>
            <p className="text-gray-400 text-sm">Right to Match — {rtmSlotsLeft} slot{rtmSlotsLeft !== 1 ? 's' : ''} remaining</p>
          </div>
          <div className="bg-ipl-dark rounded-xl p-4 text-center">
            <p className="text-white font-black text-xl">{currentPlayer.name}</p>
            <p className="text-gray-400 text-xs mt-0.5">{currentPlayer.role} · {currentPlayer.isOverseas ? 'Overseas' : 'Indian'}</p>
            <p className="text-gray-400 text-sm mt-2">
              Going to <span className="text-white font-bold">{bidState.currentLeader}</span> for{' '}
              <span className="text-ipl-accent font-black">₹{bidState.currentBid.toFixed(2)} Cr</span>
            </p>
            <p className="text-gray-500 text-xs mt-1">Exercise RTM to match this price and reclaim your player</p>
          </div>
          <div className="flex gap-3">
            <Button variant="primary" size="lg" className="flex-1" onClick={() => userExerciseRTM(dataset)}>
              Exercise RTM
            </Button>
            <Button variant="ghost" size="lg" className="flex-1" onClick={() => userDeclineRTM(dataset)}>
              Decline
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main auction room ─────────────────────────────────────────────────────
  const setName = dataset.auctionSets[gameState.currentSetIndex] ?? ''
  const playersInSet = getPlayersInSet(dataset, setName, gameState.releasedRetainedPlayers ?? [])
  const progressPct = playersInSet.length > 0
    ? Math.round((gameState.currentPlayerIndex / playersInSet.length) * 100) : 0
  const timerUrgent = timeLeft <= 3
  const timerWarning = timeLeft <= 6

  // Next bid for interrupt button
  const currentBid = bidState?.currentBid ?? 0
  const interruptBid = currentPlayer
    ? (currentBid === 0 ? currentPlayer.basePrice : currentBid + getBidIncrement(dataset, currentBid))
    : 0

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col pb-16 lg:pb-0">

      {/* ── Auctioneer calling overlay ─────────────────────────────────────── */}
      {isCalling && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
             style={{ background: 'rgba(0,0,0,0.88)' }}>
          {/* Gavel animation area */}
          <div className="mb-8 text-center">
            <div className={`text-7xl mb-4 transition-all duration-500 ${callingStage === 3 ? 'scale-125' : 'scale-100'}`}>
              🔨
            </div>
            <p className={`font-black tracking-widest transition-all duration-300 ${
              callingStage === 3 ? 'text-5xl text-ipl-gold' :
              callingStage === 2 ? 'text-4xl text-yellow-300' :
              'text-3xl text-white'
            }`}>
              {STAGE_TEXT[callingStage]}
            </p>
            {STAGE_SUB[callingStage] && (
              <p className="text-gray-400 text-lg mt-2">{STAGE_SUB[callingStage]}</p>
            )}
          </div>

          {/* Current price */}
          {currentPlayer && bidState?.currentLeader && (
            <div className="bg-white/5 border border-white/10 rounded-2xl px-10 py-5 text-center mb-8">
              <p className="text-gray-400 text-sm mb-1">{currentPlayer.name}</p>
              <p className="text-white font-black text-4xl">₹{bidState.currentBid.toFixed(2)} Cr</p>
              <p className="text-gray-400 text-sm mt-2">
                to <span className="text-white font-bold">{bidState.currentLeader}</span>
              </p>
            </div>
          )}

          {/* Stage dots */}
          <div className="flex gap-3 mb-8">
            {[1, 2, 3].map(s => (
              <div key={s} className={`w-3 h-3 rounded-full transition-all duration-300 ${
                callingStage >= s ? 'bg-ipl-gold scale-125' : 'bg-gray-700'
              }`} />
            ))}
          </div>

          {/* Interrupt button — shown during going-once and going-twice only */}
          {userCanInterrupt && callingStage < 3 && currentPlayer && (
            <div className="text-center">
              <button
                onClick={() => handleInterruptBid(interruptBid)}
                className="bg-ipl-accent hover:bg-ipl-accent/90 text-white font-black text-xl px-10 py-5 rounded-2xl shadow-2xl shadow-ipl-accent/30 active:scale-95 transition-all animate-pulse"
              >
                ✋ BID ₹{interruptBid.toFixed(2)} Cr
              </button>
              <p className="text-gray-500 text-xs mt-3">Raise your paddle to interrupt the auctioneer</p>
            </div>
          )}

          {userIsLeader && (
            <div className="text-center">
              <p className="text-ipl-gold font-bold text-xl">
                {callingStage < 3 ? '🏏 You have the highest bid!' : '🎉 Player is yours!'}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {callingStage < 3
                  ? 'No challengers — hammer is falling...'
                  : `${currentPlayer?.name} sold to you for ₹${bidState?.currentBid?.toFixed(2)} Cr`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Menu overlay ────────────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70" onClick={() => setMenuOpen(false)} />
          {/* Drawer */}
          <div className="relative ml-auto w-72 h-full bg-[#111118] border-l border-white/10 flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-white font-bold">Menu</span>
              <button onClick={() => setMenuOpen(false)} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
            </div>

            {/* Session info */}
            <div className="px-5 py-4 border-b border-white/10">
              <p className="text-ipl-gold font-black text-sm">IPL {gameState.auctionYear} Auction</p>
              <p className="text-gray-500 text-xs mt-1">{setName} · Set {gameState.currentSetIndex + 1}/{dataset.auctionSets.length}</p>
              <p className="text-gray-600 text-xs mt-0.5">{gameState.soldPlayers.length} sold · {gameState.unsoldPlayers.length} unsold</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {userTeam} — ₹{gameState.teamStates[userTeam]?.currentPurse.toFixed(1)} Cr · {gameState.teamStates[userTeam]?.squad.length} players
              </p>
            </div>

            {/* Nav links */}
            <nav className="flex flex-col py-2">
              {[
                { label: 'My Squad', path: '/my-squad', sub: `${gameState.teamStates[userTeam]?.squad.length ?? 0} players` },
                { label: 'All Squads', path: '/all-squads', sub: 'View every team' },
                { label: 'Auction History', path: '/auction-history', sub: 'Bids & sales log' },
                { label: 'Unsold Players', path: '/unsold-players', sub: `${gameState.unsoldPlayers.length} players` },
              ].map(item => (
                <button
                  key={item.path}
                  onClick={() => { setMenuOpen(false); navigate(item.path) }}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors text-left"
                >
                  <span className="text-white text-sm font-medium">{item.label}</span>
                  <span className="text-gray-600 text-xs">{item.sub}</span>
                </button>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-0 border-t border-white/10">
              <button
                onClick={() => { setMenuOpen(false); navigate('/') }}
                className="px-5 py-4 text-left text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors"
              >
                ← Home <span className="text-gray-700 text-xs ml-2">Session saved</span>
              </button>
              <button
                onClick={() => { setMenuOpen(false); setQuitConfirm(true) }}
                className="px-5 py-4 text-left text-red-500 hover:text-red-400 hover:bg-red-950/30 text-sm font-medium transition-colors border-t border-white/5"
              >
                Quit Auction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quit confirmation dialog ─────────────────────────────────────────── */}
      {quitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm bg-[#111118] border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
            <div>
              <p className="text-white font-black text-xl">Quit auction?</p>
              <p className="text-gray-400 text-sm mt-2">
                Your progress is saved. You can resume from the Home screen any time.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setQuitConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 text-sm font-medium transition-colors"
              >
                Keep Playing
              </button>
              <button
                onClick={() => { setQuitConfirm(false); navigate('/') }}
                className="flex-1 py-3 rounded-xl bg-red-900/60 border border-red-700/50 text-red-300 hover:bg-red-900/80 text-sm font-medium transition-colors"
              >
                Quit &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-white/10 bg-black/60 backdrop-blur-sm px-3 py-2.5 flex items-center justify-between flex-shrink-0 z-10 safe-top">
        <div className="flex items-center gap-2 min-w-0">
          <TeamBadge teamId={userTeam} size="sm" />
          <div className="min-w-0">
            <p className="text-white font-bold text-xs leading-tight truncate">
              {gameState.isReauction ? '🔄 Re-auction' : setName}
            </p>
            <p className="text-gray-600 text-[10px] leading-tight">
              {gameState.isReauction
                ? `${gameState.reauctionIndex + 1}/${gameState.reauctionPool.length} · 50% base`
                : `Set ${gameState.currentSetIndex + 1}/${dataset.auctionSets.length} · ${gameState.soldPlayers.length} sold`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Speed control */}
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {([1, 2, 3] as const).map(s => (
              <button key={s} onClick={() => setSpeed(s)}
                className={`px-2 py-1 text-[10px] font-black transition-colors ${
                  speed === s ? 'bg-ipl-accent text-white' : 'bg-white/5 text-gray-600 hover:text-gray-300'
                }`}
              >{s}×</button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1.5">
            <span className="text-ipl-gold text-xs font-bold">₹{gameState.teamStates[userTeam]?.currentPurse.toFixed(1)}Cr</span>
          </div>
          {/* Quick squad access */}
          <button
            onClick={() => navigate('/my-squad')}
            className="flex flex-col items-center justify-center w-9 h-9 rounded-lg bg-ipl-accent/15 border border-ipl-accent/30 hover:bg-ipl-accent/25 active:scale-95 transition-all flex-shrink-0"
            title="My Squad"
          >
            <span className="text-sm leading-none">⭐</span>
            <span className="text-[8px] text-ipl-accent font-bold leading-none mt-0.5">Mine</span>
          </button>
          <button
            onClick={() => navigate('/all-squads')}
            className="flex flex-col items-center justify-center w-9 h-9 rounded-lg bg-white/8 border border-white/12 hover:bg-white/15 active:scale-95 transition-all flex-shrink-0"
            title="All Squads"
          >
            <span className="text-sm leading-none">🏟</span>
            <span className="text-[8px] text-gray-400 font-bold leading-none mt-0.5">All</span>
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col gap-1 justify-center items-center w-9 h-9 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
            title="Menu"
          >
            <span className="w-4 h-0.5 bg-gray-400 rounded" />
            <span className="w-4 h-0.5 bg-gray-400 rounded" />
            <span className="w-4 h-0.5 bg-gray-400 rounded" />
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-0.5 bg-white/5 flex-shrink-0">
        <div className="h-full bg-ipl-accent/70 transition-all duration-700" style={{ width: `${progressPct}%` }} />
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-0 overflow-hidden">

        {/* LEFT: Player + bid history + action */}
        <div className="lg:col-span-3 flex flex-col gap-0 border-r border-white/5 overflow-y-auto">
          <div className="p-3 sm:p-4 flex flex-col gap-3 sm:gap-4">

            {/* Mobile-only team paddles strip */}
            <div className="lg:hidden">
              <TeamPaddles
                teamStates={gameState.teamStates}
                bidState={bidState}
                userTeam={userTeam}
              />
            </div>

            {/* Live reaction bubble — mobile only, purely visual, never blocks taps */}
            <div className="lg:hidden fixed top-16 left-3 right-3 z-30 pointer-events-none">
              <LiveReactionBubble log={gameState.auctionLog ?? []} />
            </div>
            {/* Auctioneer commentary banner */}
            {auctioneeerLine && (
              <div className="flex items-start gap-2.5 bg-ipl-gold/10 border border-ipl-gold/25 rounded-2xl px-4 py-3 animate-slide-up">
                <span className="text-lg shrink-0">🎙️</span>
                <p className="text-ipl-gold text-sm font-semibold leading-snug italic">"{auctioneeerLine}"</p>
              </div>
            )}

            {/* Player spotlight */}
            {currentPlayer ? (
              <PlayerCard
                player={currentPlayer}
                currentBid={bidState?.currentBid}
                currentLeader={bidState?.currentLeader}
                formContext={getFormContext(currentPlayer.playerId)}
              />
            ) : (
              <div className="bg-white/5 rounded-2xl flex items-center justify-center py-16">
                <p className="text-gray-700">Preparing player...</p>
              </div>
            )}

            {/* Timer strip — only when user's turn */}
            {userCanBidNormal && (
              <div className={`relative overflow-hidden flex items-center gap-4 rounded-2xl px-5 py-4 border transition-all ${
                timerUrgent
                  ? 'bg-red-950/70 border-red-600/60 shadow-lg shadow-red-900/40'
                  : timerWarning
                  ? 'bg-yellow-950/50 border-yellow-700/50 shadow-md shadow-yellow-900/20'
                  : 'bg-ipl-card border-ipl-accent/25'
              }`}>
                {timerUrgent && (
                  <div className="absolute inset-0 bg-red-600/5 animate-pulse pointer-events-none" />
                )}
                <div className="relative w-12 h-12 flex-shrink-0">
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="#1f2937" strokeWidth="3.5" />
                    <circle cx="24" cy="24" r="20" fill="none"
                      stroke={timerUrgent ? '#ef4444' : timerWarning ? '#eab308' : '#e8c96d'}
                      strokeWidth="3.5"
                      strokeDasharray={`${2 * Math.PI * 20}`}
                      strokeDashoffset={`${2 * Math.PI * 20 * (1 - timeLeft / BID_TIMER_SECONDS)}`}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1s linear' }}
                    />
                  </svg>
                  <span className={`absolute inset-0 flex items-center justify-center font-black text-sm ${
                    timerUrgent ? 'text-red-400' : timerWarning ? 'text-yellow-400' : 'text-ipl-gold'
                  }`}>{timeLeft}</span>
                </div>
                <div className="relative flex-1">
                  <p className={`font-black text-base leading-tight ${
                    timerUrgent ? 'text-red-300' : timerWarning ? 'text-yellow-300' : 'text-white'
                  }`}>
                    {timerUrgent ? '⚡ Bid NOW or you auto-pass!' : '🏏 Your turn — place a bid'}
                  </p>
                  <p className={`text-xs mt-0.5 ${timerUrgent ? 'text-red-500' : 'text-gray-600'}`}>
                    {timeLeft}s remaining
                  </p>
                </div>
              </div>
            )}

            {/* Watching states */}
            {gameState.phase === 'bidding' && !userCanBidNormal && !userIsLeader && !isCalling && (
              <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                userHasSkipped
                  ? 'bg-gray-900/30 border-gray-800/60'
                  : 'bg-white/4 border-white/8'
              }`}>
                <span className="text-xl">{userHasSkipped ? '👁' : '🤫'}</span>
                <p className={`text-sm ${userHasSkipped ? 'text-gray-700' : 'text-gray-500'}`}>
                  {userHasSkipped
                    ? 'You skipped — watching the room'
                    : 'You passed this round — watching teams battle'}
                </p>
              </div>
            )}

            {userIsLeader && gameState.phase === 'bidding' && (
              <div className="relative overflow-hidden flex items-center gap-3 rounded-2xl border bg-ipl-accent/10 border-ipl-accent/35 px-5 py-3.5">
                <div className="absolute inset-0 bg-gradient-to-r from-ipl-accent/5 to-transparent pointer-events-none" />
                <span className="text-2xl relative">🏆</span>
                <div className="relative">
                  <p className="text-ipl-accent font-black text-sm">You hold the highest bid</p>
                  <p className="text-ipl-accent/50 text-xs mt-0.5">Waiting for challengers…</p>
                </div>
              </div>
            )}

            {/* AI thinking */}
            {aiRunning && (
              <div className="flex items-center gap-3 bg-black/30 border border-white/8 rounded-2xl px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  {[0, 120, 240].map(d => (
                    <span key={d} className="w-2 h-2 rounded-full bg-ipl-accent/70 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
                <span className="text-gray-500 text-sm">Franchise owners deliberating…</span>
              </div>
            )}

            {actionError && (
              <div className="bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{actionError}</p>
              </div>
            )}

            {/* Action panel */}
            {gameState.phase === 'bidding' && currentPlayer && !userHasPassed && !userHasSkipped && !userIsLeader && (
              <UserActionPanel
                state={gameState}
                dataset={dataset}
                currentPlayer={currentPlayer}
                onBid={handleBid}
                onPassBid={handlePassBid}
                onSkipPlayer={handleSkipPlayer}
                disabled={aiRunning && !isCalling}
              />
            )}

            {/* Bid history */}
            {bidState && bidState.bids.length > 0 && (
              <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
                <h3 className="text-gray-600 text-xs uppercase tracking-widest mb-3">
                  Bid History · {bidState.bids.length} bid{bidState.bids.length !== 1 ? 's' : ''}
                </h3>
                <BidTimeline bids={bidState.bids} />
              </div>
            )}

            {/* Owner Reactions feed — mobile only persistent panel */}
            <div className="lg:hidden">
              <MobileReactionsFeed log={gameState.auctionLog ?? []} />
            </div>
          </div>
        </div>

        {/* RIGHT: Team paddles + room feed (desktop only) */}
        <div className="hidden lg:flex lg:col-span-2 flex-col overflow-y-auto">
          {/* Team paddles */}
          <div className="p-4 border-b border-white/5">
            <h3 className="text-gray-600 text-xs uppercase tracking-widest mb-3">Team Paddles</h3>
            <TeamPaddles
              teamStates={gameState.teamStates}
              bidState={bidState}
              userTeam={userTeam}
            />
          </div>

          {/* Auction room log */}
          <div className="p-4 flex-1">
            <h3 className="text-gray-600 text-xs uppercase tracking-widest mb-3">Auction Room</h3>
            <OpponentReactions log={gameState.auctionLog ?? []} />
          </div>
        </div>
      </div>

      {/* Bottom nav — mobile only */}
      {!isCalling && <BottomNav active="auction" />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Accelerated Auction Selection Screen
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_LABEL_MAP: Record<string, string> = { BAT: 'Bat', BWL: 'Bowl', AR: 'A/R', WK: 'WK' }
const ROLE_COLOR_MAP: Record<string, string> = {
  BAT: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  BWL: 'bg-red-500/20 text-red-300 border-red-500/30',
  AR:  'bg-green-500/20 text-green-300 border-green-500/30',
  WK:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
}

function AcceleratedSelectionScreen({
  dataset,
  gameState,
}: {
  dataset: AuctionDataset
  gameState: GameState
}) {
  const [userPicks, setUserPicks] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'ALL' | 'BAT' | 'BWL' | 'AR' | 'WK'>('ALL')
  const [search, setSearch] = useState('')
  const [confirming, setConfirming] = useState(false)
  const { startReauction } = useGameStore()

  const unsold = gameState.unsoldPlayers
  const filtered = unsold
    .filter(p => filter === 'ALL' || p.role === filter)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.basePrice - a.basePrice)

  const byRole = {
    BAT: unsold.filter(p => p.role === 'BAT').length,
    BWL: unsold.filter(p => p.role === 'BWL').length,
    AR:  unsold.filter(p => p.role === 'AR').length,
    WK:  unsold.filter(p => p.role === 'WK').length,
  }

  const togglePick = (playerId: string) => {
    setUserPicks(prev => {
      const next = new Set(prev)
      if (next.has(playerId)) {
        next.delete(playerId)
      } else if (next.size < USER_MAX_PICKS) {
        next.add(playerId)
      }
      return next
    })
  }

  const handleConfirm = () => {
    setConfirming(true)
    const userPickIds = [...userPicks]
    const aiPickIds = pickAIAcceleratedPlayers(dataset, userPickIds)
    const allPickIds = new Set([...userPickIds, ...aiPickIds])

    const pool = unsold
      .filter(p => allPickIds.has(p.playerId))
      .map(p => ({ ...p }))

    startReauction(pool)
  }

  const aiSlots = ACCELERATED_TOTAL - userPicks.size
  const totalPool = Math.min(ACCELERATED_TOTAL, unsold.length)

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col pb-4">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/60 px-4 py-3 flex items-center gap-3 flex-shrink-0 safe-top">
        <div className="flex-1">
          <p className="text-ipl-gold font-black text-base">⚡ Accelerated Auction</p>
          <p className="text-gray-500 text-xs">Pick your nominees · AI fills the rest</p>
        </div>
        <div className="text-right">
          <p className="text-white font-black text-lg">{userPicks.size}<span className="text-gray-500 font-normal text-sm">/{USER_MAX_PICKS}</span></p>
          <p className="text-gray-500 text-xs">your picks</p>
        </div>
      </header>

      {/* Pool summary */}
      <div className="px-4 pt-3 pb-2">
        <div className="bg-ipl-card border border-ipl-border rounded-xl p-3 flex items-center justify-between">
          <div className="text-center flex-1">
            <p className="text-white font-black text-xl">{unsold.length}</p>
            <p className="text-gray-500 text-xs">Total unsold</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center flex-1">
            <p className="text-ipl-gold font-black text-xl">{userPicks.size}</p>
            <p className="text-gray-500 text-xs">Your picks</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center flex-1">
            <p className="text-blue-300 font-black text-xl">{Math.min(aiSlots, Math.max(0, unsold.length - userPicks.size))}</p>
            <p className="text-gray-500 text-xs">AI picks</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center flex-1">
            <p className="text-green-300 font-black text-xl">{totalPool}</p>
            <p className="text-gray-500 text-xs">Will auction</p>
          </div>
        </div>
      </div>

      {/* Role filter */}
      <div className="px-4 pb-2 grid grid-cols-4 gap-1.5">
        {(['BAT', 'BWL', 'AR', 'WK'] as const).map(role => (
          <button
            key={role}
            onClick={() => setFilter(filter === role ? 'ALL' : role)}
            className={[
              'rounded-lg py-1.5 text-center border text-xs font-bold transition-all',
              filter === role ? ROLE_COLOR_MAP[role] : 'bg-ipl-card border-ipl-border text-gray-500',
            ].join(' ')}
          >
            {ROLE_LABEL_MAP[role]} {byRole[role]}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search player..."
          className="w-full bg-ipl-card border border-ipl-border rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-ipl-accent"
        />
      </div>

      {userPicks.size >= USER_MAX_PICKS && (
        <div className="mx-4 mb-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          <p className="text-amber-300 text-xs font-semibold text-center">Max {USER_MAX_PICKS} picks reached — deselect one to change</p>
        </div>
      )}

      {/* Player list */}
      <div className="flex-1 px-4 flex flex-col gap-2 overflow-y-auto">
        {filtered.map(p => {
          const picked = userPicks.has(p.playerId)
          const disabled = !picked && userPicks.size >= USER_MAX_PICKS
          return (
            <button
              key={p.playerId}
              onClick={() => togglePick(p.playerId)}
              disabled={disabled}
              className={[
                'w-full rounded-xl px-4 py-3 flex items-center gap-3 border transition-all text-left',
                picked
                  ? 'bg-ipl-gold/10 border-ipl-gold'
                  : disabled
                    ? 'bg-ipl-card/40 border-ipl-border opacity-40'
                    : 'bg-ipl-card border-ipl-border active:bg-white/5',
              ].join(' ')}
            >
              <span className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black border ${ROLE_COLOR_MAP[p.role]}`}>
                {ROLE_LABEL_MAP[p.role]}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm truncate ${picked ? 'text-ipl-gold' : 'text-white'}`}>{p.name}</p>
                <p className="text-gray-500 text-xs">{p.country} · {p.cappedStatus === 'uncapped' ? 'Uncapped' : 'Capped'}{p.isOverseas ? ' · 🌍' : ''}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-gray-400 text-xs">Base</p>
                <p className="text-gray-300 text-xs font-bold">₹{p.basePrice.toFixed(2)}</p>
                <p className="text-green-400 text-xs">→ ₹{Math.max(0.2, Math.round(p.basePrice * 0.5 * 4) / 4).toFixed(2)}</p>
              </div>
              <div className="shrink-0 w-7 flex items-center justify-center">
                {picked
                  ? <span className="text-ipl-gold text-lg font-black">✓</span>
                  : <span className="w-5 h-5 rounded-full border-2 border-gray-600 block" />
                }
              </div>
            </button>
          )
        })}
      </div>

      {/* Confirm button */}
      <div className="px-4 pt-3 pb-2">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleConfirm}
          disabled={confirming}
        >
          {confirming
            ? 'Preparing auction...'
            : `⚡ Begin Accelerated Auction (${totalPool} players)`
          }
        </Button>
        <p className="text-center text-gray-600 text-xs mt-2">
          Your {userPicks.size} pick{userPicks.size !== 1 ? 's' : ''} + AI {Math.min(aiSlots, Math.max(0, unsold.length - userPicks.size))} picks · all at 50% base price
        </p>
      </div>
    </div>
  )
}
