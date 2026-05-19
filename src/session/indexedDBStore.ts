/**
 * IndexedDB store — local-first session persistence via `idb`.
 * Every game state change is written here instantly (non-blocking).
 * Supabase sync runs asynchronously in the background.
 */

import { openDB, type IDBPDatabase } from 'idb'
import type { GameSession, SessionMeta } from '@/types/session'

const DB_NAME = 'ipl-auction-simulator'
const DB_VERSION = 1
const SESSIONS_STORE = 'sessions'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          const store = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' })
          store.createIndex('updatedAt', 'updatedAt')
        }
      },
    })
  }
  return dbPromise
}

export async function saveSessionLocally(session: GameSession): Promise<void> {
  const db = await getDB()
  await db.put(SESSIONS_STORE, session)
}

export async function loadSessionLocally(sessionId: string): Promise<GameSession | undefined> {
  const db = await getDB()
  return db.get(SESSIONS_STORE, sessionId)
}

export async function listSessionsLocally(): Promise<SessionMeta[]> {
  const db = await getDB()
  const all = await db.getAll(SESSIONS_STORE) as GameSession[]
  return all
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(s => ({
      id: s.id,
      name: s.name,
      auctionYear: s.auctionYear,
      auctionType: s.auctionType,
      userFranchise: s.userFranchise,
      difficulty: s.difficulty,
      phase: s.state.phase,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }))
}

export async function deleteSessionLocally(sessionId: string): Promise<void> {
  const db = await getDB()
  await db.delete(SESSIONS_STORE, sessionId)
}

export async function clearAllSessionsLocally(): Promise<void> {
  const db = await getDB()
  await db.clear(SESSIONS_STORE)
}
