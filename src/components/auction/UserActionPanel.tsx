import { useState } from 'react'
import type { AuctionDataset } from '@/types/dataset'
import type { GameState } from '@/types/game'
import type { PlayerRecord } from '@/types/player'
import type { TeamId } from '@/types/team'
import { getBidIncrement } from '@/dataset/datasetLoader'
import { getSafeBidLimit } from '@/engine/ruleEngine'

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
  const userTeam = state.userFranchise as TeamId
  const teamState = state.teamStates[userTeam]
  const bidState = state.currentBidState
  const [customBid, setCustomBid] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const currentBid = bidState?.currentBid ?? 0
  const increment = getBidIncrement(dataset, currentBid)
  const nextBid = currentBid === 0 ? currentPlayer.basePrice : currentBid + increment
  const safeBidLimit = getSafeBidLimit(teamState, dataset)
  const canBid = nextBid <= safeBidLimit && teamState.currentPurse >= nextBid

  const handleCustomBid = () => {
    const amount = parseFloat(customBid)
    if (!isNaN(amount) && amount >= nextBid && amount <= safeBidLimit) {
      onBid(amount)
      setCustomBid('')
      setShowCustom(false)
    }
  }

  return (
    <div className="bg-ipl-card border border-ipl-border rounded-2xl overflow-hidden">
      {/* Price summary strip */}
      <div className="grid grid-cols-3 divide-x divide-ipl-border border-b border-ipl-border">
        <div className="px-4 py-3 text-center">
          <p className="text-gray-500 text-xs uppercase tracking-wide">Your Purse</p>
          <p className="text-white font-bold text-sm mt-0.5">₹{teamState.currentPurse.toFixed(1)} Cr</p>
        </div>
        <div className="px-4 py-3 text-center bg-ipl-gold/5">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Next Bid</p>
          <p className="text-ipl-gold font-black text-lg mt-0.5">₹{nextBid.toFixed(2)} Cr</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-gray-500 text-xs uppercase tracking-wide">Safe Limit</p>
          <p className="text-gray-300 font-bold text-sm mt-0.5">₹{safeBidLimit.toFixed(1)} Cr</p>
        </div>
      </div>

      {/* Main action row */}
      <div className="flex gap-0 divide-x divide-ipl-border">
        {/* BID button — takes most space */}
        <button
          disabled={disabled || !canBid}
          onClick={() => onBid(nextBid)}
          className={`flex-1 py-5 font-black text-xl tracking-wide transition-all ${
            canBid && !disabled
              ? 'bg-ipl-accent hover:bg-ipl-accent/90 text-white active:scale-[0.98]'
              : 'bg-ipl-dark text-gray-700 cursor-not-allowed'
          }`}
        >
          BID ₹{nextBid.toFixed(2)} Cr
        </button>

        {/* PASS ROUND */}
        <button
          disabled={disabled}
          onClick={onPassBid}
          className="px-5 py-5 font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-all disabled:opacity-40 text-sm"
          title="Sit out this price — you can re-enter when someone raises"
        >
          PASS<br /><span className="font-normal text-xs text-gray-600">round</span>
        </button>

        {/* SKIP PLAYER */}
        <button
          disabled={disabled}
          onClick={onSkipPlayer}
          className="px-4 py-5 font-bold text-gray-600 hover:text-gray-400 hover:bg-gray-900 transition-all disabled:opacity-40 text-sm"
          title="You're out of this player entirely"
        >
          SKIP<br /><span className="font-normal text-xs text-gray-700">player</span>
        </button>
      </div>

      {/* Custom bid row */}
      {showCustom ? (
        <div className="flex gap-2 p-3 border-t border-ipl-border">
          <input
            type="number"
            step={increment}
            min={nextBid}
            max={safeBidLimit}
            value={customBid}
            onChange={e => setCustomBid(e.target.value)}
            placeholder={`Min ₹${nextBid.toFixed(2)}`}
            autoFocus
            className="flex-1 bg-ipl-dark border border-ipl-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ipl-accent/60 placeholder:text-gray-600"
          />
          <button
            onClick={handleCustomBid}
            className="px-4 py-2 bg-ipl-accent text-white text-sm font-bold rounded-lg hover:bg-ipl-accent/90"
          >
            Go
          </button>
          <button
            onClick={() => setShowCustom(false)}
            className="px-3 py-2 text-gray-500 hover:text-gray-300 text-sm"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowCustom(true)}
          className="w-full py-2 text-gray-700 hover:text-gray-500 text-xs border-t border-ipl-border transition-colors"
        >
          Enter custom bid amount
        </button>
      )}

      {safeBidLimit < nextBid && (
        <p className="text-ipl-accent text-xs text-center pb-2 px-4">
          Reserve limit reached — must keep ₹{(teamState.currentPurse - safeBidLimit).toFixed(1)} Cr for remaining squad slots
        </p>
      )}
    </div>
  )
}
