import type { TeamId } from './team'

export interface TradeLeg {
  teamId: TeamId
  playerIds: string[]   // players this team gives up
  cashAmount: number    // cash this team gives up (0 if none)
}

export interface TradeProposal {
  id: string
  proposedBy: TeamId
  proposedTo: TeamId
  legs: [TradeLeg, TradeLeg]   // exactly two legs (one per team)
  proposedAt: number            // timestamp
}

export type TradeDecision = 'accept' | 'reject' | 'counteroffer'

export interface TradeResponse {
  decision: TradeDecision
  ownerComment: string
  counteroffer: string | null   // free-text counter suggestion from AI owner
  reason: string
}

export interface TradeRecord {
  proposal: TradeProposal
  response: TradeResponse
  applied: boolean
  appliedAt: number | null
}
