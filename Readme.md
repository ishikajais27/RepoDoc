# GitDoc — Auto Documentation Generator

> Drop a GitHub repo URL. Get production-grade documentation in 4 formats — for users, developers, README, and interview prep.

## System Architecture

```
User Request
    │
    ▼
Token Bucket Rate Limiter (per-IP, O(1))
    │ ← blocked → 429 + Retry-After header
    ▼
Server-side LRU Cache (doubly-linked list + hash map, O(1) get/set)
    │ ← hit → return cached result (avg <10ms)
    ▼
In-Flight Request Deduplication Map
    │ ← duplicate → attach to existing Promise
    ▼
Parallel GitHub API Fetch (5 concurrent requests)
    │ ← rate limit detected via X-RateLimit-Remaining header
    ▼
Parallel LLM Doc Generation (4 concurrent, 800ms staggered)
    │ ← Groq primary → OpenRouter fallback (8 models)
    │ ← exponential backoff with jitter on transient errors
    ▼
LRU Cache write + structured JSON metrics log
    │
    ▼
Response
```

## Engineering Decisions (The "Why" Behind Every Choice)

### 1. Token Bucket Rate Limiter (written from scratch)

**Why:** Protects against abuse and cost overruns. Also demonstrates the algorithm — Amazon interviews commonly ask "design a rate limiter."

**Implementation:** Classic token bucket. Each IP gets a bucket of 5 tokens. Tokens refill at 1/30 per second (2/min sustained). Every request consumes 1 token. If bucket is empty → 429 with Retry-After header.

**Complexity:** O(1) consume, O(unique IPs) space. GC runs every 10 minutes to evict stale buckets.

**Why not a library:** Implementing it directly demonstrates understanding of the algorithm, not just NPM dependency management.

### 2. Server-Side LRU Cache (doubly-linked list + hash map)

**Why:** Popular repos (facebook/react, expressjs/express) get requested repeatedly. Without caching, every user triggers a 35+ GitHub API call + 20-60s LLM generation. With server-side caching, the second request for the same repo returns in <10ms.

**Why server-side, not localStorage:** localStorage is per-user, per-browser. Server-side cache is shared across ALL users. One generation serves everyone.

**Complexity:** O(1) get, O(1) set, O(1) eviction. Standard interview-grade LRU using sentinel head/tail nodes.

**Capacity:** 50 entries, 7-day TTL. At ~50KB per result, memory cost is ~2.5MB max.

### 3. Request Deduplication (in-flight map)

**Why:** If 100 users request `facebook/react` simultaneously (e.g. after a viral post), only ONE LLM call fires. All 100 get the same Promise. Without this: 100 × $0.003 LLM cost = $0.30. With dedup: $0.003.

**Implementation:** `Map<cacheKey, Promise>`. Promise registered before awaiting, cleaned up in `finally` block.

### 4. Exponential Backoff with Jitter

**Why:** Naive retry (`if 429, try again`) causes thundering herd — all retries fire simultaneously, overwhelming the rate-limited provider.

**Formula:** `min(cap, base × 2^attempt) + random(0, exponential)` — the standard distributed systems solution.

**Values:** Base 500ms, cap 10s, max 4 retries. Jitter is full (uniform random in [0, exponential]).

### 5. GitHub Rate-Limit Header Detection

**Why:** GitHub's API returns `X-RateLimit-Remaining` on every response. Ignoring this header means your system fails silently when the limit hits. Reading it means you can warn users early and fail gracefully.

**Threshold:** Warn at <100 remaining, error at <10 remaining.

### 6. FILE_CONTENT_CAP = 3000 chars

**Why 3000, not 2000 or 5000?**

- Median JS/TS file relevant to documentation: ~100-200 lines = ~3000 chars at 20 chars/line
- We fetch up to 40 files: 40 × 3000 = 120k chars ≈ 30k tokens — within LLM context window
- Tested: increasing beyond 4000 adds noise, not signal — files become implementation detail, not architecture

### 7. Parallel with Staggered Model Selection

**Why parallel:** Sequential generation would be 4 × 30s = 2 minutes. Parallel = 30s total.

**Why stagger:** Starting all 4 doc types on the same model at the same millisecond hits the model's per-second token limit. 800ms stagger distributes load. Each doc type starts on a different model: `i % GROQ_MODELS.length`.

## Data Structures Used

| Data Structure                      | Where                    | Why                                              |
| ----------------------------------- | ------------------------ | ------------------------------------------------ |
| Doubly-linked list                  | LRU cache                | O(1) move-to-front for recently accessed entries |
| Hash map                            | LRU cache + rate limiter | O(1) key lookup                                  |
| Map<key, Promise>                   | Request deduplication    | O(1) in-flight check                             |
| Token bucket (float counter)        | Rate limiter             | Allows burst + sustained rate                    |
| Circular array (last 100 latencies) | Metrics                  | p50/p99 calculation without unbounded memory     |

## Measured Performance (run against 20 repos)

| Metric                            | Value                                     |
| --------------------------------- | ----------------------------------------- |
| GitHub fetch avg                  | ~3.2s (5 parallel API calls)              |
| LLM generation avg                | ~28s (4 docs, parallel)                   |
| Cache hit latency                 | <10ms                                     |
| Dedup hit latency                 | ~28s (attaches to in-flight)              |
| Error rate (LLM providers)        | ~12% (rate limits, recovered by fallback) |
| LRU cache hit rate (after warmup) | ~68% (popular repos requested repeatedly) |

**Bottleneck:** LLM generation (87% of wall time). GitHub fetch (11%). Everything else (<2%).

## System Design: Scale to 50,000 Users/Hour

Current system handles ~5 users/minute per deployment. To scale:

1. **GitHub API:** Token pool with round-robin. 50 tokens = 50 × 5000 = 250,000 req/hr. Request deduplication already halves effective load.

2. **LLM:** Move to async job queue (Redis + Bull). User submits job, polls for completion. Enables horizontal scaling of workers.

3. **Cache:** Move from in-memory to Redis. Shared across all server instances. Current LRU is per-process — not shared in multi-replica deployments.

4. **Rate limiter:** Move from in-memory Map to Redis with sliding window. Current token bucket is per-process — doesn't coordinate across instances.

5. **Result:** At 50k users/hour with these changes: 13 users/second. GitHub token pool handles it. LLM queue absorbs bursts. Redis cache serves repeated repos in <5ms.

## API Endpoints

### `POST /api/generate`

Generate documentation for a GitHub repository.

**Request:**

```json
{
  "url": "https://github.com/owner/repo",
  "selectedDocs": ["user", "dev", "readme", "interview"],
  "options": { "audience": "developer", "language": "English" },
  "userToken": "ghp_...",
  "regenerateInstruction": "focus on security aspects"
}
```

**Response headers:**

- `X-Source: generated | server_cache | dedup`

**Rate limit response (429):**

```json
{ "error": "Rate limit exceeded..." }
```

Headers: `Retry-After: 30`, `X-RateLimit-Policy: token-bucket`

### `GET /api/generate` (metrics)

Real-time system health. Returns:

```json
{
  "status": "healthy",
  "requests": { "total": 142, "rateLimited": 3, "errors": 1 },
  "cache": { "hitRate": "0.681", "size": 34, "capacity": 50 },
  "latency": { "avgTotalMs": 31200, "p50Ms": 28400, "p99Ms": 58900 },
  "analysis": { "bottleneck": "llm_generation", "llmSharePct": 87 },
  "models": { "usage": { "llama-3.3-70b-versatile": 89 }, "failures": { ... } }
}
```

## Setup

```bash
npm install

# .env.local
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...
GITHUB_TOKEN=ghp_...         # optional, raises rate limit from 60 → 5000 req/hr
NEXT_PUBLIC_SITE_URL=https://your-domain.com

npm run dev
```

## Testing

```bash
npm test  # runs github.test.js

# Tests cover:
# - parseRepoUrl: 10 cases (valid, .git suffix, query params, fragments, invalid)
# - LRUCache: 6 cases (get/set, eviction, promotion, update, capacity-1)
# - TokenBucket: 3 cases (first request, exhaustion, IP isolation)
```

## What Would Make This Production-Ready (Honest Assessment)

1. **Persistent cache** — current LRU resets on server restart. Redis would survive deploys.
2. **Async job queue** — LLM calls block the HTTP response for 30-60s. A queue with polling decouples this.
3. **Auth** — no user accounts means no per-user history, saved docs, or rate-limit exceptions.
4. **Test coverage** — current: ~19 unit tests on utilities. Missing: integration tests, E2E tests, LLM output quality tests.
5. **Distributed rate limiting** — current token bucket is per-process. Multi-instance deploys need Redis-backed rate limiting.

## Tech Stack

- **Next.js 14** (App Router) — chosen for React Server Components + API routes in one deployment
- **Groq** (primary LLM) — 70B Llama model, fastest inference available for free tier
- **OpenRouter** (fallback) — 8 free models, auto-rotated on rate limit
- **No database** — intentional; caching is sufficient for this use case
- **No auth** — intentional for demo; would add Clerk for production
