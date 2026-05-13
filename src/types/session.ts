import type { GameState } from './game'

/** Lightweight metadata shown on the Saved Sessions screen */
export interface SessionMeta {
  id: string
  name: string
  auctionYear: number
  auctionType: string
  userFranchise: string
  difficulty: string
  phase: string
  createdAt: string   // ISO timestamp
  updatedAt: string   // ISO timestamp
}

/** Full session as persisted in IndexedDB and Supabase */
export interface GameSession {
  id: string
  userId: string
  name: string
  auctionYear: number
  auctionType: string
  userFranchise: string
  difficulty: string
  phase: string
  state: GameState
  createdAt: string
  updatedAt: string
}
