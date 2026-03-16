'use client'
import { useState, useEffect } from 'react'

const DOC_OPTIONS = [
  {
    id: 'user',
    label: '👤 User Docs',
    desc: 'Plain-English guide for end users',
  },
  {
    id: 'dev',
    label: '⚙️ Dev Docs',
    desc: 'Architecture, data flow, security & stack',
  },
  {
    id: 'readme',
    label: '📄 README.md',
    desc: 'GitHub-ready README with badges',
  },
  {
    id: 'interview',
    label: '🎯 Interview Prep',
    desc: 'Q&A, pitch, cheat sheet — interview-ready',
  },
]

const AUDIENCE_OPTIONS = [
  { id: 'user', label: '👤 End Users', desc: 'Non-technical, plain English' },
  {
    id: 'junior',
    label: '🌱 Junior Devs',
    desc: 'Explain concepts, define jargon',
  },
  {
    id: 'developer',
    label: '⚙️ Developers',
    desc: 'Architecture & technical depth',
  },
  {
    id: 'investor',
    label: '💼 Stakeholders',
    desc: 'Impact & credibility, no jargon',
  },
]

const LANGUAGES = [
  'English',
  'Hindi',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Japanese',
  'Chinese',
  'Korean',
  'Arabic',
  'Russian',
  'Italian',
]

const HISTORY_KEY = 'gitdoc_history'
const MAX_HISTORY = 8

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}
function addToHistory(url) {
  try {
    const prev = getHistory().filter((u) => u !== url)
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([url, ...prev].slice(0, MAX_HISTORY)),
    )
  } catch {}
}
function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {}
}

export default function RepoInput({
  onGenerate,
  loading,
  userToken,
  onTokenChange,
}) {
  const [url, setUrl] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [showDocPicker, setShowDocPicker] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState([
    'user',
    'dev',
    'readme',
    'interview',
  ])
  const [audience, setAudience] = useState('developer')
  const [language, setLanguage] = useState('English')
  const [history, setHistory] = useState([])

  useEffect(() => {
    setHistory(getHistory())
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    addToHistory(trimmed)
    setHistory(getHistory())
    setShowHistory(false)
    onGenerate(trimmed, selectedDocs, { audience, language })
  }

  const toggleDoc = (id) => {
    setSelectedDocs((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((d) => d !== id)
          : prev
        : [...prev, id],
    )
  }

  const allSelected = selectedDocs.length === DOC_OPTIONS.length

  const examples = [
    'https://github.com/vercel/next.js',
    'https://github.com/expressjs/express',
    'https://github.com/supabase/supabase',
  ]

  return (
    <div className="input-section">
      <div className="hero-text">
        <h1>
          GitDoc<span className="accent">.</span>
        </h1>
        <p>
          Drop a GitHub repo. Get perfect documentation — for users <em>and</em>{' '}
          employers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="repo-form">
        {/* ── Main input ── */}
        <div className="input-wrapper" style={{ position: 'relative' }}>
          <span className="input-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
          </span>
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (showHistory) setShowHistory(false)
            }}
            onFocus={() => {
              if (history.length > 0 && !url.trim()) setShowHistory(true)
            }}
            placeholder="https://github.com/username/repository"
            className="repo-input"
            disabled={loading}
            autoComplete="off"
          />
          {history.length > 0 && (
            <button
              type="button"
              title="Recent repos"
              onClick={() => setShowHistory((v) => !v)}
              style={{
                position: 'absolute',
                right: '130px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                opacity: 0.45,
                fontSize: '16px',
                lineHeight: 1,
              }}
            >
              🕐
            </button>
          )}
          <button
            type="submit"
            className="generate-btn"
            disabled={loading || !url.trim()}
          >
            {loading ? (
              <span className="loading-dots">
                <span />
                <span />
                <span />
              </span>
            ) : (
              'Generate Docs →'
            )}
          </button>

          {/* History dropdown */}
          {showHistory && history.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: 'var(--bg-card,#fff)',
                border: '1px solid var(--border,#e5e7eb)',
                borderRadius: '10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 200,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '8px 12px 4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Recent repos
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearHistory()
                    setHistory([])
                    setShowHistory(false)
                  }}
                  style={{
                    fontSize: '11px',
                    color: '#9ca3af',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              </div>
              {history.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setUrl(h)
                    setShowHistory(false)
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'inherit',
                    borderTop: '1px solid var(--border,#f3f4f6)',
                  }}
                >
                  <span style={{ marginRight: 8, opacity: 0.4 }}>⌗</span>
                  {h.replace('https://github.com/', '')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Controls row ── */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginTop: '8px',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            className="doc-picker-toggle"
            onClick={() => {
              setShowDocPicker((v) => !v)
              setShowOptions(false)
            }}
          >
            <span className="doc-picker-label">
              📋{' '}
              <span className="doc-picker-count">
                {allSelected
                  ? 'All 4 docs'
                  : `${selectedDocs.length} doc${selectedDocs.length > 1 ? 's' : ''}`}
              </span>
            </span>
            <span className="toggle-arrow">{showDocPicker ? '▲' : '▼'}</span>
          </button>

          <button
            type="button"
            className="doc-picker-toggle"
            onClick={() => {
              setShowOptions((v) => !v)
              setShowDocPicker(false)
            }}
          >
            <span className="doc-picker-label">
              🎛️{' '}
              <span className="doc-picker-count">
                {AUDIENCE_OPTIONS.find((a) => a.id === audience)?.label ||
                  'Options'}
                {language !== 'English' ? ` · ${language}` : ''}
              </span>
            </span>
            <span className="toggle-arrow">{showOptions ? '▲' : '▼'}</span>
          </button>

          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <button
              type="button"
              className="private-toggle"
              onClick={() => setShowToken((v) => !v)}
            >
              {userToken ? '🔒 Token saved' : '🔑 Private repo?'}
              <span className="toggle-arrow">{showToken ? '▲' : '▼'}</span>
            </button>
            {userToken && !showToken && (
              <button
                type="button"
                className="clear-token"
                onClick={() => onTokenChange('')}
              >
                remove
              </button>
            )}
          </div>
        </div>

        {/* ── Doc picker panel ── */}
        {showDocPicker && (
          <div className="doc-picker-box">
            <p className="doc-picker-hint">Choose which docs to generate:</p>
            <div className="doc-options">
              {DOC_OPTIONS.map((opt) => {
                const checked = selectedDocs.includes(opt.id)
                return (
                  <label
                    key={opt.id}
                    className={`doc-option ${checked ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDoc(opt.id)}
                      className="doc-checkbox"
                    />
                    <div className="doc-option-content">
                      <span className="doc-option-label">{opt.label}</span>
                      <span className="doc-option-desc">{opt.desc}</span>
                    </div>
                    {checked && <span className="doc-check">✓</span>}
                  </label>
                )
              })}
            </div>
            <button
              type="button"
              className="select-all-btn"
              onClick={() =>
                setSelectedDocs(
                  allSelected ? ['user'] : DOC_OPTIONS.map((d) => d.id),
                )
              }
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
        )}

        {/* ── Audience + Language panel ── */}
        {showOptions && (
          <div className="doc-picker-box">
            <p className="doc-picker-hint" style={{ marginBottom: '10px' }}>
              Who is this documentation for?
            </p>
            <div className="doc-options" style={{ marginBottom: '16px' }}>
              {AUDIENCE_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`doc-option ${audience === opt.id ? 'selected' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  <input
                    type="radio"
                    name="audience"
                    checked={audience === opt.id}
                    onChange={() => setAudience(opt.id)}
                    className="doc-checkbox"
                  />
                  <div className="doc-option-content">
                    <span className="doc-option-label">{opt.label}</span>
                    <span className="doc-option-desc">{opt.desc}</span>
                  </div>
                  {audience === opt.id && <span className="doc-check">✓</span>}
                </label>
              ))}
            </div>
            <p className="doc-picker-hint" style={{ marginBottom: '8px' }}>
              Output language:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    border:
                      language === lang
                        ? '1.5px solid #4f46e5'
                        : '1px solid #e5e7eb',
                    background: language === lang ? '#eef2ff' : 'transparent',
                    color: language === lang ? '#4f46e5' : 'inherit',
                    fontWeight: language === lang ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Token panel ── */}
        {showToken && (
          <div className="token-box">
            <input
              type="password"
              value={userToken}
              onChange={(e) => onTokenChange(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="token-input"
              autoComplete="off"
            />
            <p className="token-hint">
              Needs <code>repo</code> scope. Saved in your browser only — never
              sent to our servers except to call GitHub&apos;s API.{' '}
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=GitDoc"
                target="_blank"
                rel="noopener noreferrer"
                className="token-link"
              >
                Create one ↗
              </a>
            </p>
          </div>
        )}
      </form>

      <div className="examples">
        <span>Try:</span>
        {examples.map((ex) => (
          <button key={ex} className="example-pill" onClick={() => setUrl(ex)}>
            {ex.split('/').slice(-2).join('/')}
          </button>
        ))}
      </div>
    </div>
  )
}
