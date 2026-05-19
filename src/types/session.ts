import type { GameState } from './game'

export interface SessionMeta {
  id: string
  name: string
  auctionYear: number
  auctionType: string
  userFranchise: string
  difficulty: string
  phase: string
  createdAt: string
  updatedAt: string
}

export interface GameSession {
  id: string
  name: string
  auctionYear: number
  auctionType: 'mega' | 'mini'
  userFranchise: string
  difficulty: 'easy' | 'normal' | 'hard'
  state: GameState
  createdAt: string
  updatedAt: string
}
