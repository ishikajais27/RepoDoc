'use client'
import { useState, useEffect, useRef } from 'react'

const DOC_OPTIONS = [
  { id: 'user', emoji: '👤', label: 'User Docs' },
  { id: 'dev', emoji: '⚙️', label: 'Dev Docs' },
  { id: 'readme', emoji: '📄', label: 'README' },
  { id: 'interview', emoji: '🎯', label: 'Interview' },
]

const AUDIENCE_OPTIONS = [
  { id: 'user', emoji: '👤', label: 'End Users', desc: 'Plain English' },
  { id: 'junior', emoji: '🌱', label: 'Junior Devs', desc: 'Explain jargon' },
  { id: 'developer', emoji: '⚙️', label: 'Developers', desc: 'Full depth' },
  { id: 'investor', emoji: '💼', label: 'Stakeholders', desc: 'No jargon' },
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
      JSON.stringify([url, ...prev].slice(0, 8)),
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
  const [openPanel, setOpenPanel] = useState(null) // null | 'options'
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
  const wrapRef = useRef(null)

  useEffect(() => {
    setHistory(getHistory())
  }, [])

  useEffect(() => {
    const fn = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpenPanel(null)
        setShowHistory(false)
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    const t = url.trim()
    if (!t) return
    addToHistory(t)
    setHistory(getHistory())
    setShowHistory(false)
    setOpenPanel(null)
    onGenerate(t, selectedDocs, { audience, language })
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

  const currentAudience = AUDIENCE_OPTIONS.find((a) => a.id === audience)
  const allSelected = selectedDocs.length === DOC_OPTIONS.length

  const examples = [
    'https://github.com/vercel/next.js',
    'https://github.com/expressjs/express',
    'https://github.com/supabase/supabase',
  ]

  // Styles
  const S = {
    docChip: (on) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '6px 13px',
      borderRadius: '8px',
      fontSize: '13px',
      cursor: 'pointer',
      border: on ? '1.5px solid #4f46e5' : '1.5px solid transparent',
      fontWeight: on ? 600 : 400,
      transition: 'all 0.12s',
      background: on ? 'rgba(79,70,229,0.1)' : 'rgba(255,255,255,0.05)',
      color: on ? '#4f46e5' : 'var(--text-muted,#9ca3af)',
    }),
    pill: (on) => ({
      padding: '4px 11px',
      borderRadius: '20px',
      fontSize: '12px',
      cursor: 'pointer',
      border: on
        ? '1.5px solid #4f46e5'
        : '1px solid var(--border,rgba(255,255,255,0.12))',
      background: on ? '#4f46e5' : 'transparent',
      color: on ? '#fff' : 'var(--text-muted,#9ca3af)',
      fontWeight: on ? 600 : 400,
      transition: 'all 0.1s',
      whiteSpace: 'nowrap',
    }),
    audBtn: (on) => ({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '10px 18px',
      borderRadius: '10px',
      gap: '2px',
      cursor: 'pointer',
      transition: 'all 0.12s',
      flex: 1,
      border: on
        ? '1.5px solid #4f46e5'
        : '1.5px solid var(--border,rgba(255,255,255,0.1))',
      background: on ? 'rgba(79,70,229,0.12)' : 'transparent',
      color: on ? '#818cf8' : 'var(--text-muted,#9ca3af)',
    }),
  }

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

      <div ref={wrapRef}>
        <form onSubmit={handleSubmit} className="repo-form">
          {/* ── URL input ── */}
          <div className="input-wrapper" style={{ position: 'relative' }}>
            <span className="input-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
            </span>
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setShowHistory(false)
              }}
              onFocus={() => {
                if (history.length && !url.trim()) setShowHistory(true)
              }}
              placeholder="https://github.com/username/repository"
              className="repo-input"
              disabled={loading}
              autoComplete="off"
            />
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
                'Generate →'
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
                  zIndex: 300,
                  background: 'var(--bg-card,#1a1a2e)',
                  border: '1px solid var(--border,rgba(255,255,255,0.1))',
                  borderRadius: '12px',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '10px 16px 6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#6b7280',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Recent
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      clearHistory()
                      setHistory([])
                      setShowHistory(false)
                    }}
                    style={{
                      fontSize: '12px',
                      color: '#6b7280',
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
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '10px 16px',
                      background: 'none',
                      border: 'none',
                      borderTop:
                        '1px solid var(--border,rgba(255,255,255,0.07))',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: 'var(--text,#e5e7eb)',
                      textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        'rgba(255,255,255,0.05)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'none')
                    }
                  >
                    <span style={{ opacity: 0.3, fontSize: '11px' }}>⌗</span>
                    {h.replace('https://github.com/', '')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Bottom controls row ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '10px',
              flexWrap: 'wrap',
            }}
          >
            {/* Doc type chips */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {DOC_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleDoc(opt.id)}
                  style={S.docChip(selectedDocs.includes(opt.id))}
                >
                  <span style={{ fontSize: '12px' }}>{opt.emoji}</span>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Separator */}
            <div
              style={{
                width: '1px',
                height: '18px',
                background: 'var(--border,rgba(255,255,255,0.1))',
                margin: '0 2px',
              }}
            />

            {/* Options button — shows current audience + language */}
            <button
              type="button"
              onClick={() =>
                setOpenPanel((p) => (p === 'options' ? null : 'options'))
              }
              style={S.docChip(openPanel === 'options')}
              title="Audience & Language"
            >
              <span style={{ fontSize: '12px' }}>{currentAudience?.emoji}</span>
              {currentAudience?.label}
              {language !== 'English' && (
                <span
                  style={{
                    background: '#4f46e5',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '1px 5px',
                    fontSize: '10px',
                    fontWeight: 700,
                    marginLeft: '1px',
                  }}
                >
                  {language}
                </span>
              )}
              <span
                style={{ fontSize: '9px', opacity: 0.5, marginLeft: '1px' }}
              >
                {openPanel === 'options' ? '▲' : '▼'}
              </span>
            </button>

            {/* Private repo — far right */}
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
                onClick={() => {
                  setShowToken((v) => !v)
                  setOpenPanel(null)
                }}
                style={{
                  ...S.docChip(!!userToken || showToken),
                  fontSize: '12px',
                }}
              >
                {userToken ? '🔒 Token saved' : '🔑 Private repo?'}
              </button>
              {userToken && !showToken && (
                <button
                  type="button"
                  onClick={() => onTokenChange('')}
                  style={{
                    fontSize: '11px',
                    color: '#6b7280',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  remove
                </button>
              )}
            </div>
          </div>

          {/* ── Options panel ── clean, minimal ── */}
          {openPanel === 'options' && (
            <div
              style={{
                marginTop: '8px',
                padding: '16px 18px',
                background: 'var(--bg-card,#111)',
                border: '1px solid var(--border,rgba(255,255,255,0.1))',
                borderRadius: '14px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              }}
            >
              {/* Audience */}
              <div style={{ marginBottom: '14px' }}>
                <p
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#6b7280',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                  }}
                >
                  Writing for
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAudience(opt.id)}
                      style={S.audBtn(audience === opt.id)}
                    >
                      <span style={{ fontSize: '18px' }}>{opt.emoji}</span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          lineHeight: 1.2,
                        }}
                      >
                        {opt.label}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          opacity: 0.55,
                          lineHeight: 1.2,
                        }}
                      >
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div
                style={{
                  height: '1px',
                  background: 'var(--border,rgba(255,255,255,0.07))',
                  marginBottom: '14px',
                }}
              />

              {/* Language */}
              <div>
                <p
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#6b7280',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                  }}
                >
                  Output language
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setLanguage(lang)}
                      style={S.pill(language === lang)}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Token panel ── */}
          {showToken && (
            <div className="token-box" style={{ marginTop: '8px' }}>
              <input
                type="password"
                value={userToken}
                onChange={(e) => onTokenChange(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="token-input"
                autoComplete="off"
              />
              <p className="token-hint">
                Needs <code>repo</code> scope. Stays in your browser only.{' '}
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

        {/* ── Examples ── */}
        <div className="examples">
          <span>Try:</span>
          {examples.map((ex) => (
            <button
              key={ex}
              className="example-pill"
              onClick={() => setUrl(ex)}
            >
              {ex.split('/').slice(-2).join('/')}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
