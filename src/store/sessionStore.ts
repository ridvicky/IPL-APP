import { create } from 'zustand'
import type { GameSession, SessionMeta } from '@/types/session'
import {
  listSessions,
  loadSession,
  deleteSession,
} from '@/session/sessionManager'

interface SessionStoreState {
  sessions: SessionMeta[]
  activeSession: GameSession | null
  loadingSessions: boolean
  loadingSession: boolean

  fetchSessions: () => Promise<void>
  openSession: (sessionId: string) => Promise<GameSession | null>
  setActiveSession: (session: GameSession | null) => void
  removeSession: (sessionId: string) => Promise<void>
}

export const useSessionStore = create<SessionStoreState>((set) => ({
  sessions: [],
  activeSession: null,
  loadingSessions: false,
  loadingSession: false,

  fetchSessions: async () => {
    set({ loadingSessions: true })
    const sessions = await listSessions()
    set({ sessions, loadingSessions: false })
  },

  openSession: async (sessionId) => {
    set({ loadingSession: true })
    const session = await loadSession(sessionId)
    set({ activeSession: session, loadingSession: false })
    return session
  },

  setActiveSession: (session) => {
    set({ activeSession: session })
  },

  removeSession: async (sessionId) => {
    await deleteSession(sessionId)
    set(state => ({
      sessions: state.sessions.filter(s => s.id !== sessionId),
      activeSession:
        state.activeSession?.id === sessionId ? null : state.activeSession,
    }))
  },
}))
