'use client'
import { useState, useEffect } from 'react'
import RepoInput from './RepoInput'
import DocOutput from './DocOutput'

const LOADING_MESSAGES = [
  'Reading the codebase...',
  'Analyzing architecture & tech decisions...',
  'Writing docs that actually make sense...',
  'Prepping your interview answers...',
]

const CACHE_PREFIX = 'gitdoc_cache_'
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

function getCached(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return data
  } catch {
    return null
  }
}

function setCache(key, data) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, ts: Date.now() }),
    )
  } catch {}
}

export default function HomeClient() {
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [userToken, setUserToken] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gitdoc_user_token')
      if (saved) setUserToken(saved)
    } catch {}
  }, [])

  const handleTokenChange = (t) => {
    setUserToken(t)
    try {
      if (t) localStorage.setItem('gitdoc_user_token', t)
      else localStorage.removeItem('gitdoc_user_token')
    } catch {}
  }

  const handleGenerate = async (url, selectedDocs) => {
    // Cache key includes selected docs so different selections cache separately
    const cacheKey = `${url}__${[...(selectedDocs || [])].sort().join(',')}`
    const cached = getCached(cacheKey)
    if (cached) {
      setResult(cached)
      setFromCache(true)
      setError('')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setFromCache(false)
    setLoadingMsg(0)

    const interval = setInterval(() => {
      setLoadingMsg((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 5000)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          userToken: userToken || null,
          selectedDocs: selectedDocs || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
      setCache(cacheKey, data)
    } catch (err) {
      setError(err.message)
    } finally {
      clearInterval(interval)
      setLoading(false)
    }
  }

  return (
    <main className="main">
      <RepoInput
        onGenerate={handleGenerate}
        loading={loading}
        userToken={userToken}
        onTokenChange={handleTokenChange}
      />
      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <p>{LOADING_MESSAGES[loadingMsg]}</p>
          <small>Usually takes 20–60 seconds depending on docs selected</small>
        </div>
      )}
      {error && <div className="error-box">❌ {error}</div>}
      {result && (
        <>
          {fromCache && (
            <div className="cache-badge">
              ⚡ Loaded from cache · available offline
            </div>
          )}
          <DocOutput data={result} />
        </>
      )}
    </main>
  )
}
