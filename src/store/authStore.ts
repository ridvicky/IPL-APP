import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  setSession: (session: Session | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? error.message : null
  },

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return error ? error.message : null
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null })
  },

  setSession: (session) => {
    set({ session, user: session?.user ?? null, loading: false })
  },
}))

// Bootstrap: listen to auth state changes and populate the store
supabase.auth.getSession().then(({ data: { session } }) => {
  useAuthStore.getState().setSession(session)
})

supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.getState().setSession(session)
})
