/**
 * Trade Window — interactive negotiation room with franchise owner dialogue.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { TeamBadge } from '@components/ui/TeamBadge'
import { BottomNav } from '@components/ui/BottomNav'
import { validateTrade, executeTrade, getAITradeResponse, buildTradeRecord } from '@/engine/tradeEngine'
import { loadDataset } from '@/dataset/datasetLoader'
import { ALL_PERSONAS } from '@/personas'
import type { TeamId, TeamState } from '@/types/team'
import type { SoldPlayerRecord } from '@/types/player'
import type { TradeProposal, TradeLeg, CounterOfferStructured } from '@/types/trade'
import type { AuctionDataset } from '@/types/dataset'

const ROLE_COLOR: Record<string, string> = {
  BAT: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  BWL: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  AR:  'bg-green-500/20 text-green-300 border-green-500/30',
  WK:  'bg-red-500/20 text-red-300 border-red-500/30',
}

type NegotiationEntry = {
  side: 'user' | 'ai'
  teamId: string
  message: string
  type: 'proposal' | 'accept' | 'reject' | 'counter'
}

// ─── Player chip ──────────────────────────────────────────────────────────────

function PlayerChip({ player, selected, onToggle }: {
  player: SoldPlayerRecord; selected: boolean; onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all w-full text-left ${
        selected
          ? 'border-ipl-accent bg-ipl-accent/15 text-white shadow-sm shadow-ipl-accent/20'
          : 'border-ipl-border bg-ipl-card text-gray-300 hover:border-white/25 hover:bg-white/5'
      }`}
    >
      <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-bold shrink-0 ${ROLE_COLOR[player.role]}`}>
        {player.role}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate leading-tight">{player.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          {player.isRetained && (
            <span className="text-[9px] text-amber-400 font-bold">RETAINED</span>
          )}
          {player.isOverseas && (
            <span className="text-[9px] text-sky-400 font-bold">OVERSEAS</span>
          )}
          {!player.isRetained && !player.isOverseas && (
            <span className="text-[9px] text-gray-600">
              {player.cappedStatus === 'capped' ? 'Capped' : 'Uncapped'}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-ipl-gold text-xs font-black leading-tight">₹{player.soldPrice.toFixed(1)}Cr</p>
        {selected && <p className="text-ipl-accent text-[10px]">✓ picked</p>}
      </div>
    </button>
  )
}

// ─── Negotiation bubble ───────────────────────────────────────────────────────

function NegotiationBubble({ entry }: { entry: NegotiationEntry }) {
  const isUser = entry.side === 'user'
  const persona = ALL_PERSONAS[entry.teamId]

  const styles = {
    accept:   'bg-green-500/12 border-green-500/35 shadow-sm shadow-green-500/10',
    reject:   'bg-red-500/12 border-red-500/35 shadow-sm shadow-red-500/10',
    counter:  'bg-orange-500/12 border-orange-500/35 shadow-sm shadow-orange-500/10',
    proposal: isUser
      ? 'bg-ipl-accent/12 border-ipl-accent/35 shadow-sm shadow-ipl-accent/10'
      : 'bg-white/4 border-white/10',
  }

  const label = {
    accept:   { icon: '✅', text: 'Accepted', color: 'text-green-400' },
    reject:   { icon: '❌', text: 'Rejected', color: 'text-red-400' },
    counter:  { icon: '↩', text: 'Counter', color: 'text-orange-400' },
    proposal: { icon: '📋', text: 'Proposal', color: 'text-gray-400' },
  }[entry.type]

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="shrink-0 mt-1">
        <TeamBadge teamId={entry.teamId} size="sm" />
      </div>
      <div className={`max-w-[82%] rounded-2xl border px-4 py-3 ${styles[entry.type]} ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-xs font-bold text-gray-300">{persona?.displayName ?? entry.teamId}</p>
          <span className={`text-[10px] font-semibold ${label.color}`}>{label.icon} {label.text}</span>
        </div>
        <p className="text-white text-sm leading-relaxed">"{entry.message}"</p>
      </div>
    </div>
  )
}

// ─── Deal preview ─────────────────────────────────────────────────────────────

function DealPreview({ offerIds, requestIds, userSquad, targetSquad, myCash, theirCash }: {
  offerIds: Set<string>; requestIds: Set<string>
  userSquad: SoldPlayerRecord[]; targetSquad: SoldPlayerRecord[]
  myCash: number; theirCash: number
}) {
  const offered   = userSquad.filter(p => offerIds.has(p.playerId))
  const requested = targetSquad.filter(p => requestIds.has(p.playerId))
  if (offered.length === 0 && requested.length === 0 && myCash === 0 && theirCash === 0) return null

  const offerVal  = offered.reduce((s, p) => s + p.soldPrice, 0) + myCash
  const reqVal    = requested.reduce((s, p) => s + p.soldPrice, 0) + theirCash
  const diff      = reqVal - offerVal
  const isGood    = diff >= 2
  const isBad     = diff <= -2

  return (
    <div className={`rounded-2xl border p-4 ${
      isGood ? 'bg-green-500/8 border-green-500/25' :
      isBad  ? 'bg-red-500/8 border-red-500/25' :
               'bg-ipl-card2 border-ipl-border'
    }`}>
      <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-3 font-semibold">Live Deal Preview</p>
      <div className="flex items-stretch gap-3">
        {/* You send */}
        <div className="flex-1 text-center">
          <p className="text-gray-500 text-xs mb-1">You Send</p>
          <p className="text-white font-black text-lg">₹{offerVal.toFixed(1)}<span className="text-xs text-gray-500"> Cr</span></p>
          <div className="mt-1 space-y-0.5">
            {offered.map(p => (
              <p key={p.playerId} className="text-gray-400 text-[10px] truncate">{p.name}</p>
            ))}
            {myCash > 0 && <p className="text-gray-400 text-[10px]">+₹{myCash}Cr cash</p>}
          </div>
        </div>

        {/* Net diff */}
        <div className="flex flex-col items-center justify-center px-2 shrink-0">
          <p className="text-gray-600 text-xl font-black">⇄</p>
          <p className={`text-xs font-black mt-1 ${isGood ? 'text-green-400' : isBad ? 'text-red-400' : 'text-gray-400'}`}>
            {diff >= 0 ? '+' : ''}₹{diff.toFixed(1)}Cr
          </p>
          <p className="text-[9px] text-gray-600">{isGood ? 'you gain' : isBad ? 'you lose' : 'even'}</p>
        </div>

        {/* You receive */}
        <div className="flex-1 text-center">
          <p className="text-gray-500 text-xs mb-1">You Receive</p>
          <p className="text-white font-black text-lg">₹{reqVal.toFixed(1)}<span className="text-xs text-gray-500"> Cr</span></p>
          <div className="mt-1 space-y-0.5">
            {requested.map(p => (
              <p key={p.playerId} className="text-gray-400 text-[10px] truncate">{p.name}</p>
            ))}
            {theirCash > 0 && <p className="text-gray-400 text-[10px]">+₹{theirCash}Cr cash</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function TradeWindowScreen() {
  const navigate = useNavigate()
  const { gameState } = useGameStore()

  const [targetTeam, setTargetTeam] = useState<TeamId | null>(null)
  const [myOffers, setMyOffers] = useState<Set<string>>(new Set())
  const [theirRequests, setTheirRequests] = useState<Set<string>>(new Set())
  const [myCash, setMyCash] = useState(0)
  const [theirCash, setTheirCash] = useState(0)
  const [loading, setLoading] = useState(false)
  const [settled, setSettled] = useState(false)
  const [dataset, setDataset] = useState<AuctionDataset | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [negotiations, setNegotiations] = useState<NegotiationEntry[]>([])
  const [counterOffer, setCounterOffer] = useState<string | null>(null)
  const [counterOfferStructured, setCounterOfferStructured] = useState<CounterOfferStructured | null>(null)

  if (!gameState) {
    return (
      <div className="min-h-screen bg-ipl-darker flex items-center justify-center">
        <p className="text-gray-400">No active session</p>
      </div>
    )
  }

  const userTeam    = gameState.userFranchise as TeamId
  const userPersona = ALL_PERSONAS[userTeam]
  const userSquad   = gameState.teamStates[userTeam]?.squad ?? []
  const userPurse   = gameState.teamStates[userTeam]?.currentPurse ?? 0
  const allTeams    = (Object.keys(gameState.teamStates) as TeamId[]).filter(t => t !== userTeam)
  const targetSquad = targetTeam ? (gameState.teamStates[targetTeam]?.squad ?? []) : []
  const targetPurse = targetTeam ? (gameState.teamStates[targetTeam]?.currentPurse ?? 0) : 0

  const toggleMyOffer = (pid: string) =>
    setMyOffers(s => { const n = new Set(s); n.has(pid) ? n.delete(pid) : n.add(pid); return n })
  const toggleTheirRequest = (pid: string) =>
    setTheirRequests(s => { const n = new Set(s); n.has(pid) ? n.delete(pid) : n.add(pid); return n })

  const selectTeam = (tid: TeamId) => {
    setTargetTeam(tid)
    setMyOffers(new Set()); setTheirRequests(new Set())
    setMyCash(0); setTheirCash(0)
    setLoading(false); setSettled(false)
    setValidationError(null)
    setNegotiations([])
    setCounterOffer(null)
  }

  const resetProposal = () => {
    setMyOffers(new Set()); setTheirRequests(new Set())
    setMyCash(0); setTheirCash(0)
    setLoading(false); setSettled(false)
    setValidationError(null)
    setCounterOffer(null)
    setCounterOfferStructured(null)
  }

  const useCounterAsStart = () => {
    if (!counterOfferStructured || !targetTeam) return
    // AI said: "offer these, request those" — from AI's perspective
    // AI offers = what we receive → map to their squad player IDs
    const theirIds = new Set(
      targetSquad
        .filter(p => counterOfferStructured.playersToOffer.some(n => p.name === n))
        .map(p => p.playerId)
    )
    // AI requests = what they want from us → map to our squad player IDs
    const ourIds = new Set(
      userSquad
        .filter(p => counterOfferStructured.playersToRequest.some(n => p.name === n))
        .map(p => p.playerId)
    )
    const cash = counterOfferStructured.cashAdjustment
    setTheirRequests(theirIds)
    setMyOffers(ourIds)
    setMyCash(cash < 0 ? Math.abs(cash) : 0)
    setTheirCash(cash > 0 ? cash : 0)
    setSettled(false)
    setValidationError(null)
    setCounterOffer(null)
    setCounterOfferStructured(null)
  }

  const buildProposalMessage = () => {
    const offered   = userSquad.filter(p => myOffers.has(p.playerId))
    const requested = targetSquad.filter(p => theirRequests.has(p.playerId))
    const sendParts: string[] = offered.map(p => p.name)
    if (myCash > 0) sendParts.push(`₹${myCash}Cr cash`)
    const recvParts: string[] = requested.map(p => p.name)
    if (theirCash > 0) recvParts.push(`₹${theirCash}Cr cash`)
    const send = sendParts.join(' + ') || 'nothing'
    const recv = recvParts.join(' + ') || 'nothing'
    return `I'm offering ${send} in exchange for ${recv}. What do you say?`
  }

  const handlePropose = async () => {
    if (!targetTeam) return
    setValidationError(null)

    let ds = dataset
    if (!ds) {
      try { ds = await loadDataset(gameState.auctionYear); setDataset(ds) }
      catch { setValidationError('Could not load dataset for validation'); return }
    }

    const byLeg: TradeLeg = { teamId: userTeam, playerIds: Array.from(myOffers), cashAmount: myCash }
    const toLeg: TradeLeg = { teamId: targetTeam, playerIds: Array.from(theirRequests), cashAmount: theirCash }
    const proposal: TradeProposal = {
      id: `trade-${Date.now()}`,
      proposedBy: userTeam, proposedTo: targetTeam,
      legs: [byLeg, toLeg], proposedAt: Date.now(),
    }

    const validation = validateTrade(gameState, ds, proposal)
    if (!validation.valid) { setValidationError(validation.reason); return }

    setNegotiations(prev => [...prev, {
      side: 'user', teamId: userTeam, message: buildProposalMessage(), type: 'proposal',
    }])
    setLoading(true)

    const response = await getAITradeResponse(gameState, proposal)

    setNegotiations(prev => [...prev, {
      side: 'ai', teamId: targetTeam,
      message: response.ownerComment || (response.decision === 'accept' ? "Deal — let's do it." : "Not interested in this one."),
      type: response.decision === 'accept' ? 'accept' : response.counteroffer ? 'counter' : 'reject',
    }])
    setCounterOffer(response.counteroffer ?? null)
    setCounterOfferStructured(response.counterOfferStructured ?? null)
    setLoading(false)
    setSettled(true)

    if (response.decision === 'accept') {
      const newStates = executeTrade(gameState.teamStates, proposal)
      const record = buildTradeRecord(proposal, response, true)
      useGameStore.getState().setAllTeamStates(newStates as Record<TeamId, TeamState>)
      useGameStore.getState().recordTrade(record)
      useGameStore.getState().appendLog(`[TRADE] ${userTeam} ↔ ${targetTeam}: ${response.ownerComment}`)
    } else {
      useGameStore.getState().recordTrade(buildTradeRecord(proposal, response, false))
    }
  }

  const lastType = negotiations[negotiations.length - 1]?.type

  return (
    <div className="min-h-screen bg-ipl-darker pb-36">

      {/* ── Header ── */}
      <div className="relative bg-gradient-to-b from-ipl-purple/25 via-ipl-purple/10 to-transparent px-4 pb-6 safe-top">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.12)_0%,_transparent_70%)]" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ipl-accent/20 border border-ipl-accent/30 flex items-center justify-center text-xl">🤝</div>
          <div>
            <h1 className="text-white font-black text-xl tracking-tight">Trade Window</h1>
            <p className="text-gray-500 text-xs">Swap players before releasing & going to auction</p>
          </div>
        </div>

        {/* Franchise vs Franchise banner */}
        {targetTeam && (
          <div className="relative mt-5 bg-black/30 backdrop-blur-sm border border-white/8 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1">
              <TeamBadge teamId={userTeam} size="md" />
              <div className="min-w-0">
                <p className="text-white font-black text-sm leading-tight truncate">{userPersona?.displayName ?? userTeam}</p>
                <p className="text-gray-500 text-[10px]">
                  {userSquad.length} players · ₹{userPurse.toFixed(1)}Cr purse
                </p>
              </div>
            </div>
            <div className="shrink-0 text-center">
              <div className="bg-ipl-accent/20 border border-ipl-accent/30 rounded-full w-8 h-8 flex items-center justify-center">
                <span className="text-ipl-accent text-sm font-black">VS</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 flex-1 flex-row-reverse text-right">
              <TeamBadge teamId={targetTeam} size="md" />
              <div className="min-w-0">
                <p className="text-white font-black text-sm leading-tight truncate">{ALL_PERSONAS[targetTeam]?.displayName ?? targetTeam}</p>
                <p className="text-gray-500 text-[10px]">
                  {targetSquad.length} players · ₹{targetPurse.toFixed(1)}Cr purse
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 space-y-4">

        {/* ── Team selector ── */}
        <div>
          <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-3 font-semibold">Select Franchise to Negotiate With</p>
          <div className="grid grid-cols-5 gap-2">
            {allTeams.map(tid => {
              const squadSize = gameState.teamStates[tid]?.squad.length ?? 0
              const isActive  = tid === targetTeam
              return (
                <button key={tid} onClick={() => selectTeam(tid)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all ${
                    isActive
                      ? 'bg-ipl-accent/15 ring-2 ring-ipl-accent shadow-sm shadow-ipl-accent/20'
                      : 'bg-ipl-card hover:bg-ipl-card2 border border-ipl-border'
                  }`}
                >
                  <TeamBadge teamId={tid} size="sm" showRing={isActive} />
                  <span className="text-[9px] font-black text-gray-400">{tid}</span>
                  <span className="text-[8px] text-gray-600">{squadSize}p</span>
                </button>
              )
            })}
          </div>
        </div>

        {!targetTeam && (
          <div className="space-y-4 pt-2 pb-4">
            {/* How it works */}
            <div className="bg-ipl-card border border-ipl-border rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-ipl-accent/15 to-ipl-purple/10 px-4 py-3 border-b border-ipl-border">
                <p className="text-white font-black text-sm">How Trade Window Works</p>
                <p className="text-gray-500 text-xs mt-0.5">Lock in squad moves before the season starts</p>
              </div>
              <div className="divide-y divide-ipl-border">
                {[
                  { step: '01', icon: '🏟️', title: 'Pick a Franchise', body: 'Select any of the 9 rival teams above. Each owner has a distinct personality and priorities.' },
                  { step: '02', icon: '🔄', title: 'Build Your Offer', body: 'Choose players from your squad to send, players from their squad to request, and optionally add cash.' },
                  { step: '03', icon: '🤝', title: 'Negotiate Live', body: 'The AI owner responds in character — they may accept, reject, or counter with their own terms.' },
                ].map(({ step, icon, title, body }) => (
                  <div key={step} className="flex items-start gap-4 px-4 py-4">
                    <div className="shrink-0 w-9 h-9 rounded-xl bg-ipl-card2 border border-ipl-border flex items-center justify-center text-lg">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-gray-700 text-[10px] font-black">STEP {step}</span>
                        <p className="text-white font-bold text-sm">{title}</p>
                      </div>
                      <p className="text-gray-500 text-xs leading-relaxed">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trade rules reminder */}
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl px-4 py-3">
              <p className="text-amber-400 text-xs font-black uppercase tracking-widest mb-2">Trade Rules</p>
              <div className="space-y-1.5">
                {[
                  'No team may exceed 8 overseas players after the trade',
                  'Both teams must remain above their minimum squad size',
                  'Cash can sweeten a deal, but players must be the core',
                  'The AI owner reflects their team\'s real squad priorities',
                ].map((rule, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-amber-500/60 text-xs shrink-0 mt-0.5">▸</span>
                    <p className="text-amber-200/70 text-xs leading-snug">{rule}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {targetTeam && (
          <>
            {/* ── Negotiation room ── */}
            {negotiations.length > 0 && (
              <div className="bg-ipl-card rounded-2xl border border-ipl-border overflow-hidden">
                <div className="bg-black/20 px-4 py-2.5 border-b border-ipl-border flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-gray-400 text-xs font-semibold">Negotiation Room</p>
                  <span className="text-gray-700 text-xs">·</span>
                  <p className="text-gray-600 text-xs">{ALL_PERSONAS[targetTeam]?.displayName} is listening</p>
                </div>
                <div className="p-4 space-y-4">
                  {negotiations.map((entry, i) => (
                    <NegotiationBubble key={i} entry={entry} />
                  ))}
                  {loading && (
                    <div className="flex items-center gap-3">
                      <TeamBadge teamId={targetTeam} size="sm" />
                      <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
                        <p className="text-xs text-gray-500 mb-2">{ALL_PERSONAS[targetTeam]?.displayName} is deliberating…</p>
                        <div className="flex gap-1.5 items-center">
                          {[0, 150, 300].map(d => (
                            <span key={d} className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Counter-offer hint ── */}
            {settled && counterOffer && lastType === 'counter' && (
              <div className="bg-orange-500/8 border border-orange-500/30 rounded-2xl px-4 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-orange-400 text-sm">↩</span>
                  <p className="text-orange-400 text-xs font-black uppercase tracking-widest">They Want Instead</p>
                </div>
                <p className="text-orange-200 text-sm leading-relaxed">"{counterOffer}"</p>
                {counterOfferStructured && (
                  <button
                    onClick={useCounterAsStart}
                    className="mt-3 w-full py-2 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-300 text-xs font-bold hover:bg-orange-500/30 transition-colors"
                  >
                    ↩ Use Counter as Starting Point
                  </button>
                )}
                {!counterOfferStructured && (
                  <p className="text-gray-600 text-xs mt-2">Adjust your offer and send a revised proposal</p>
                )}
              </div>
            )}

            {/* ── Post-settle actions ── */}
            {settled && (
              <div className="flex gap-3">
                {lastType === 'accept' ? (
                  <div className="flex-1 bg-green-500/12 border border-green-500/30 rounded-2xl p-4 text-center">
                    <p className="text-green-300 font-black text-base">🏆 Trade Complete!</p>
                    <p className="text-green-500 text-xs mt-1">Squads have been updated</p>
                  </div>
                ) : (
                  <button onClick={resetProposal}
                    className="flex-1 py-3 rounded-xl bg-ipl-card border border-ipl-border text-gray-300 text-sm font-bold hover:bg-ipl-card2 transition-colors"
                  >
                    ↩ Revise Offer
                  </button>
                )}
                <button onClick={() => selectTeam(targetTeam)}
                  className="flex-1 py-3 rounded-xl bg-ipl-card border border-ipl-border text-gray-300 text-sm font-bold hover:bg-ipl-card2 transition-colors"
                >
                  🔄 New Proposal
                </button>
              </div>
            )}

            {/* ── Validation error ── */}
            {validationError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm font-semibold">⚠️ {validationError}</p>
              </div>
            )}

            {/* ── Trade builder ── */}
            {!settled && (
              <>
                <DealPreview
                  offerIds={myOffers} requestIds={theirRequests}
                  userSquad={userSquad} targetSquad={targetSquad}
                  myCash={myCash} theirCash={theirCash}
                />

                <div className="grid grid-cols-2 gap-3">
                  {/* Your squad */}
                  <div className="bg-ipl-card rounded-2xl border border-ipl-border overflow-hidden">
                    <div className="bg-ipl-card2 px-3 py-2.5 border-b border-ipl-border flex items-center gap-2">
                      <TeamBadge teamId={userTeam} size="sm" />
                      <div className="min-w-0">
                        <p className="text-white font-black text-xs leading-tight truncate">{userPersona?.displayName ?? userTeam}</p>
                        <p className="text-gray-600 text-[9px]">Tap to offer</p>
                      </div>
                    </div>
                    <div className="p-2 space-y-1.5 max-h-52 overflow-y-auto">
                      {userSquad.length === 0
                        ? <p className="text-gray-600 text-xs text-center py-4">No players</p>
                        : userSquad.map(p => (
                            <PlayerChip key={p.playerId} player={p}
                              selected={myOffers.has(p.playerId)} onToggle={() => toggleMyOffer(p.playerId)} />
                          ))}
                    </div>
                    <div className="border-t border-ipl-border px-2 py-2">
                      <div className="flex items-center gap-1.5 bg-black/30 rounded-lg px-2 py-1.5">
                        <span className="text-gray-500 text-xs">+₹</span>
                        <input type="number" min={0} step={0.5} value={myCash || ''}
                          onChange={e => setMyCash(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="flex-1 bg-transparent text-white text-xs outline-none min-w-0"
                          placeholder="Add cash (Cr)"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Their squad */}
                  <div className="bg-ipl-card rounded-2xl border border-ipl-border overflow-hidden">
                    <div className="bg-ipl-card2 px-3 py-2.5 border-b border-ipl-border flex items-center gap-2">
                      <TeamBadge teamId={targetTeam} size="sm" />
                      <div className="min-w-0">
                        <p className="text-white font-black text-xs leading-tight truncate">{ALL_PERSONAS[targetTeam]?.displayName ?? targetTeam}</p>
                        <p className="text-gray-600 text-[9px]">Tap to request</p>
                      </div>
                    </div>
                    <div className="p-2 space-y-1.5 max-h-52 overflow-y-auto">
                      {targetSquad.length === 0
                        ? <p className="text-gray-600 text-xs text-center py-4">No players</p>
                        : targetSquad.map(p => (
                            <PlayerChip key={p.playerId} player={p}
                              selected={theirRequests.has(p.playerId)} onToggle={() => toggleTheirRequest(p.playerId)} />
                          ))}
                    </div>
                    <div className="border-t border-ipl-border px-2 py-2">
                      <div className="flex items-center gap-1.5 bg-black/30 rounded-lg px-2 py-1.5">
                        <span className="text-gray-500 text-xs">+₹</span>
                        <input type="number" min={0} step={0.5} value={theirCash || ''}
                          onChange={e => setTheirCash(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="flex-1 bg-transparent text-white text-xs outline-none min-w-0"
                          placeholder="Request cash (Cr)"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Send button */}
                <button
                  onClick={handlePropose}
                  disabled={loading || (myOffers.size === 0 && theirRequests.size === 0 && myCash === 0 && theirCash === 0)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-ipl-accent to-ipl-purple
                             text-white font-black text-sm tracking-wide
                             disabled:opacity-35 disabled:cursor-not-allowed
                             hover:opacity-90 active:scale-[0.98] transition-all
                             shadow-lg shadow-ipl-accent/25"
                >
                  {loading ? '⏳ Waiting for response…' : '📨 Send Trade Proposal'}
                </button>
              </>
            )}
          </>
        )}

      </div>

      {/* Sticky footer CTA */}
      <div className="fixed bottom-16 left-0 right-0 z-20 px-4 pb-2 pointer-events-none">
        <button
          onClick={() => navigate('/retention-setup')}
          className="pointer-events-auto w-full py-3.5 rounded-2xl bg-ipl-card/95 backdrop-blur-md
                     border border-white/15 text-gray-300 text-sm font-bold
                     hover:bg-ipl-card2 hover:text-white hover:border-white/25
                     shadow-lg shadow-black/40 transition-all active:scale-[0.98]"
        >
          Done Trading — Release &amp; Retain Players →
        </button>
      </div>

      <BottomNav active="my-squad" />
    </div>
  )
}
