/**
 * OpenRouter API client — tiered model strategy with auto-discovery.
 *
 * On first call, fetches the live model list from OpenRouter and picks the
 * best available free models automatically. This survives model deprecations.
 *
 * FREE tier  (regular bidding):      auto-selected free model
 * SMART tier (high-stakes moments):  best available free model with higher context
 *   Used for: RTM decisions, bids >₹10Cr, trade evaluations
 */

const API_URL    = 'https://openrouter.ai/api/v1/chat/completions'
const MODELS_URL = 'https://openrouter.ai/api/v1/models'
const TIMEOUT_MS    = 8000
const MAX_RETRIES   = 1
const THROTTLE_MS   = 1500  // 1.5s stagger between call starts
const MAX_CONCURRENT = 3    // allow up to 3 parallel calls (pre-loader fires them all at once)

// Preferred model IDs in priority order — first one available wins
const PREFERRED_FREE_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'deepseek/deepseek-v4-flash:free',
  'google/gemma-4-31b-it:free',
  'mistralai/mistral-7b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'openchat/openchat-7b:free',
  'nousresearch/nous-capybara-7b:free',
]

// ─── Model auto-discovery ─────────────────────────────────────────────────────

let resolvedPrimary: string | null = null
let resolvedSmart: string | null = null
let modelDiscoveryPromise: Promise<void> | null = null

async function discoverModels(): Promise<void> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  if (!apiKey) return

  try {
    const res = await fetch(MODELS_URL, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      console.warn('[LLM] Could not fetch model list — using fallback IDs')
      resolvedPrimary = PREFERRED_FREE_MODELS[2] ?? null
      resolvedSmart   = PREFERRED_FREE_MODELS[0] ?? null
      return
    }

    const data = await res.json() as { data: { id: string; pricing?: { prompt: string } }[] }
    const available = new Set(data.data.map(m => m.id))

    console.log('[LLM] Available free models on this account:',
      PREFERRED_FREE_MODELS.filter(id => available.has(id)))

    resolvedPrimary = PREFERRED_FREE_MODELS.find(id => available.has(id)) ?? null
    // Smart = highest-priority model that's different from primary (or same if only one)
    resolvedSmart = PREFERRED_FREE_MODELS.find(id => available.has(id) && id !== resolvedPrimary)
      ?? resolvedPrimary

    console.log(`[LLM] Selected primary: ${resolvedPrimary}`)
    console.log(`[LLM] Selected smart:   ${resolvedSmart}`)
  } catch {
    console.warn('[LLM] Model discovery failed — using first preferred ID')
    resolvedPrimary = PREFERRED_FREE_MODELS[2] ?? null
    resolvedSmart   = PREFERRED_FREE_MODELS[0] ?? null
  }
}

async function ensureModelsResolved(): Promise<void> {
  if (resolvedPrimary) return
  if (!modelDiscoveryPromise) {
    modelDiscoveryPromise = discoverModels()
  }
  await modelDiscoveryPromise
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

let lastCallTime = 0
let inFlight = 0

async function waitForThrottle(): Promise<void> {
  // Wait if at concurrency limit
  while (inFlight >= MAX_CONCURRENT) {
    await new Promise(r => setTimeout(r, 200))
  }
  // Stagger call starts to avoid bursting all at once
  const elapsed = Date.now() - lastCallTime
  if (elapsed < THROTTLE_MS) {
    await new Promise(r => setTimeout(r, THROTTLE_MS - elapsed))
  }
  lastCallTime = Date.now()
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMCallOptions {
  model?: string
  maxTokens?: number
  temperature?: number
}

export async function callLLM(
  messages: ChatMessage[],
  options: LLMCallOptions = {},
): Promise<string | null> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  if (!apiKey) return null

  await ensureModelsResolved()
  await waitForThrottle()

  const model = options.model ?? resolvedPrimary ?? PREFERRED_FREE_MODELS[0]
  console.log(`[LLM] calling OpenRouter (model: ${model})`)
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
          console.warn('[LLM] Rate limited (429) — waiting 5s before retry')
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 5000))
            lastCallTime = Date.now()
            continue
          }
          return null
        }

        if (res.status === 404) {
          // Model no longer available — force re-discovery on next call
          console.warn(`[LLM] Model ${model} not found (404) — triggering re-discovery`)
          resolvedPrimary = null
          resolvedSmart = null
          modelDiscoveryPromise = null
          return null
        }

        if (!res.ok) {
          const body = await res.text()
          console.warn(`[LLM] HTTP ${res.status} from OpenRouter:`, body.slice(0, 200))
          return null
        }

        const data = await res.json() as {
          choices?: { message?: { content?: string | null }; text?: string }[]
          error?: { message: string }
        }

        if (data.error) {
          console.warn('[LLM] OpenRouter error:', data.error.message)
          return null
        }

        // Some models return content as null with finish_reason=stop — try text field too
        const content =
          data.choices?.[0]?.message?.content ??
          data.choices?.[0]?.text ??
          null

        if (!content) {
          console.warn('[LLM] Empty content — full response:', JSON.stringify(data).slice(0, 300))
          return null
        }

        console.log('[LLM] response received:', content.slice(0, 80))
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

export async function callLLMJson<T>(
  messages: ChatMessage[],
  options: LLMCallOptions = {},
): Promise<T | null> {
  const raw = await callLLM(messages, options)
  if (!raw) return null
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

/**
 * High-stakes call — uses the best available smart model.
 * Falls back to primary model if smart call fails.
 * Use for: RTM decisions, bids above ₹10 Cr, trade evaluations.
 */
export async function callLLMJsonSmart<T>(
  messages: ChatMessage[],
  options: Omit<LLMCallOptions, 'model'> = {},
): Promise<T | null> {
  await ensureModelsResolved()
  const smartModel = resolvedSmart ?? resolvedPrimary ?? PREFERRED_FREE_MODELS[0]
  console.log(`[LLM] HIGH-STAKES call — using smart model (${smartModel})`)
  const result = await callLLMJson<T>(messages, { ...options, model: smartModel })
  if (result !== null) return result
  console.warn('[LLM] Smart model failed — falling back to primary')
  return callLLMJson<T>(messages, options)
}

/** Fetch the live model list and log which free models are available for debugging. */
export async function debugAvailableModels(): Promise<void> {
  await discoverModels()
}

/** Test the API key with a minimal call. Returns true if working. */
export async function testAPIKey(): Promise<boolean> {
  await ensureModelsResolved()
  const result = await callLLMJson<{ ok: boolean }>(
    [{ role: 'user', content: 'Reply with exactly: {"ok":true}' }],
    { maxTokens: 16, temperature: 0 },
  )
  return result?.ok === true
}
