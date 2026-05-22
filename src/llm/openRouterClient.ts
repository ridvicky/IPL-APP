/**
 * OpenRouter API client — fixed 3-tier model strategy.
 *
 * STRATEGIC tier  — complex reasoning (Trade, Fight-or-Fold, RTM)
 * STANDARD tier   — bulk bidding decisions (Call 1, 9 teams in parallel)
 * FALLBACK tier   — always-available safety net
 */

const API_URL = 'https://openrouter.ai/api/v1/chat/completions'

// ─── Model tiers ──────────────────────────────────────────────────────────────

const MODEL_STRATEGIC = 'meta-llama/llama-3.3-70b-instruct'
const MODEL_STANDARD  = 'google/gemini-2.0-flash-exp:free'
const MODEL_FALLBACK  = 'google/gemma-2-9b-it:free'

// ─── Rate limiter ─────────────────────────────────────────────────────────────

const TIMEOUT_MS     = 8000
const MAX_RETRIES    = 1
const THROTTLE_MS    = 1500  // 1.5s stagger between call starts
const MAX_CONCURRENT = 3     // up to 3 parallel calls

let lastCallTime = 0
let inFlight = 0

async function waitForThrottle(): Promise<void> {
  while (inFlight >= MAX_CONCURRENT) {
    await new Promise(r => setTimeout(r, 200))
  }
  const elapsed = Date.now() - lastCallTime
  if (elapsed < THROTTLE_MS) {
    await new Promise(r => setTimeout(r, THROTTLE_MS - elapsed))
  }
  lastCallTime = Date.now()
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMCallOptions {
  model?: string
  maxTokens?: number
  temperature?: number
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

export async function callLLM(
  messages: ChatMessage[],
  options: LLMCallOptions = {},
): Promise<string | null> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  if (!apiKey) return null

  await waitForThrottle()

  const model = options.model ?? MODEL_STANDARD
  console.log(`[LLM] calling ${model.split('/').pop()}`)
  inFlight++

  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

        const res = await fetch(API_URL, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ipl-auction-sim.vercel.app',
            'X-Title': 'IPL Auction Simulator',
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: options.maxTokens ?? 256,
            temperature: options.temperature ?? 0.85,
          }),
        })

        clearTimeout(timeout)

        if (res.status === 429) {
          console.warn('[LLM] Rate limited (429) — waiting 5s')
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 5000))
            lastCallTime = Date.now()
            continue
          }
          return null
        }

        if (res.status === 404) {
          console.warn(`[LLM] Model not found (404): ${model}`)
          return null
        }

        if (!res.ok) {
          const body = await res.text()
          console.warn(`[LLM] HTTP ${res.status}:`, body.slice(0, 200))
          return null
        }

        const data = await res.json() as {
          choices?: { message?: { content?: string | null }; text?: string }[]
          error?: { message: string }
        }

        if (data.error) {
          console.warn('[LLM] Error:', data.error.message)
          return null
        }

        const content =
          data.choices?.[0]?.message?.content ??
          data.choices?.[0]?.text ??
          null

        if (!content) {
          console.warn('[LLM] Empty content:', JSON.stringify(data).slice(0, 200))
          return null
        }

        console.log('[LLM] ✓', content.slice(0, 60))
        return content
      } catch {
        if (attempt < MAX_RETRIES) continue
        return null
      }
    }
    return null
  } finally {
    inFlight--
  }
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

function parseJSON<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) as T } catch { return null }
    }
    return null
  }
}

/** Fast call — auctioneer commentary, non-critical text (uses free fallback model). */
export async function callLLMFast(
  messages: ChatMessage[],
  options: Omit<LLMCallOptions, 'model'> = {},
): Promise<string | null> {
  return callLLM(messages, { ...options, model: MODEL_FALLBACK })
}

/** Standard call — bulk bidding decisions (Call 1, 9 teams in parallel). */
export async function callLLMJson<T>(
  messages: ChatMessage[],
  options: Omit<LLMCallOptions, 'model'> = {},
): Promise<T | null> {
  const raw = await callLLM(messages, { ...options, model: MODEL_STANDARD })
  return raw ? parseJSON<T>(raw) : null
}

/**
 * Strategic call — complex reasoning (Fight-or-Fold, Trade, RTM).
 * Uses strongest model; falls back through STANDARD → FALLBACK.
 */
export async function callLLMJsonStrategic<T>(
  messages: ChatMessage[],
  options: Omit<LLMCallOptions, 'model'> = {},
): Promise<T | null> {
  console.log('[LLM] STRATEGIC call')
  const raw = await callLLM(messages, { ...options, model: MODEL_STRATEGIC })
  if (raw) {
    const parsed = parseJSON<T>(raw)
    if (parsed !== null) return parsed
  }
  // Fallback chain
  console.warn('[LLM] Strategic failed — trying standard')
  const raw2 = await callLLM(messages, { ...options, model: MODEL_STANDARD })
  if (raw2) {
    const parsed2 = parseJSON<T>(raw2)
    if (parsed2 !== null) return parsed2
  }
  console.warn('[LLM] Standard failed — trying fallback model')
  const raw3 = await callLLM(messages, { ...options, model: MODEL_FALLBACK })
  return raw3 ? parseJSON<T>(raw3) : null
}

/** @deprecated Use callLLMJsonStrategic for high-stakes calls. */
export const callLLMJsonSmart = callLLMJsonStrategic

/** Test the API key with a minimal call. */
export async function testAPIKey(): Promise<boolean> {
  const result = await callLLMJson<{ ok: boolean }>(
    [{ role: 'user', content: 'Reply with exactly: {"ok":true}' }],
    { maxTokens: 16, temperature: 0 },
  )
  return result?.ok === true
}
