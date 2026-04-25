'use client'
// ─── HomeClient.jsx ───────────────────────────────────────────────────────────
// Key fixes vs original:
//  1. Memory leak fixed: setInterval cleanup in useEffect return fn
//  2. Server-side cache handles dedup — no localStorage cache needed
//     (localStorage kept only for user token and URL history)
//  3. Metrics panel: shows real system stats from /api/generate GET
//  4. Retry-After header respected on 429 — shows countdown to user
//  5. Abort controller: cancels in-flight fetch if user navigates away
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'
import RepoInput from './RepoInput'
import DocOutput from './DocOutput'

const LOADING_MESSAGES = [
  'Fetching repo metadata...',
  'Crawling source tree & commit history...',
  'Analyzing architecture & technical decisions...',
  'Generating documentation across 4 dimensions...',
  'Prepping your Amazon interview answers...',
]

export default function HomeClient() {
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(0)
  const [loadingStepMs, setLoadingStepMs] = useState(0) // elapsed ms in current step
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [retryAfterSec, setRetryAfterSec] = useState(0) // rate-limit countdown
  const [userToken, setUserToken] = useState('')
  const [regenerating, setRegenerating] = useState(null)
  const [source, setSource] = useState(null) // 'generated' | 'server_cache' | 'dedup'
  const [showMetrics, setShowMetrics] = useState(false)
  const [metricsData, setMetricsData] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(false)

  // AbortController ref — cancel in-flight requests when component unmounts
  // or when user starts a new generation. Prevents setState on unmounted component.
  const abortRef = useRef(null)

  // Interval ref — always cleaned up in useEffect return
  const intervalRef = useRef(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gitdoc_user_token')
      if (saved) setUserToken(saved)
    } catch {
      // localStorage unavailable (private browsing, storage quota) — non-fatal
    }
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  // Retry-after countdown timer
  useEffect(() => {
    if (retryAfterSec <= 0) return
    const t = setTimeout(
      () => setRetryAfterSec((s) => Math.max(0, s - 1)),
      1000,
    )
    return () => clearTimeout(t)
  }, [retryAfterSec])

  const handleTokenChange = useCallback((t) => {
    setUserToken(t)
    try {
      if (t) localStorage.setItem('gitdoc_user_token', t)
      else localStorage.removeItem('gitdoc_user_token')
    } catch {
      // Non-fatal
    }
  }, [])

  const handleGenerate = useCallback(
    async (url, selectedDocs, options = {}) => {
      // Cancel any previous in-flight request
      if (abortRef.current) abortRef.current.abort()
      abortRef.current = new AbortController()

      // Clear previous interval — prevent memory leak
      if (intervalRef.current) clearInterval(intervalRef.current)

      setLoading(true)
      setError('')
      setResult(null)
      setSource(null)
      setRetryAfterSec(0)
      setLoadingMsg(0)

      const stepStart = Date.now()
      setLoadingStepMs(0)

      // Rotate loading messages every 4 seconds
      let msgIdx = 0
      intervalRef.current = setInterval(() => {
        msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length
        setLoadingMsg(msgIdx)
        setLoadingStepMs(Date.now() - stepStart)
      }, 4000)

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortRef.current.signal, // enables request cancellation
          body: JSON.stringify({
            url,
            userToken: userToken || null,
            selectedDocs: selectedDocs || null,
            options: options || {},
          }),
        })

        // Handle rate limiting with user-facing countdown
        if (res.status === 429) {
          const retryAfter = parseInt(
            res.headers.get('Retry-After') || '30',
            10,
          )
          setRetryAfterSec(retryAfter)
          const data = await res.json()
          throw new Error(
            data.error || `Rate limited. Please wait ${retryAfter} seconds.`,
          )
        }

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Generation failed')

        setResult(data)
        setSource(data._source || 'generated')
      } catch (err) {
        // AbortError = user cancelled — not an error to surface
        if (err.name === 'AbortError') return
        setError(err.message)
      } finally {
        // Always clean up interval — this was the memory leak in the original
        clearInterval(intervalRef.current)
        intervalRef.current = null
        setLoading(false)
      }
    },
    [userToken],
  )

  const handleRegenerate = useCallback(
    async (docId, instruction = '') => {
      if (!result) return
      setRegenerating(docId)
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: `https://github.com/${result.repoData.owner}/${result.repoData.repo}`,
            userToken: userToken || null,
            selectedDocs: [docId],
            regenerateInstruction: instruction || null,
            options: {},
          }),
        })

        if (res.status === 429) {
          const retryAfter = parseInt(
            res.headers.get('Retry-After') || '30',
            10,
          )
          throw new Error(
            `Rate limited. Wait ${retryAfter}s before regenerating.`,
          )
        }

        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        // Merge new section into existing result — only update the one tab
        setResult((prev) => ({ ...prev, [docId]: data[docId] }))
      } catch (err) {
        alert(`Regeneration failed: ${err.message}`)
      } finally {
        setRegenerating(null)
      }
    },
    [result, userToken],
  )

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true)
    try {
      const res = await fetch('/api/generate')
      const data = await res.json()
      setMetricsData(data)
    } catch (err) {
      console.error('Metrics fetch failed:', err)
    } finally {
      setMetricsLoading(false)
    }
  }, [])

  const handleShowMetrics = useCallback(() => {
    setShowMetrics((v) => !v)
    if (!showMetrics) fetchMetrics()
  }, [showMetrics, fetchMetrics])

  // Source badge text — explains where the result came from
  const sourceBadge =
    source === 'server_cache'
      ? '⚡ From server cache · shared across all users'
      : source === 'dedup'
        ? '🔗 Deduplicated · attached to in-flight request'
        : null

  return (
    <main className="main">
      <RepoInput
        onGenerate={handleGenerate}
        loading={loading}
        userToken={userToken}
        onTokenChange={handleTokenChange}
      />

      {/* Loading state with elapsed time */}
      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <p>{LOADING_MESSAGES[loadingMsg]}</p>
          <small>
            Usually 20–60 seconds · GitHub fetch + LLM generation in parallel
            {loadingStepMs > 5000 &&
              ` · ${Math.round(loadingStepMs / 1000)}s elapsed`}
          </small>
        </div>
      )}

      {/* Error state with retry countdown */}
      {error && (
        <div className="error-box">
          <div>❌ {error}</div>
          {retryAfterSec > 0 && (
            <div
              style={{ marginTop: '8px', fontSize: '0.85rem', opacity: 0.8 }}
            >
              Rate limit resets in{' '}
              <strong style={{ color: '#ff6b6b' }}>{retryAfterSec}s</strong>
            </div>
          )}
        </div>
      )}

      {/* Source badge */}
      {result && sourceBadge && (
        <div className="cache-badge">{sourceBadge}</div>
      )}

      {/* System metrics panel — the observability dashboard */}
      <div style={{ textAlign: 'right', marginTop: '8px' }}>
        <button
          onClick={handleShowMetrics}
          style={{
            fontSize: '0.75rem',
            color: 'var(--muted)',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '4px 10px',
            cursor: 'pointer',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {showMetrics ? '▲ Hide metrics' : '▼ System metrics'}
        </button>
      </div>

      {showMetrics && (
        <div
          style={{
            marginTop: '8px',
            padding: '16px 20px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.78rem',
          }}
        >
          {metricsLoading ? (
            <span style={{ color: 'var(--muted)' }}>Loading metrics...</span>
          ) : metricsData ? (
            <MetricsPanel data={metricsData} onRefresh={fetchMetrics} />
          ) : (
            <span style={{ color: 'var(--muted)' }}>No data yet</span>
          )}
        </div>
      )}

      {result && (
        <DocOutput
          data={result}
          onRegenerate={handleRegenerate}
          regenerating={regenerating}
        />
      )}
    </main>
  )
}

// ─── MetricsPanel ─────────────────────────────────────────────────────────────
// Displays live system metrics — cache hit rate, latency breakdown, model usage.
// This is what separates a production system from a weekend project.
function MetricsPanel({ data, onRefresh }) {
  const m = data
  const color = (val, good, warn) =>
    val >= good ? '#4ade80' : val >= warn ? '#fbbf24' : '#f87171'

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <span style={{ fontWeight: 700, color: '#e8e8f0', fontSize: '0.8rem' }}>
          📊 System Metrics
        </span>
        <button
          onClick={onRefresh}
          style={{
            fontSize: '0.72rem',
            color: 'var(--accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ↻ Refresh
        </button>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}
      >
        {/* Requests */}
        <MetricSection title="Requests">
          <MetricRow label="Total" value={m.requests.total} />
          <MetricRow label="Successful" value={m.requests.successful} />
          <MetricRow
            label="Rate Limited"
            value={m.requests.rateLimited}
            valueColor={m.requests.rateLimited > 0 ? '#fbbf24' : '#4ade80'}
          />
          <MetricRow
            label="Errors"
            value={m.requests.errors}
            valueColor={m.requests.errors > 0 ? '#f87171' : '#4ade80'}
          />
          <MetricRow
            label="Error Rate"
            value={`${(parseFloat(m.requests.errorRate) * 100).toFixed(1)}%`}
          />
        </MetricSection>

        {/* Cache */}
        <MetricSection title="Cache (Server LRU)">
          <MetricRow
            label="Hit Rate"
            value={`${(parseFloat(m.cache.hitRate) * 100).toFixed(1)}%`}
            valueColor={color(parseFloat(m.cache.hitRate), 0.5, 0.2)}
          />
          <MetricRow
            label="Size"
            value={`${m.cache.size} / ${m.cache.capacity}`}
          />
          <MetricRow label="Total Hits" value={m.cache.hits} />
          <MetricRow label="Dedup Hits" value={m.cache.dedupHits} />
          <MetricRow label="In-Flight" value={m.cache.inFlight} />
        </MetricSection>

        {/* Latency */}
        <MetricSection title="Latency">
          <MetricRow label="Avg Total" value={`${m.latency.avgTotalMs}ms`} />
          <MetricRow
            label="GitHub Fetch"
            value={`${m.latency.avgGithubFetchMs}ms (${m.analysis.githubSharePct}%)`}
            valueColor={
              m.analysis.bottleneck === 'github_fetch' ? '#fbbf24' : '#e8e8f0'
            }
          />
          <MetricRow
            label="LLM Generation"
            value={`${m.latency.avgLLMMs}ms (${m.analysis.llmSharePct}%)`}
            valueColor={
              m.analysis.bottleneck === 'llm_generation' ? '#fbbf24' : '#e8e8f0'
            }
          />
          <MetricRow label="p50" value={`${m.latency.p50Ms}ms`} />
          <MetricRow label="p99" value={`${m.latency.p99Ms}ms`} />
        </MetricSection>

        {/* Rate Limiter */}
        <MetricSection title="Rate Limiter">
          <MetricRow
            label="Active Buckets"
            value={m.rateLimiter.activeBuckets}
          />
          <MetricRow label="Policy" value={m.rateLimiter.policy} />
          <MetricRow
            label="Bottleneck"
            value={m.analysis.bottleneck.replace('_', ' ')}
            valueColor="#fbbf24"
          />
          <MetricRow label="Samples" value={m.latency.samplesCollected} />
        </MetricSection>
      </div>

      {/* Model usage */}
      {Object.keys(m.models.usage).length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div
            style={{
              color: '#6b6b80',
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            Model Usage
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {Object.entries(m.models.usage).map(([model, count]) => (
              <span
                key={model}
                style={{
                  fontSize: '0.72rem',
                  background: 'rgba(124,106,255,0.1)',
                  border: '1px solid rgba(124,106,255,0.2)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  color: '#a5b4fc',
                }}
              >
                {model.split('/').pop()}: {count}
                {m.models.failures[model] ? (
                  <span style={{ color: '#f87171', marginLeft: '4px' }}>
                    ({m.models.failures[model]} fail)
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricSection({ title, children }) {
  return (
    <div>
      <div
        style={{
          color: '#6b6b80',
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          marginBottom: '6px',
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {children}
      </div>
    </div>
  )
}

function MetricRow({ label, value, valueColor }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <span style={{ color: '#6b6b80' }}>{label}</span>
      <span style={{ color: valueColor || '#e8e8f0', fontWeight: 600 }}>
        {value}
      </span>
    </div>
  )
}
