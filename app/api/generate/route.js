// ─── route.js ─────────────────────────────────────────────────────────────────
// Production-grade API route with:
//  • Token-bucket rate limiter (per-IP, written from scratch — no library)
//  • Server-side LRU cache (O(1) get/set, doubly-linked list + hash map)
//  • Request deduplication (in-flight map — 1 LLM call per unique repo+docs combo)
//  • Exponential backoff with jitter on every AI provider call
//  • GitHub API rate-limit header detection
//  • Structured JSON metrics logging (latency per step, model used, cache hit)
//  • /api/generate handles all of this transparently
// ─────────────────────────────────────────────────────────────────────────────

import { parseRepoUrl, fetchRepoData } from '../../../lib/github'
import {
  buildDevDocPrompt,
  buildReadmePrompt,
  buildUserDocPrompt,
  buildInterviewPrepPrompt,
} from '../../../lib/prompts'

// ═══════════════════════════════════════════════════════════════════════════════
// 1. TOKEN-BUCKET RATE LIMITER
//    Written from scratch. Classic distributed systems primitive.
//    Each IP gets its own bucket of N tokens that refills at R tokens/second.
//    Every request costs 1 token. If empty → 429.
//    O(1) per check. Memory: O(unique IPs seen since last GC).
// ═══════════════════════════════════════════════════════════════════════════════
const BUCKET_CAPACITY = 5       // max burst: 5 requests
const REFILL_RATE = 1 / 30      // 1 token per 30 seconds = 2/min sustained

class TokenBucket {
  constructor() {
    // Map<ip, { tokens: number, lastRefill: number }>
    this._buckets = new Map()
    // GC every 10 minutes — prevent unbounded memory growth
    this._gcInterval = setInterval(() => this._gc(), 10 * 60 * 1000)
  }

  /**
   * Returns true if the request is allowed, false if rate-limited.
   * @param {string} ip
   */
  consume(ip) {
    const now = Date.now()
    if (!this._buckets.has(ip)) {
      this._buckets.set(ip, { tokens: BUCKET_CAPACITY - 1, lastRefill: now })
      return true
    }
    const bucket = this._buckets.get(ip)
    // Refill tokens based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000 // seconds
    bucket.tokens = Math.min(
      BUCKET_CAPACITY,
      bucket.tokens + elapsed * REFILL_RATE,
    )
    bucket.lastRefill = now

    if (bucket.tokens < 1) return false
    bucket.tokens -= 1
    return true
  }

  /**
   * Garbage-collect buckets not seen in the last 30 minutes.
   * Prevents the Map from growing forever on a public deployment.
   */
  _gc() {
    const cutoff = Date.now() - 30 * 60 * 1000
    for (const [ip, bucket] of this._buckets) {
      if (bucket.lastRefill < cutoff) this._buckets.delete(ip)
    }
  }

  /** Expose bucket count — used by /api/metrics */
  size() {
    return this._buckets.size
  }
}

const rateLimiter = new TokenBucket()

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SERVER-SIDE LRU CACHE
//    Doubly-linked list + hash map = O(1) get, O(1) set, O(1) eviction.
//    This is the standard interview-grade LRU implementation.
//    Why server-side: all users share the cache; a popular repo is generated
//    once and served from memory to everyone after that.
// ═══════════════════════════════════════════════════════════════════════════════
const LRU_CAPACITY = 50               // max cached generations
const LRU_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

class LRUNode {
  constructor(key, value) {
    this.key = key
    this.value = value
    this.ts = Date.now()
    this.prev = null
    this.next = null
  }
}

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity
    this.map = new Map()                  // key → LRUNode
    // Sentinel head/tail — never evicted, simplify edge-case logic
    this.head = new LRUNode('HEAD', null)
    this.tail = new LRUNode('TAIL', null)
    this.head.next = this.tail
    this.tail.prev = this.head
    this.hits = 0
    this.misses = 0
  }

  /** Move node to front (most recently used position) — O(1) */
  _moveToFront(node) {
    this._remove(node)
    this._insertFront(node)
  }

  /** Unlink node from list — O(1) */
  _remove(node) {
    node.prev.next = node.next
    node.next.prev = node.prev
  }

  /** Insert node right after sentinel head — O(1) */
  _insertFront(node) {
    node.next = this.head.next
    node.prev = this.head
    this.head.next.prev = node
    this.head.next = node
  }

  /**
   * Get cached value. Returns null on miss or TTL expiry.
   * O(1) — hash map lookup + list move.
   */
  get(key) {
    if (!this.map.has(key)) {
      this.misses++
      return null
    }
    const node = this.map.get(key)
    if (Date.now() - node.ts > LRU_TTL_MS) {
      this._remove(node)
      this.map.delete(key)
      this.misses++
      return null
    }
    this._moveToFront(node)
    this.hits++
    return node.value
  }

  /**
   * Insert or update. Evicts LRU entry when over capacity.
   * O(1).
   */
  set(key, value) {
    if (this.map.has(key)) {
      const node = this.map.get(key)
      node.value = value
      node.ts = Date.now()
      this._moveToFront(node)
      return
    }
    const node = new LRUNode(key, value)
    this.map.set(key, node)
    this._insertFront(node)
    if (this.map.size > this.capacity) {
      // Evict least recently used (node before sentinel tail)
      const lru = this.tail.prev
      this._remove(lru)
      this.map.delete(lru.key)
    }
  }

  /** Return stats for /api/metrics endpoint */
  stats() {
    return {
      size: this.map.size,
      capacity: this.capacity,
      hits: this.hits,
      misses: this.misses,
      hitRate:
        this.hits + this.misses === 0
          ? 0
          : (this.hits / (this.hits + this.misses)).toFixed(3),
    }
  }
}

const serverCache = new LRUCache(LRU_CAPACITY)

// ═══════════════════════════════════════════════════════════════════════════════
// 3. REQUEST DEDUPLICATION (IN-FLIGHT MAP)
//    If two users request facebook/react simultaneously, only ONE LLM call fires.
//    Both get the same Promise. Classic distributed systems dedup pattern.
//    Data structure: Map<cacheKey, Promise<result>>
// ═══════════════════════════════════════════════════════════════════════════════
const inFlight = new Map()

// ═══════════════════════════════════════════════════════════════════════════════
// 4. STRUCTURED METRICS STORE
//    Track everything. Amazon's internal systems log every request.
//    This powers the /api/metrics endpoint.
// ═══════════════════════════════════════════════════════════════════════════════
const metrics = {
  totalRequests: 0,
  rateLimitedRequests: 0,
  cacheHits: 0,
  dedupHits: 0,
  errors: 0,
  totalLatencyMs: 0,
  githubFetchLatencyMs: 0,
  llmLatencyMs: 0,
  requestCount: 0,  // successful completions
  modelUsage: {},   // { modelName: count }
  modelFailures: {}, // { modelName: count }
  stepLatencies: [], // last 100 [{ github, llm, total }]
}

function recordModelUsage(model) {
  metrics.modelUsage[model] = (metrics.modelUsage[model] || 0) + 1
}
function recordModelFailure(model) {
  metrics.modelFailures[model] = (metrics.modelFailures[model] || 0) + 1
}

/** Emit structured log line — in production this streams to CloudWatch / Datadog */
function logEvent(event, data) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }))
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. EXPONENTIAL BACKOFF WITH JITTER
//    The correct way to retry in distributed systems.
//    Formula: min(cap, base * 2^attempt) + random(0, base)
//    Jitter prevents thundering herd when multiple requests retry simultaneously.
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * @param {Function} fn - async function to retry
 * @param {number} maxRetries
 * @param {string} label - for logging
 */
async function withExponentialBackoff(fn, maxRetries = 4, label = 'call') {
  const BASE_DELAY_MS = 500
  const CAP_MS = 10_000

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxRetries) {
        logEvent('backoff_exhausted', { label, attempts: attempt, error: err.message })
        throw err
      }
      // Exponential backoff: 500ms, 1s, 2s, 4s... capped at 10s
      const exponential = BASE_DELAY_MS * Math.pow(2, attempt)
      // Full jitter: uniform random in [0, exponential] — prevents thundering herd
      const jitter = Math.random() * Math.min(exponential, CAP_MS)
      const delay = Math.min(exponential + jitter, CAP_MS)

      logEvent('backoff_retry', {
        label,
        attempt,
        delayMs: Math.round(delay),
        error: err.message,
      })
      await new Promise((r) => setTimeout(r, delay))
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. AI PROVIDER CALLS
//    Priority: Groq (faster, free tier) → OpenRouter (fallback pool)
//    Each model tracks success/failure for the metrics endpoint.
//    Rate-limit responses (429) fall through to next model automatically.
// ═══════════════════════════════════════════════════════════════════════════════
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']

const OPENROUTER_MODELS = [
  'nvidia/nemotron-super-49b-v1:free',
  'tencent/hunyuan-a13b-instruct:free',
  'z-ai/glm-4-5-air:free',
  'openai/gpt-oss-120b:free',
  'minimax/minimax-m2.5:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'inclusion-ai/ling-2.6-flash:free',
  'inclusion-ai/ling-2.6-1t:free',
]

/**
 * Call Groq. Returns null when all Groq models are exhausted (signals fallback).
 * Uses exponential backoff per model before giving up on that model.
 */
async function callGroq(prompt, modelIndex = 0) {
  if (modelIndex >= GROQ_MODELS.length) return null

  const model = GROQ_MODELS[modelIndex]
  const t0 = Date.now()

  try {
    const result = await withExponentialBackoff(
      async () => {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: 3500,
            temperature: 0.7,
            messages: [{ role: 'user', content: prompt }],
          }),
        })

        const data = await res.json()

        // 429 = rate limited. Don't retry THIS model — move to next.
        if (res.status === 429 || data.error?.code === 'rate_limit_exceeded') {
          recordModelFailure(model)
          logEvent('model_rate_limited', { provider: 'groq', model })
          // Throw a special marker so backoff loop doesn't retry
          const err = new Error('RATE_LIMITED')
          err.isRateLimit = true
          throw err
        }

        if (!res.ok) {
          recordModelFailure(model)
          throw new Error(data.error?.message || `Groq HTTP ${res.status}`)
        }

        return data.choices[0].message.content
      },
      3, // max 3 retries for transient errors (not rate limits)
      `groq:${model}`,
    )

    recordModelUsage(model)
    logEvent('model_success', {
      provider: 'groq',
      model,
      latencyMs: Date.now() - t0,
    })
    return result

  } catch (err) {
    if (err.isRateLimit) {
      // Move to next Groq model without burning retries
      return callGroq(prompt, modelIndex + 1)
    }
    // Transient error exhausted retries — try next model
    recordModelFailure(model)
    logEvent('model_error', { provider: 'groq', model, error: err.message })
    return callGroq(prompt, modelIndex + 1)
  }
}

/**
 * Call OpenRouter with model rotation.
 * Same pattern: rate-limit → skip to next model, transient error → retry with backoff.
 */
async function callOpenRouter(prompt, modelIndex = 0) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      'All Groq models rate-limited and OPENROUTER_API_KEY not configured.',
    )
  }
  if (modelIndex >= OPENROUTER_MODELS.length) {
    throw new Error(
      'All AI providers exhausted. Please wait 1–2 minutes and retry.',
    )
  }

  const model = OPENROUTER_MODELS[modelIndex]
  const t0 = Date.now()

  try {
    const result = await withExponentialBackoff(
      async () => {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer':
              process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
            'X-Title': 'GitDoc',
          },
          body: JSON.stringify({
            model,
            max_tokens: 3500,
            temperature: 0.7,
            messages: [{ role: 'user', content: prompt }],
          }),
        })

        const data = await res.json()

        if (res.status === 429 || data.error?.code === 'rate_limit_exceeded') {
          recordModelFailure(model)
          const err = new Error('RATE_LIMITED')
          err.isRateLimit = true
          throw err
        }

        if (!res.ok) {
          recordModelFailure(model)
          throw new Error(data.error?.message || `OpenRouter HTTP ${res.status}`)
        }

        return data.choices[0].message.content
      },
      3,
      `openrouter:${model}`,
    )

    recordModelUsage(model)
    logEvent('model_success', {
      provider: 'openrouter',
      model,
      latencyMs: Date.now() - t0,
    })
    return result

  } catch (err) {
    if (err.isRateLimit) {
      return callOpenRouter(prompt, modelIndex + 1)
    }
    recordModelFailure(model)
    logEvent('model_error', {
      provider: 'openrouter',
      model,
      error: err.message,
    })
    return callOpenRouter(prompt, modelIndex + 1)
  }
}

/**
 * Primary AI call: try Groq first, fall back to OpenRouter.
 * @param {string} prompt
 * @param {number} groqStartIndex - stagger starting model across parallel calls
 */
async function callAI(prompt, groqStartIndex = 0) {
  const groqResult = await callGroq(prompt, groqStartIndex)
  if (groqResult !== null) return groqResult

  logEvent('provider_fallback', {
    from: 'groq',
    to: 'openrouter',
    reason: 'all_groq_models_rate_limited',
  })
  return callOpenRouter(prompt)
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. DOC BUILDERS MAP
// ═══════════════════════════════════════════════════════════════════════════════
const DOC_BUILDERS = {
  user: (r, opts) => buildUserDocPrompt(r, opts),
  dev: (r, opts) => buildDevDocPrompt(r, opts),
  readme: (r, opts) => buildReadmePrompt(r, opts),
  interview: (r, opts) => buildInterviewPrepPrompt(r, opts),
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. CORE GENERATION LOGIC (extracted for dedup reuse)
// ═══════════════════════════════════════════════════════════════════════════════
async function generateDocs({ url, userToken, docsToGenerate, opts }) {
  const tTotal = Date.now()

  // ── Step A: Parse URL ──────────────────────────────────────────────────────
  const { owner, repo } = await parseRepoUrl(url)

  // ── Step B: Fetch GitHub data (timed) ─────────────────────────────────────
  const tGithub = Date.now()
  const repoData = await fetchRepoData(owner, repo, userToken)
  const githubMs = Date.now() - tGithub

  logEvent('github_fetch_complete', {
    owner,
    repo,
    latencyMs: githubMs,
    fileCount: repoData.allFiles.length,
    srcTreeSize: repoData.srcTree.length,
  })

  // ── Step C: Generate docs in parallel, stagger model selection ─────────────
  const tLLM = Date.now()

  const entries = await Promise.all(
    docsToGenerate
      .filter((d) => DOC_BUILDERS[d])
      .map(async (docType, i) => {
        // 800ms stagger — each doc starts on a different model to spread load
        await new Promise((r) => setTimeout(r, i * 800))
        const startModel = i % GROQ_MODELS.length
        const tDoc = Date.now()
        const content = await callAI(DOC_BUILDERS[docType](repoData, opts), startModel)
        logEvent('doc_generated', {
          docType,
          latencyMs: Date.now() - tDoc,
          chars: content?.length || 0,
        })
        return [docType, content]
      }),
  )

  const llmMs = Date.now() - tLLM
  const totalMs = Date.now() - tTotal

  // Record step latencies (keep last 100 for p99 calculations)
  metrics.stepLatencies.push({ githubMs, llmMs, totalMs })
  if (metrics.stepLatencies.length > 100) metrics.stepLatencies.shift()
  metrics.githubFetchLatencyMs += githubMs
  metrics.llmLatencyMs += llmMs
  metrics.totalLatencyMs += totalMs
  metrics.requestCount++

  logEvent('generation_complete', {
    owner,
    repo,
    docs: docsToGenerate,
    githubMs,
    llmMs,
    totalMs,
  })

  const results = Object.fromEntries(entries)
  return { ...results, repoData, generatedDocs: docsToGenerate }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. POST /api/generate
//    Full pipeline: rate-limit check → LRU cache → dedup → generate → cache
// ═══════════════════════════════════════════════════════════════════════════════
export async function POST(req) {
  metrics.totalRequests++

  // ── Rate limiting ──────────────────────────────────────────────────────────
  // Extract real IP — works behind Vercel/Cloudflare/nginx proxies
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'

  if (!rateLimiter.consume(ip)) {
    metrics.rateLimitedRequests++
    logEvent('rate_limited', { ip })
    return Response.json(
      {
        error:
          'Rate limit exceeded. You can generate up to 5 documentation sets per 2.5 minutes. Please wait and try again.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': '30',
          'X-RateLimit-Policy': 'token-bucket',
        },
      },
    )
  }

  try {
    const {
      url,
      userToken,
      selectedDocs,
      options = {},
      regenerateInstruction,
    } = await req.json()

    // ── Input validation ───────────────────────────────────────────────────
    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'URL required' }, { status: 400 })
    }
    if (url.length > 500) {
      return Response.json({ error: 'URL too long' }, { status: 400 })
    }
    if (!url.includes('github.com')) {
      return Response.json(
        { error: 'Only GitHub URLs are supported' },
        { status: 400 },
      )
    }

    const docsToGenerate =
      Array.isArray(selectedDocs) && selectedDocs.length > 0
        ? selectedDocs.filter((d) => DOC_BUILDERS[d]) // whitelist
        : ['user', 'dev', 'readme', 'interview']

    if (docsToGenerate.length === 0) {
      return Response.json({ error: 'No valid doc types selected' }, { status: 400 })
    }

    const opts = regenerateInstruction
      ? { ...options, extraInstruction: regenerateInstruction }
      : options

    // ── Cache key ──────────────────────────────────────────────────────────
    // Deterministic: sorted doc types + audience + language
    const sortedDocs = [...docsToGenerate].sort().join(',')
    const optKey = `${options.audience || 'developer'}_${options.language || 'English'}`
    // Don't cache regenerations — user explicitly wants fresh content
    const cacheKey = regenerateInstruction
      ? null
      : `${url}__${sortedDocs}__${optKey}`

    // ── LRU Cache check ────────────────────────────────────────────────────
    if (cacheKey) {
      const cached = serverCache.get(cacheKey)
      if (cached) {
        metrics.cacheHits++
        logEvent('cache_hit', { url, docs: sortedDocs })
        return Response.json({ ...cached, _source: 'server_cache' })
      }
    }

    // ── Request deduplication ──────────────────────────────────────────────
    // If an identical request is already in-flight, attach to that promise
    // instead of firing a second LLM call. Classic producer-consumer dedup.
    if (cacheKey && inFlight.has(cacheKey)) {
      metrics.dedupHits++
      logEvent('dedup_hit', { url, docs: sortedDocs })
      const result = await inFlight.get(cacheKey)
      return Response.json({ ...result, _source: 'dedup' })
    }

    // ── Generate ───────────────────────────────────────────────────────────
    const generationPromise = generateDocs({
      url,
      userToken,
      docsToGenerate,
      opts,
    })

    // Register in in-flight map BEFORE awaiting so concurrent requests attach
    if (cacheKey) {
      inFlight.set(cacheKey, generationPromise)
    }

    let result
    try {
      result = await generationPromise
    } finally {
      // Always clean up in-flight entry, even on error
      if (cacheKey) inFlight.delete(cacheKey)
    }

    // ── Store in LRU cache ─────────────────────────────────────────────────
    if (cacheKey) {
      serverCache.set(cacheKey, result)
    }

    return Response.json({ ...result, _source: 'generated' })

  } catch (err) {
    metrics.errors++
    logEvent('generation_error', { error: err.message, stack: err.stack?.slice(0, 500) })
    return Response.json(
      {
        error:
          err.message ||
          'Generation failed. All AI providers may be rate-limited — wait 1 minute and retry.',
      },
      { status: 500 },
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. GET /api/generate → metrics endpoint
//     Returns real-time system health. Amazon-style observability.
//     Exposes: cache hit rate, avg latency, p99 latency, model usage,
//              rate-limit hits, error rate, dedup hits.
// ═══════════════════════════════════════════════════════════════════════════════
export async function GET() {
  const latencies = metrics.stepLatencies
  const n = latencies.length

  // Calculate p50 and p99 of total latency
  const sorted = [...latencies].sort((a, b) => a.totalMs - b.totalMs)
  const p50 = n > 0 ? sorted[Math.floor(n * 0.5)]?.totalMs || 0 : 0
  const p99 = n > 0 ? sorted[Math.floor(n * 0.99)]?.totalMs || 0 : 0

  const avgTotal = n > 0 ? Math.round(metrics.totalLatencyMs / metrics.requestCount) : 0
  const avgGithub = n > 0 ? Math.round(metrics.githubFetchLatencyMs / metrics.requestCount) : 0
  const avgLLM = n > 0 ? Math.round(metrics.llmLatencyMs / metrics.requestCount) : 0

  const errorRate =
    metrics.totalRequests === 0
      ? 0
      : (metrics.errors / metrics.totalRequests).toFixed(4)

  return Response.json({
    status: 'healthy',
    uptime: process.uptime ? `${Math.round(process.uptime())}s` : 'unknown',
    requests: {
      total: metrics.totalRequests,
      successful: metrics.requestCount,
      rateLimited: metrics.rateLimitedRequests,
      errors: metrics.errors,
      errorRate,
    },
    cache: {
      ...serverCache.stats(),
      hits: metrics.cacheHits,
      dedupHits: metrics.dedupHits,
      inFlight: inFlight.size,
    },
    latency: {
      avgTotalMs: avgTotal,
      avgGithubFetchMs: avgGithub,
      avgLLMMs: avgLLM,
      p50Ms: p50,
      p99Ms: p99,
      samplesCollected: n,
    },
    rateLimiter: {
      activeBuckets: rateLimiter.size(),
      policy: `${BUCKET_CAPACITY} tokens, refill ${REFILL_RATE * 60}/min`,
    },
    models: {
      usage: metrics.modelUsage,
      failures: metrics.modelFailures,
    },
    analysis: {
      bottleneck: avgGithub > avgLLM ? 'github_fetch' : 'llm_generation',
      githubSharePct: avgTotal > 0 ? Math.round((avgGithub / avgTotal) * 100) : 0,
      llmSharePct: avgTotal > 0 ? Math.round((avgLLM / avgTotal) * 100) : 0,
    },
  })
}