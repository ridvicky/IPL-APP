import { useState } from 'react'
import type { AuctionDataset } from '@/types/dataset'
import type { GameState } from '@/types/game'
import type { PlayerRecord } from '@/types/player'
import type { TeamId } from '@/types/team'
import { getBidIncrement } from '@/dataset/datasetLoader'

interface UserActionPanelProps {
  state: GameState
  dataset: AuctionDataset
  currentPlayer: PlayerRecord
  onBid: (amount: number) => void
  onPassBid: () => void
  onSkipPlayer: () => void
  disabled?: boolean
}

export function UserActionPanel({
  state, dataset, currentPlayer, onBid, onPassBid, onSkipPlayer, disabled,
}: UserActionPanelProps) {
  const userTeam    = state.userFranchise as TeamId
  const teamState   = state.teamStates[userTeam]
  const bidState    = state.currentBidState
  const [customBid, setCustomBid] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [customError, setCustomError] = useState('')

  const currentBid = bidState?.currentBid ?? 0
  const increment  = getBidIncrement(dataset, currentBid)
  const nextBid    = currentBid === 0 ? currentPlayer.basePrice : currentBid + increment
  const canBid     = teamState.currentPurse >= nextBid
  const purseAfter = teamState.currentPurse - nextBid

  const handleCustomBid = () => {
    const amount = parseFloat(customBid)
    if (isNaN(amount)) { setCustomError('Enter a valid amount'); return }
    if (amount < nextBid) { setCustomError(`Minimum bid is ₹${nextBid.toFixed(2)} Cr`); return }
    if (amount > teamState.currentPurse) { setCustomError(`You only have ₹${teamState.currentPurse.toFixed(2)} Cr`); return }
    setCustomError('')
    onBid(amount)
    setCustomBid('')
    setShowCustom(false)
  }

  return (
    <div className="rounded-3xl overflow-hidden border border-ipl-border bg-ipl-card">

      {/* Info strip */}
      <div className="flex items-center justify-between px-5 py-3 bg-black/20 border-b border-ipl-border">
        <div className="text-center">
          <p className="text-gray-600 text-[10px] uppercase tracking-widest">Your Purse</p>
          <p className="text-white font-bold text-sm">₹{teamState.currentPurse.toFixed(1)} Cr</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-[10px] uppercase tracking-widest">Next Bid</p>
          <p className="text-ipl-gold font-black text-xl">₹{nextBid.toFixed(2)} Cr</p>
        </div>
        <div className="text-center">
          <p className="text-gray-600 text-[10px] uppercase tracking-widest">After Bid</p>
          <p className={`font-bold text-sm ${purseAfter < 5 ? 'text-red-400' : 'text-gray-300'}`}>
            ₹{purseAfter.toFixed(1)} Cr
          </p>
        </div>
      </div>

      {/* BID button — hero */}
      <button
        disabled={disabled || !canBid}
        onClick={() => onBid(nextBid)}
        className={`w-full py-6 font-black text-2xl tracking-widest transition-all duration-150
          ${canBid && !disabled
            ? 'bg-gradient-to-r from-ipl-accent via-ipl-accent to-red-600 text-white active:scale-[0.98] hover:opacity-95 shadow-lg shadow-ipl-accent/30'
            : 'bg-ipl-dark text-gray-500 cursor-not-allowed'
          }`}
      >
        {canBid && !disabled ? (
          <>
            <span className="text-white/60 text-lg mr-1">🏏</span>
            BID  ₹{nextBid.toFixed(2)} Cr
          </>
        ) : (
          <span className="text-sm font-semibold">Cannot bid — safe limit reached</span>
        )}
      </button>

      {/* Secondary actions */}
      <div className="grid grid-cols-2 divide-x divide-ipl-border border-t border-ipl-border">
        <button
          disabled={disabled}
          onClick={onPassBid}
          className="py-4 flex flex-col items-center gap-0.5 text-gray-400 hover:text-white hover:bg-white/5
                     transition-all disabled:opacity-40 active:bg-white/8"
        >
          <span className="text-base leading-none">✋</span>
          <span className="font-black text-xs tracking-wide mt-1">PASS ROUND</span>
          <span className="text-gray-500 text-[10px]">re-enter later</span>
        </button>
        <button
          disabled={disabled}
          onClick={onSkipPlayer}
          className="py-4 flex flex-col items-center gap-0.5 text-gray-600 hover:text-gray-300 hover:bg-white/5
                     transition-all disabled:opacity-40 active:bg-white/8"
        >
          <span className="text-base leading-none">⏭</span>
          <span className="font-black text-xs tracking-wide mt-1">SKIP PLAYER</span>
          <span className="text-gray-500 text-[10px]">not interested</span>
        </button>
      </div>

      {/* Custom bid */}
      <div className="border-t border-ipl-border">
        {showCustom ? (
          <div className="flex flex-col gap-1.5 p-3">
            <div className="flex gap-2">
              <input
                type="number"
                step={increment}
                min={nextBid}
                max={teamState.currentPurse}
                value={customBid}
                onChange={e => { setCustomBid(e.target.value); setCustomError('') }}
                placeholder={`Min ₹${nextBid.toFixed(2)}`}
                autoFocus
                className="flex-1 bg-ipl-dark border border-ipl-border rounded-xl px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-ipl-accent/50
                           placeholder:text-gray-500"
              />
              <button
                onClick={handleCustomBid}
                className="px-4 py-2.5 bg-ipl-accent text-white text-sm font-black rounded-xl
                           hover:bg-ipl-accent/90 transition-colors"
              >
                Go
              </button>
              <button
                onClick={() => { setShowCustom(false); setCustomError('') }}
                className="px-3 py-2.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
              >
                ✕
              </button>
            </div>
            {customError && <p className="text-red-400 text-xs px-1">{customError}</p>}
          </div>
        ) : (
          <button
            onClick={() => { setShowCustom(true); setCustomBid(nextBid.toFixed(2)); setCustomError('') }}
            className="w-full py-2.5 text-gray-500 hover:text-gray-300 text-xs tracking-wide
                       transition-colors font-semibold"
          >
            ↑  Enter jump bid amount
          </button>
        )}
      </div>

    </div>
  )
}
