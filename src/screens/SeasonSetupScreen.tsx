import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { TeamBadge } from '@components/ui/TeamBadge'
import { simulateSeason, generateOpponentSetups } from '@/engine/seasonSimulator'
import type { TeamId } from '@/types/team'
import type { TeamInstruction } from '@/types/season'

const INSTRUCTIONS: { value: TeamInstruction; label: string; icon: string; desc: string }[] = [
  { value: 'aggressive-batting',    label: 'Aggressive Batting',     icon: '⚔️',  desc: 'Go hard from ball one. High risk, high reward.' },
  { value: 'anchor-batting',        label: 'Anchor & Attack',        icon: '⚓',  desc: 'Build a solid platform, accelerate late.' },
  { value: 'pace-heavy',            label: 'Pace Battery',           icon: '🚀',  desc: 'Rely on express pacers to blow teams away.' },
  { value: 'spin-heavy',            label: 'Spin Trap',              icon: '🌀',  desc: 'Control with spinners on home-friendly pitches.' },
  { value: 'trust-experience',      label: 'Trust Experience',       icon: '🏆',  desc: 'Back the veterans when it matters.' },
  { value: 'back-youngsters',       label: 'Back Youngsters',        icon: '⭐',  desc: 'Give youth a chance — unpredictable upside.' },
  { value: 'high-risk-high-reward', label: 'All Out Attack',         icon: '🔥',  desc: 'Maximum intent every ball. Boom or bust.' },
  { value: 'balanced',              label: 'Balanced Approach',      icon: '⚖️',  desc: 'No extremes. Adapt to conditions.' },
  { value: 'defensive',             label: 'Defensive Setup',        icon: '🛡️',  desc: 'Defend totals and grind opponents down.' },
  { value: 'flexible-order',        label: 'Flexible Order',         icon: '🔄',  desc: 'Match-situation batting order. Versatile.' },
]

const ROLE_COLOR: Record<string, string> = {
  BAT: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  BWL: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  AR:  'bg-green-500/20 text-green-300 border-green-500/30',
  WK:  'bg-red-500/20 text-red-300 border-red-500/30',
}

export function SeasonSetupScreen() {
  const navigate = useNavigate()
  const { gameState, setSeasonSetup, setSeasonResult } = useGameStore()

  const [captainId, setCaptainId] = useState<string>('')
  const [vcId, setVcId] = useState<string | null>(null)
  const [instruction, setInstruction] = useState<TeamInstruction>('balanced')
  const [simulating, setSimulating] = useState(false)

  if (!gameState) {
    return (
      <div className="min-h-screen bg-ipl-darker flex items-center justify-center">
        <p className="text-gray-400">No active session</p>
      </div>
    )
  }

  const userTeam = gameState.userFranchise as TeamId
  const teamState = gameState.teamStates[userTeam]
  const squad = [...teamState.squad].sort((a, b) => b.soldPrice - a.soldPrice)

  const handleSimulate = async () => {
    if (!captainId) return
    setSimulating(true)

    // Small delay so the spinner renders before blocking computation
    await new Promise(r => setTimeout(r, 80))

    const opponentSetups = generateOpponentSetups(gameState)
    const setup = {
      userTeam,
      captainPlayerId: captainId,
      viceCaptainPlayerId: vcId,
      instruction,
      opponentSetups,
    }

    setSeasonSetup(setup)

    const session = useGameStore.getState().activeSession
    const difficulty = session?.difficulty ?? 'normal'
    const result = simulateSeason(gameState, setup, difficulty)
    setSeasonResult(result)

    navigate('/season-results')
  }

  return (
    <div className="min-h-screen bg-ipl-darker pb-10">
      {/* Header */}
      <div className="bg-gradient-to-b from-ipl-purple/30 to-transparent px-4 pb-6 safe-top">
        <button className="text-gray-500 hover:text-white text-sm mb-4 transition-colors" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <TeamBadge teamId={userTeam} size="lg" showRing />
          <div>
            <h1 className="text-white font-black text-2xl">Season Setup</h1>
            <p className="text-gray-500 text-sm">Choose your captain and strategy</p>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* Captain selection */}
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">
            Choose Captain <span className="text-ipl-accent">*</span>
          </p>
          <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
            {squad.map(p => (
              <button
                key={p.playerId}
                onClick={() => {
                  setCaptainId(p.playerId)
                  if (vcId === p.playerId) setVcId(null)
                }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all text-left ${
                  captainId === p.playerId
                    ? 'border-ipl-gold bg-ipl-gold/15 text-white'
                    : 'border-ipl-border bg-ipl-card text-gray-300 hover:border-white/20'
                }`}
              >
                {captainId === p.playerId && (
                  <span className="text-ipl-gold font-black text-sm w-6">C</span>
                )}
                {captainId !== p.playerId && (
                  <span className="w-6 h-6 rounded-full border border-ipl-border flex-shrink-0" />
                )}
                <span className={`text-xs px-1.5 py-0.5 rounded border ${ROLE_COLOR[p.role]}`}>{p.role}</span>
                <span className="flex-1 font-semibold text-sm truncate">{p.name}</span>
                <span className="text-ipl-gold text-xs font-bold">₹{p.soldPrice.toFixed(1)}Cr</span>
              </button>
            ))}
          </div>
        </div>

        {/* Vice captain selection */}
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">
            Vice Captain <span className="text-gray-600">(optional)</span>
          </p>
          <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
            {squad.filter(p => p.playerId !== captainId).map(p => (
              <button
                key={p.playerId}
                onClick={() => setVcId(vcId === p.playerId ? null : p.playerId)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all text-left ${
                  vcId === p.playerId
                    ? 'border-ipl-accent bg-ipl-accent/10 text-white'
                    : 'border-ipl-border bg-ipl-card text-gray-300 hover:border-white/20'
                }`}
              >
                {vcId === p.playerId && (
                  <span className="text-ipl-accent font-black text-sm w-6">VC</span>
                )}
                {vcId !== p.playerId && (
                  <span className="w-6 h-6 rounded-full border border-ipl-border flex-shrink-0" />
                )}
                <span className={`text-xs px-1.5 py-0.5 rounded border ${ROLE_COLOR[p.role]}`}>{p.role}</span>
                <span className="flex-1 font-semibold text-sm truncate">{p.name}</span>
                <span className="text-gray-500 text-xs">₹{p.soldPrice.toFixed(1)}Cr</span>
              </button>
            ))}
          </div>
        </div>

        {/* Instruction selection */}
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Team Instruction</p>
          <div className="grid grid-cols-1 gap-2">
            {INSTRUCTIONS.map(instr => (
              <button
                key={instr.value}
                onClick={() => setInstruction(instr.value)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                  instruction === instr.value
                    ? 'border-ipl-accent bg-ipl-accent/10'
                    : 'border-ipl-border bg-ipl-card hover:border-white/20'
                }`}
              >
                <span className="text-xl w-7 text-center">{instr.icon}</span>
                <div className="flex-1">
                  <p className={`font-bold text-sm ${instruction === instr.value ? 'text-ipl-accent' : 'text-white'}`}>
                    {instr.label}
                  </p>
                  <p className="text-gray-500 text-xs">{instr.desc}</p>
                </div>
                {instruction === instr.value && (
                  <span className="text-ipl-accent text-lg">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Simulate button */}
        <div className="sticky bottom-4">
          <button
            onClick={handleSimulate}
            disabled={!captainId || simulating}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-ipl-accent to-red-700 text-white font-black text-base
                       disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity
                       shadow-glow-accent"
          >
            {simulating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin text-lg">⚙️</span> Simulating Season…
              </span>
            ) : (
              '🏆 Simulate Season →'
            )}
          </button>
          {!captainId && (
            <p className="text-center text-gray-600 text-xs mt-2">Select a captain to continue</p>
          )}
        </div>
      </div>
    </div>
  )
}
