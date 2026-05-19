/**
 * Supabase sync — background async push of local sessions to cloud.
 * Never blocks the UI. Failures are silently retried on the next save.
 */

import { supabase } from '@/lib/supabaseClient'
import type { GameSession, SessionMeta } from '@/types/session'

// ─────────────────────────────────────────────────────────────────────────────
// Push (upsert) one session to Supabase
// ─────────────────────────────────────────────────────────────────────────────

export async function pushSessionToSupabase(session: GameSession): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return // not signed in — local only

  const { error } = await supabase.from('game_sessions').upsert({
    id: session.id,
    user_id: user.id,
    name: session.name,
    auction_year: session.auctionYear,
    auction_type: session.auctionType,
    user_franchise: session.userFranchise,
    difficulty: session.difficulty,
    phase: (session.state as { phase: string }).phase,
    state_json: session.state,
    updated_at: session.updatedAt,
  }, { onConflict: 'id' })

  if (error) {
    console.warn('[SupabaseSync] Push failed:', error.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch session list from Supabase
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSessionsFromSupabase(): Promise<SessionMeta[]> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, name, auction_year, auction_type, user_franchise, difficulty, phase, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error || !data) {
    console.warn('[SupabaseSync] Fetch failed:', error?.message)
    return []
  }

  return data.map(row => ({
    id: row.id as string,
    name: row.name as string,
    auctionYear: row.auction_year as number,
    auctionType: row.auction_type as 'mega' | 'mini',
    userFranchise: row.user_franchise as string,
    difficulty: row.difficulty as 'easy' | 'normal' | 'hard',
    phase: row.phase as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch full session state from Supabase
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSessionFromSupabase(sessionId: string): Promise<GameSession | null> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (error || !data) {
    console.warn('[SupabaseSync] Fetch session failed:', error?.message)
    return null
  }

  return {
    id: data['id'] as string,
    name: data['name'] as string,
    auctionYear: data['auction_year'] as number,
    auctionType: data['auction_type'] as 'mega' | 'mini',
    userFranchise: data['user_franchise'] as string,
    difficulty: data['difficulty'] as 'easy' | 'normal' | 'hard',
    state: data['state_json'] as GameSession['state'],
    createdAt: data['created_at'] as string,
    updatedAt: data['updated_at'] as string,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete from Supabase
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteSessionFromSupabase(sessionId: string): Promise<void> {
  const { error } = await supabase.from('game_sessions').delete().eq('id', sessionId)
  if (error) {
    console.warn('[SupabaseSync] Delete failed:', error.message)
  }
}
