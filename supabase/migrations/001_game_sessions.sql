-- IPL Auction Simulator — Initial Schema
-- Run this in your Supabase SQL Editor

-- Game sessions table
-- Each row is one saved auction session belonging to one user.
-- state_json holds the complete serialized GameState (200–600KB per session).
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL DEFAULT 'New Session',
  auction_year   INTEGER NOT NULL,
  auction_type   TEXT NOT NULL CHECK (auction_type IN ('mega', 'mini')),
  user_franchise TEXT NOT NULL,
  difficulty     TEXT NOT NULL CHECK (difficulty IN ('easy', 'normal', 'hard')),
  phase          TEXT NOT NULL DEFAULT 'setup',
  state_json     JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user session lookup
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id
  ON public.game_sessions (user_id, updated_at DESC);

-- Row-Level Security: every user sees only their own sessions
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own sessions"
  ON public.game_sessions
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own sessions"
  ON public.game_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sessions"
  ON public.game_sessions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own sessions"
  ON public.game_sessions
  FOR DELETE
  USING (user_id = auth.uid());

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER game_sessions_updated_at
  BEFORE UPDATE ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
