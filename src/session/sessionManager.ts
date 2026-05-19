/**
 * Session Manager — creates, saves, loads, and deletes game sessions.
 * Local-first: IndexedDB is the source of truth for active play.
 * Supabase sync is fire-and-forget in the background.
 */

import { v4 as uuidv4 } from 'uuid'
import type { GameSession, SessionMeta } from '@/types/session'
import type { GameState } from '@/types/game'
import type { TeamId } from '@/types/team'
import {
  saveSessionLocally,
  loadSessionLocally,
  listSessionsLocally,
  deleteSessionLocally,
} from './indexedDBStore'
import {
  pushSessionToSupabase,
  fetchSessionsFromSupabase,
  fetchSessionFromSupabase,
  deleteSessionFromSupabase,
} from './supabaseSync'

// ─────────────────────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────────────────────

export interface NewSessionParams {
  name: string
  auctionYear: number
  auctionType: 'mega' | 'mini'
  userFranchise: TeamId
  difficulty: 'easy' | 'normal' | 'hard'
  initialState: GameState
}

export async function createSession(params: NewSessionParams): Promise<GameSession> {
  const now = new Date().toISOString()
  const session: GameSession = {
    id: uuidv4(),
    name: params.name,
    auctionYear: params.auctionYear,
    auctionType: params.auctionType,
    userFranchise: params.userFranchise,
    difficulty: params.difficulty,
    state: params.initialState,
    createdAt: now,
    updatedAt: now,
  }

  await saveSessionLocally(session)
  void pushSessionToSupabase(session) // fire-and-forget

  return session
}

// ─────────────────────────────────────────────────────────────────────────────
// Save (update existing)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveSession(session: GameSession, newState: GameState): Promise<GameSession> {
  const updated: GameSession = {
    ...session,
    state: newState,
    updatedAt: new Date().toISOString(),
  }

  await saveSessionLocally(updated)
  void pushSessionToSupabase(updated) // fire-and-forget

  return updated
}

// ─────────────────────────────────────────────────────────────────────────────
// Load
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads a session. Prefers local IndexedDB; falls back to Supabase if missing locally.
 * Reconciles by taking the newer updatedAt timestamp.
 */
export async function loadSession(sessionId: string): Promise<GameSession | null> {
  const local = await loadSessionLocally(sessionId)
  const remote = await fetchSessionFromSupabase(sessionId)

  if (!local && !remote) return null
  if (!local) return remote
  if (!remote) return local

  // Take whichever is newer
  const localDate = new Date(local.updatedAt).getTime()
  const remoteDate = new Date(remote.updatedAt).getTime()
  const winner = remoteDate > localDate ? remote : local

  // Ensure local copy is current
  if (remoteDate > localDate) {
    await saveSessionLocally(remote)
  }

  return winner
}

// ─────────────────────────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists all sessions. Merges local + remote, deduplicating by id, taking newest updatedAt.
 */
export async function listSessions(): Promise<SessionMeta[]> {
  const [local, remote] = await Promise.all([
    listSessionsLocally(),
    fetchSessionsFromSupabase(),
  ])

  const merged = new Map<string, SessionMeta>()

  for (const s of [...local, ...remote]) {
    const existing = merged.get(s.id)
    if (!existing || new Date(s.updatedAt) > new Date(existing.updatedAt)) {
      merged.set(s.id, s)
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteSession(sessionId: string): Promise<void> {
  await deleteSessionLocally(sessionId)
  void deleteSessionFromSupabase(sessionId) // fire-and-forget
}
