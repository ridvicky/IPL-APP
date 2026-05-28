import { useEffect, useCallback, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { tap, action, confirm, success, warning } from '@/utils/haptics'
import { Button } from '@components/ui/Button'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { PlayerCard } from '@components/auction/PlayerCard'
import { BidTimeline } from '@components/auction/BidTimeline'
import { UserActionPanel } from '@components/auction/UserActionPanel'
import { TeamPaddles } from '@components/auction/TeamPaddles'
import { OpponentReactions } from '@components/auction/OpponentReactions'
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
  simulateRemainingSet, simulateOneSet, simulateRemainingAuction,
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

// Owner thought lines — formula-based per-team voice, no LLM needed for inline display
const OWNER_NAMES: Record<string, string> = {
  CSK: 'Fleming (CSK)', MI: 'Jayawardene (MI)', RCB: 'Kohli / Flower (RCB)',
  KKR: 'Pandit (KKR)', DC: 'Ponting (DC)', RR: 'Sangakkara (RR)',
  SRH: 'Vettori (SRH)', PBKS: 'Zinta (PBKS)', GT: 'Nehra (GT)', LSG: 'Langer (LSG)',
}

const OWNER_BID_LINES: Record<string, string[]> = {
  CSK:  ['We know what we need from this player.', 'He fits the CSK system — calm heads win.', 'Experience you can count on. Worth every rupee.'],
  MI:   ['This is exactly the profile we targeted.', 'Impact player — the Paltan needs him.', 'MI goes big when it matters. This is that moment.'],
  RCB:  ['RCB needs a batter of this calibre. We\'re going for it.', 'Ee sala cup namde — he\'s part of the plan.', 'Virat would love playing alongside him.'],
  KKR:  ['That\'s the all-round profile Kolkata wins with.', 'KKR has found their guy. The data said so.', 'Mystery and power — KKR\'s identity right there.'],
  DC:   ['Consistent, reliable — exactly what Delhi needs.', 'He fills our gap perfectly. Calculated bid.', 'Delhi\'s building for the future. He fits.'],
  RR:   ['Exceptional value at this price — RR\'s kind of buy.', 'The numbers said bid. We bid.', 'Undervalued by the market. Not by us.'],
  SRH:  ['He attacks from ball one — that\'s SRH cricket.', 'Sunrisers need that aggression at the top.', 'Kavya wants this player. So do we.'],
  PBKS: ['Punjab NEEDS this match-winner!', 'Go on — don\'t let them take him!', 'This is the player that changes everything for us.'],
  GT:   ['Does he make us better as a unit? Yes. We bid.', 'Squad balance, not star power. He fits GT.', 'Methodical choice — Nehra\'s already mapped the role.'],
  LSG:  ['Proven performer — LSG doesn\'t gamble.', 'We\'ve tracked him all season. This is our bid.', 'Goenka wants consistency. This player delivers it.'],
}

function getOwnerThought(teamId: string, _bid: number, _state: GameState): string | null {
  const lines = OWNER_BID_LINES[teamId]
  if (!lines) return null
  return lines[Math.floor(Math.random() * lines.length)]
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
  const [paused, setPaused] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [simProgress, setSimProgress] = useState(0)
  const [ownerThought, setOwnerThought] = useState<{ teamId: TeamId; comment: string; ts: number } | null>(null)
  const ownerThoughtTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const aiLoopRef = useRef(false)
  const simStopRef = useRef(false)
  const callingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasAutoPassedRef = useRef(false)
  const speedRef = useRef<1|2|3>(speed)
  const commentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    speedRef.current = speed
    localStorage.setItem('auctionSpeed', String(speed))
  }, [speed])

  useEffect(() => { pausedRef.current = paused }, [paused])

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

  // ── Save on app backgrounding (covers Android abrupt kill) ───────────────
  useEffect(() => {
    const save = () => { void useGameStore.getState().saveNow() }
    document.addEventListener('visibilitychange', save)
    window.addEventListener('beforeunload', save)
    return () => {
      document.removeEventListener('visibilitychange', save)
      window.removeEventListener('beforeunload', save)
    }
  }, [])

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

  // ── Owner thought bubble — fires on notable AI bids ──────────────────────
  const lastBidLeaderRef = useRef<string | null>(null)
  useEffect(() => {
    if (!gameState || gameState.phase !== 'bidding') return
    const bs = gameState.currentBidState
    if (!bs || !bs.currentLeader) return
    const leader = bs.currentLeader as TeamId
    const bid = bs.currentBid
    // Only trigger for AI teams (not the user) on meaningful bids
    if (leader === gameState.userFranchise) { lastBidLeaderRef.current = leader; return }
    // Avoid re-triggering for the same leader at the same price
    const key = `${leader}-${bid}`
    if (lastBidLeaderRef.current === key) return
    lastBidLeaderRef.current = key
    // Only show for bids ≥ ₹5 Cr — otherwise too noisy
    if (bid < 5) return
    const thought = getOwnerThought(leader, bid, gameState)
    if (!thought) return
    if (ownerThoughtTimerRef.current) clearTimeout(ownerThoughtTimerRef.current)
    setOwnerThought({ teamId: leader, comment: thought, ts: Date.now() })
    ownerThoughtTimerRef.current = setTimeout(() => setOwnerThought(null), 5000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.currentBidState?.currentLeader, gameState?.currentBidState?.currentBid])

  // ── Auctioneer calling ────────────────────────────────────────────────────
  const clearCalling = () => {
    callingTimersRef.current.forEach(clearTimeout)
    callingTimersRef.current = []
  }

  const startCalling = useCallback((ds: AuctionDataset) => {
    clearCalling()
    if (pausedRef.current) return   // don't start calling while paused
    setCallingStage(1); tap()
    const callMs = Math.round(BASE_CALL_MS / speedRef.current)
    const t1 = setTimeout(() => { setCallingStage(2); tap() }, callMs)
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

  const togglePause = useCallback(() => {
    setPaused(prev => {
      const next = !prev
      pausedRef.current = next
      if (next) {
        // Pausing: freeze calling countdown
        clearCalling()
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      }
      return next
    })
  }, [])

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
    if (!userCanBidNormal || !dataset || paused) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      return
    }
    hasAutoPassedRef.current = false
    setTimeLeft(BID_TIMER_SECONDS)
    timerRef.current = setInterval(() => {
      if (pausedRef.current) return
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
  }, [userCanBidNormal, dataset, paused])

  // ── AI loop ───────────────────────────────────────────────────────────────
  const startAILoop = useCallback(async (ds: AuctionDataset) => {
    if (aiLoopRef.current) return
    aiLoopRef.current = true
    setAiRunning(true)

    while (true) {
      // Pause: wait in small increments until resumed
      while (pausedRef.current) {
        await new Promise(r => setTimeout(r, 100))
      }

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
    success()
    void startAILoop(dataset)
  }, [dataset, startAILoop])

  const handlePassBid = useCallback(() => {
    if (!dataset) return
    cancelCalling()
    const err = userPass()
    if (err) { setActionError(err); return }
    void startAILoop(dataset)
  }, [dataset, startAILoop])

  const handleSkipPlayer = useCallback(() => {
    if (!dataset) return
    cancelCalling()
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
          <Button variant="primary" size="lg" className="w-full" onClick={() => { action(); handleContinue() }}>
            {nextSet ? `Start ${nextSet} →` : 'Continue →'}
          </Button>
          {nextSet && dataset && (
            <button
              onClick={() => {
                action()
                setSimulating(true)
                setSimProgress(0)
                simStopRef.current = false
                void simulateOneSet(dataset, p => setSimProgress(p), () => simStopRef.current).then(() => setSimulating(false))
              }}
              className="w-full py-3 text-sm font-black text-orange-300 bg-orange-500/10 border border-orange-500/25 rounded-2xl hover:bg-orange-500/20 transition-colors"
            >
              ⏭ Simulate {nextSet} (AI buys players)
            </button>
          )}
          {dataset && (
            <button
              onClick={() => {
                confirm()
                setSimulating(true)
                setSimProgress(0)
                simStopRef.current = false
                void simulateRemainingAuction(dataset, p => setSimProgress(p), () => simStopRef.current).then(() => setSimulating(false))
              }}
              className="w-full py-3 text-sm font-black text-purple-300 bg-purple-500/10 border border-purple-500/25 rounded-2xl hover:bg-purple-500/20 transition-colors"
            >
              ⚡ Simulate Rest of Auction
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Auction complete ──────────────────────────────────────────────────────
  if (gameState.phase === 'auction-complete') {
    const unsoldCount = gameState.unsoldPlayers.length
    const roundsDone = gameState.acceleratedRoundsCompleted ?? 0
    const canAccelerate = unsoldCount > 0 && roundsDone < 2

    // After 2 accelerated rounds, skip straight to final squad review
    if (roundsDone >= 2) {
      return (
        <div className="min-h-screen bg-ipl-darker flex items-center justify-center p-4">
          <div className="text-center max-w-md animate-fade-in w-full">
            <div className="text-8xl mb-6">🏆</div>
            <p className="text-ipl-gold text-4xl font-black mb-2">Auction Complete!</p>
            <p className="text-gray-400 mb-2">{gameState.soldPlayers.length} players sold</p>
            <p className="text-gray-500 text-sm mb-8">GPL {gameState.auctionYear} · All rounds done</p>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <Button variant="primary" size="lg" onClick={() => navigate('/final-squad')}>
                🏏 View Squad Reports
              </Button>
              <Button variant="secondary" size="lg" onClick={() => navigate('/my-squad')}>
                My Squad
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-ipl-darker flex items-center justify-center p-4">
        <div className="text-center max-w-md animate-fade-in w-full">
          <div className="text-8xl mb-6 animate-bounce">🏆</div>
          <p className="text-ipl-gold text-4xl font-black mb-2">Auction Complete!</p>
          <p className="text-gray-400 mb-2">
            {gameState.soldPlayers.length} players sold · {unsoldCount} unsold
          </p>
          <p className="text-gray-500 text-sm mb-6">GPL {gameState.auctionYear}</p>

          {canAccelerate && (
            <div className="mb-6 bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 text-left">
              <p className="text-amber-400 font-black text-sm mb-1">⚡ Accelerated Auction — Round {roundsDone + 1} of 2</p>
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
            <Button variant="primary" size="lg" className="flex-1" onClick={() => { confirm(); userExerciseRTM(dataset) }}>
              Exercise RTM
            </Button>
            <Button variant="ghost" size="lg" className="flex-1" onClick={() => { action(); userDeclineRTM(dataset) }}>
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

  // Squad composition strip for header
  const userSquad = gameState.teamStates[userTeam]?.squad ?? []
  const squadComp = { BAT: 0, BWL: 0, AR: 0, WK: 0 }
  for (const p of userSquad) squadComp[p.role] = (squadComp[p.role] ?? 0) + 1


  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col pb-16 lg:pb-0">

      {/* ── Paused overlay ────────────────────────────────────────────────── */}
      {paused && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center pointer-events-none"
             style={{ background: 'rgba(0,0,0,0.65)' }}>
          <div className="pointer-events-auto text-center">
            <div className="text-6xl mb-4">⏸</div>
            <p className="text-white font-black text-3xl mb-2">Paused</p>
            <p className="text-gray-400 text-sm mb-6">Auction is frozen — AI bids and timer are stopped</p>
            <button
              onClick={() => { action(); togglePause() }}
              className="flex items-center gap-3 px-10 py-4 bg-ipl-gold text-black font-black text-lg rounded-2xl hover:bg-yellow-400 active:scale-95 transition-all shadow-lg shadow-ipl-gold/30"
            >
              <svg width="18" height="18" viewBox="0 0 14 14" fill="currentColor">
                <polygon points="3,1 13,7 3,13" />
              </svg>
              Resume
            </button>
          </div>
        </div>
      )}

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
                onClick={() => { handleInterruptBid(interruptBid) }}
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
          <div className="absolute inset-0 bg-black/70" onClick={() => { tap(); setMenuOpen(false) }} />
          {/* Drawer */}
          <div className="relative ml-auto w-72 h-full bg-[#111118] border-l border-white/10 flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-white font-bold">Menu</span>
              <button onClick={() => { tap(); setMenuOpen(false) }} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
            </div>

            {/* Session info */}
            <div className="px-5 py-4 border-b border-white/10">
              <p className="text-ipl-gold font-black text-sm">GPL {gameState.auctionYear} Auction</p>
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
                  onClick={() => { tap(); setMenuOpen(false); navigate(item.path) }}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors text-left"
                >
                  <span className="text-white text-sm font-medium">{item.label}</span>
                  <span className="text-gray-600 text-xs">{item.sub}</span>
                </button>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-0 border-t border-white/10">
              <button
                onClick={() => { tap(); setMenuOpen(false); navigate('/') }}
                className="px-5 py-4 text-left text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors"
              >
                ← Home <span className="text-gray-500 text-xs ml-2">Session saved</span>
              </button>
              <button
                onClick={() => { action(); setMenuOpen(false); setQuitConfirm(true) }}
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
                onClick={() => { tap(); setQuitConfirm(false) }}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 text-sm font-medium transition-colors"
              >
                Keep Playing
              </button>
              <button
                onClick={() => { warning(); setQuitConfirm(false); navigate('/') }}
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
            <p className="text-gray-400 text-[10px] leading-tight">
              {gameState.isReauction
                ? `${gameState.reauctionIndex + 1}/${gameState.reauctionPool.length} · 50% base`
                : `Set ${gameState.currentSetIndex + 1}/${dataset.auctionSets.length} · Player ${gameState.currentPlayerIndex + 1}/${playersInSet.length}`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Pause / Resume */}
          <button
            onClick={() => { action(); togglePause() }}
            className={`flex items-center justify-center w-9 h-9 rounded-lg border-2 transition-all active:scale-95 flex-shrink-0 ${
              paused
                ? 'bg-ipl-gold border-ipl-gold text-black shadow-md shadow-ipl-gold/40'
                : 'bg-white/15 border-white/30 text-white hover:bg-white/25 hover:border-white/50'
            }`}
            title={paused ? 'Resume auction' : 'Pause auction'}
          >
            {paused ? (
              /* Play triangle */
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <polygon points="3,1 13,7 3,13" />
              </svg>
            ) : (
              /* Pause bars */
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="2" y="1" width="4" height="12" rx="1"/>
                <rect x="8" y="1" width="4" height="12" rx="1"/>
              </svg>
            )}
          </button>
          {/* Speed control */}
          <div className={`flex rounded-lg overflow-hidden border border-white/10 transition-opacity ${paused ? 'opacity-40 pointer-events-none' : ''}`}>
            {([1, 2, 3] as const).map(s => (
              <button key={s} onClick={() => { tap(); setSpeed(s) }}
                className={`px-2 py-1 text-[10px] font-black transition-colors ${
                  speed === s ? 'bg-ipl-accent text-white' : 'bg-white/5 text-gray-600 hover:text-gray-300'
                }`}
              >{s}×</button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1.5">
            <span className="text-ipl-gold text-xs font-bold">₹{gameState.teamStates[userTeam]?.currentPurse.toFixed(1)}Cr</span>
          </div>
          {/* Skip Rest of Set */}
          {gameState.phase === 'bidding' && dataset && (
            <button
              onClick={() => {
                action()
                setSimulating(true)
                setSimProgress(0)
                cancelCalling()
                aiLoopRef.current = false
                simStopRef.current = false
                void simulateRemainingSet(dataset, p => setSimProgress(p), () => simStopRef.current).then(() => setSimulating(false))
              }}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-black text-orange-300 bg-orange-500/15 border border-orange-500/30 rounded-lg hover:bg-orange-500/25 transition-colors flex-shrink-0"
              title="Skip rest of set — AI buys remaining players"
            >
              ⏭ Skip
            </button>
          )}
          <button
            onClick={() => { tap(); setMenuOpen(true) }}
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
                maximumSquadSize={dataset.maximumSquadSize}
                nextBidAmount={interruptBid}
              />
            </div>

            {/* ── Auction Dynamics Panel — commentary + owner thoughts + room feed ── */}
            <div className="bg-black/50 border border-white/12 rounded-2xl overflow-hidden">
              {auctioneeerLine && (
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/8 bg-ipl-gold/8">
                  <span className="text-base shrink-0">🎙️</span>
                  <p className="text-ipl-gold text-sm font-semibold italic leading-snug">{auctioneeerLine}</p>
                </div>
              )}
              {ownerThought && (
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/8">
                  <TeamBadge teamId={ownerThought.teamId} size="sm" />
                  <p className="text-gray-200 text-sm leading-snug">
                    <span className="font-semibold mr-1">{OWNER_NAMES[ownerThought.teamId] ?? ownerThought.teamId}:</span>
                    <span className="italic opacity-90">"{ownerThought.comment}"</span>
                  </p>
                </div>
              )}
              <div className="px-1 py-1">
                <MobileReactionsFeed log={gameState.auctionLog ?? []} />
              </div>
            </div>

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
                <p className="text-gray-500">Preparing player...</p>
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
                <p className={`text-sm ${userHasSkipped ? 'text-gray-500' : 'text-gray-400'}`}>
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
              maximumSquadSize={dataset.maximumSquadSize}
              nextBidAmount={interruptBid}
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

      {/* Simulation overlay */}
      {simulating && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#111118] border border-white/10 rounded-3xl p-8 w-72 text-center">
            <div className="text-5xl mb-4 animate-pulse">⚡</div>
            <p className="text-white font-black text-xl mb-1">Simulating…</p>
            <p className="text-gray-400 text-sm mb-4">AI is buying players</p>
            <p className="text-ipl-gold font-bold text-lg mb-6">{simProgress} players processed</p>
            <button
              onClick={() => { simStopRef.current = true }}
              className="px-6 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-bold hover:bg-white/20 active:scale-95 transition-all"
            >
              Stop Simulation
            </button>
          </div>
        </div>
      )}
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
            onClick={() => { tap(); setFilter(filter === role ? 'ALL' : role) }}
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
              onClick={() => { tap(); togglePick(p.playerId) }}
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
          onClick={() => { confirm(); handleConfirm() }}
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
