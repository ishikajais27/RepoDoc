'use client'
import { useState } from 'react'
import RepoInput from './RepoInput'
import DocOutput from './DocOutput'

export default function HomeClient() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleGenerate = async (url) => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="main">
      <RepoInput onGenerate={handleGenerate} loading={loading} />
      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Analyzing repo and generating docs with Groq AI...</p>
          <small>This takes 15–30 seconds</small>
        </div>
      )}
      {error && <div className="error-box">❌ {error}</div>}
      {result && <DocOutput data={result} />}
    </main>
  )
}
