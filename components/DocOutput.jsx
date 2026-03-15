'use client'
import { useState, useRef, useEffect } from 'react'

// ─── Inline markdown (bold, italic, code, links) ──────────────────────────────
function inlineMarkdown(text) {
  if (!text) return ''
  const parts = []
  let rem = text,
    k = 0

  while (rem.length > 0) {
    const bold = rem.match(/\*\*(.+?)\*\*/)
    const italic = rem.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/)
    const code = rem.match(/`(.+?)`/)
    const link = rem.match(/\[(.+?)\]\((.+?)\)/)

    const hits = [
      bold && { type: 'bold', m: bold },
      italic && { type: 'italic', m: italic },
      code && { type: 'code', m: code },
      link && { type: 'link', m: link },
    ]
      .filter(Boolean)
      .sort((a, b) => a.m.index - b.m.index)

    if (!hits.length) {
      parts.push(rem)
      break
    }

    const { type, m } = hits[0]
    if (m.index > 0) parts.push(rem.slice(0, m.index))

    if (type === 'bold') parts.push(<strong key={k++}>{m[1]}</strong>)
    if (type === 'italic') parts.push(<em key={k++}>{m[1]}</em>)
    if (type === 'code')
      parts.push(
        <code key={k++} className="ic">
          {m[1]}
        </code>,
      )
    if (type === 'link')
      parts.push(
        <a
          key={k++}
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="md-link"
        >
          {m[1]}
        </a>,
      )

    rem = rem.slice(m.index + m[0].length)
  }
  return parts
}

// ─── Block markdown renderer ──────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const out = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      const code = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        code.push(lines[i])
        i++
      }
      const raw = code.join('\n')
      const isDiagram = !lang && /[┌│└─▶→▲▼╔╗╚╝║═┐┘├┤┬┴┼]/.test(raw)
      out.push(
        <div key={i} className={`cb ${isDiagram ? 'cb--diagram' : ''}`}>
          {(lang || isDiagram) && (
            <span
              className={`cb__lang ${isDiagram ? 'cb__lang--diagram' : ''}`}
            >
              {isDiagram ? 'diagram' : lang}
            </span>
          )}
          <pre>
            <code>{raw}</code>
          </pre>
        </div>,
      )
      i++
      continue
    }

    // Table
    if (line.includes('|') && lines[i + 1]?.match(/^\|[-: |]+\|$/)) {
      const heads = line
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean)
      const rows = []
      i += 2
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(
          lines[i]
            .split('|')
            .map((c) => c.trim())
            .filter(Boolean),
        )
        i++
      }
      out.push(
        <div key={i} className="tbl-wrap">
          <table className="md-tbl">
            <thead>
              <tr>
                {heads.map((h, j) => (
                  <th key={j}>{inlineMarkdown(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{inlineMarkdown(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    // Blockquote
    if (line.startsWith('>')) {
      out.push(
        <blockquote key={i} className="md-bq">
          {inlineMarkdown(line.slice(1).trim())}
        </blockquote>,
      )
      i++
      continue
    }

    // Headings
    const h1 = line.match(/^# (.+)/)
    if (h1) {
      out.push(
        <h1 key={i} className="md-h1">
          {inlineMarkdown(h1[1])}
        </h1>,
      )
      i++
      continue
    }
    const h2 = line.match(/^## (.+)/)
    if (h2) {
      out.push(
        <h2 key={i} className="md-h2">
          {inlineMarkdown(h2[1])}
        </h2>,
      )
      i++
      continue
    }
    const h3 = line.match(/^### (.+)/)
    if (h3) {
      out.push(
        <h3 key={i} className="md-h3">
          {inlineMarkdown(h3[1])}
        </h3>,
      )
      i++
      continue
    }

    // HR
    if (/^---+$/.test(line.trim())) {
      out.push(<hr key={i} className="md-hr" />)
      i++
      continue
    }

    // Unordered list
    if (/^[-*] /.test(line)) {
      const items = []
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*] /, ''))
        i++
      }
      out.push(
        <ul key={i} className="md-ul">
          {items.map((it, j) => (
            <li key={j}>{inlineMarkdown(it)}</li>
          ))}
        </ul>,
      )
      continue
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''))
        i++
      }
      out.push(
        <ol key={i} className="md-ol">
          {items.map((it, j) => (
            <li key={j}>{inlineMarkdown(it)}</li>
          ))}
        </ol>,
      )
      continue
    }

    if (!line.trim()) {
      out.push(<div key={i} className="md-sp" />)
      i++
      continue
    }

    out.push(
      <p key={i} className="md-p">
        {inlineMarkdown(line)}
      </p>,
    )
    i++
  }
  return out
}

// ─── Tab config ───────────────────────────────────────────────────────────────
const ALL_TABS = [
  { id: 'user', label: '👤 User Docs', short: 'User' },
  { id: 'dev', label: '⚙️ Dev Docs', short: 'Dev' },
  { id: 'readme', label: '📄 README', short: 'README' },
  { id: 'interview', label: '🎯 Interview Prep', short: 'Interview' },
]

const LANG_COLORS = {
  JavaScript: '#f7df1e',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00add8',
  Ruby: '#701516',
  Java: '#b07219',
  CSS: '#563d7c',
  HTML: '#e34c26',
  'C++': '#f34b7d',
  Swift: '#fa7343',
  Kotlin: '#a97bff',
  Vue: '#42b883',
  Svelte: '#ff3e00',
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DocOutput({ data }) {
  const availableTabs = ALL_TABS.filter((t) => data[t.id])
  const [activeTab, setActiveTab] = useState(availableTabs[0]?.id || 'user')
  const [viewMode, setViewMode] = useState('rendered')
  const [copied, setCopied] = useState(false)
  const [format, setFormat] = useState('md')
  const contentRef = useRef(null)

  // Scroll to top on tab switch
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [activeTab])

  const current = data[activeTab] || ''

  const handleCopy = () => {
    navigator.clipboard.writeText(current)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const names = {
      user: 'user-docs',
      dev: 'dev-docs',
      readme: 'README',
      interview: 'interview-prep',
    }
    const ext = format === 'md' ? '.md' : format === 'docx' ? '.docx' : '.md'
    const filename = `${names[activeTab]}${ext}`

    if (format === 'pdf') {
      // Print-to-PDF via styled popup
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.65;color:#111;padding:40px;max-width:780px;margin:0 auto}
  h1{font-size:22pt;font-weight:800;border-bottom:3px solid #4f46e5;padding-bottom:8px;margin-bottom:16px}
  h2{font-size:15pt;font-weight:700;margin-top:28px;border-bottom:1px solid #e5e7eb;padding-bottom:5px}
  h3{font-size:12pt;font-weight:600;margin-top:18px;color:#312e81}
  p{margin:0 0 10px}ul,ol{margin:6px 0 12px 22px}li{margin-bottom:3px}
  code{font-family:'Courier New',monospace;font-size:9.5pt;background:#f3f4f6;border:1px solid #e5e7eb;padding:1px 5px;border-radius:3px}
  pre{background:#1e293b;color:#e2e8f0;font-family:'Courier New',monospace;font-size:9pt;padding:14px;border-radius:6px;margin:12px 0;white-space:pre-wrap;word-break:break-all}
  blockquote{border-left:3px solid #4f46e5;padding:8px 16px;background:#eef2ff;margin:12px 0;border-radius:0 6px 6px 0}
  table{width:100%;border-collapse:collapse;margin:12px 0;font-size:10pt}
  th{background:#4f46e5;color:#fff;padding:8px 12px;text-align:left}
  td{padding:7px 12px;border-bottom:1px solid #e5e7eb}
  hr{border:none;border-top:1px solid #e5e7eb;margin:20px 0}
  strong{font-weight:700}
</style></head><body>
${current
  .split('\n')
  .map((l) => {
    if (/^### (.+)/.test(l)) return `<h3>${l.slice(4)}</h3>`
    if (/^## (.+)/.test(l)) return `<h2>${l.slice(3)}</h2>`
    if (/^# (.+)/.test(l)) return `<h1>${l.slice(2)}</h1>`
    if (/^---+$/.test(l.trim())) return '<hr>'
    if (l.startsWith('> ')) return `<blockquote>${l.slice(2)}</blockquote>`
    if (/^[-*] /.test(l)) return `<li>${l.slice(2)}</li>`
    if (/^\d+\. /.test(l)) return `<li>${l.replace(/^\d+\. /, '')}</li>`
    if (!l.trim()) return '<br>'
    return `<p>${l
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')}</p>`
  })
  .join('\n')}
</body></html>`
      const w = window.open('', '_blank')
      w.document.write(html)
      w.document.close()
      w.focus()
      setTimeout(() => w.print(), 400)
      return
    }

    const blob = new Blob([current], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="output-section">
      {/* ── Repo header ── */}
      <div className="repo-meta">
        <div className="repo-meta__left">
          <div className="repo-badge">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              opacity=".65"
            >
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            <span className="repo-badge__name">
              <span className="repo-badge__owner">{data.repoData.owner}</span>
              <span className="repo-badge__sep">/</span>
              <strong>{data.repoData.repo}</strong>
            </span>
            {data.repoData.homepage && (
              <a
                href={data.repoData.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="live-link"
              >
                🚀 Live ↗
              </a>
            )}
          </div>
          <div className="lang-badges">
            {Object.keys(data.repoData.languages)
              .slice(0, 5)
              .map((lang) => (
                <span
                  key={lang}
                  className="lang-tag"
                  style={{ '--lc': LANG_COLORS[lang] || '#888' }}
                >
                  <span className="lang-dot" />
                  {lang}
                </span>
              ))}
          </div>
        </div>
        {data.repoData.stars > 0 && (
          <span className="stars-badge">
            ⭐ {data.repoData.stars.toLocaleString()}
          </span>
        )}
      </div>

      {/* ── Tabs — desktop: buttons, mobile: select ── */}
      <div className="tabs-bar">
        {/* Desktop tabs */}
        <div className="tabs-desktop">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {/* Mobile select */}
        <select
          className="tabs-mobile-select"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
        >
          {availableTabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Doc panel ── */}
      <div className="doc-panel">
        {/* Actions */}
        <div className="doc-actions">
          <div className="view-toggle">
            <button
              className={`vt-btn ${viewMode === 'rendered' ? 'vt-btn--on' : ''}`}
              onClick={() => setViewMode('rendered')}
            >
              Preview
            </button>
            <button
              className={`vt-btn ${viewMode === 'raw' ? 'vt-btn--on' : ''}`}
              onClick={() => setViewMode('raw')}
            >
              Markdown
            </button>
          </div>
          <div className="doc-actions__right">
            <button className="action-btn" onClick={handleCopy}>
              {copied ? '✅ Copied' : '📋 Copy'}
            </button>
            <div className="dl-group">
              <select
                className="fmt-select"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="md">.md</option>
                <option value="pdf">.pdf</option>
              </select>
              <button
                className="action-btn action-btn--primary"
                onClick={handleDownload}
              >
                ↓ Download
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} className="doc-body">
          {viewMode === 'raw' ? (
            <pre className="doc-raw">{current}</pre>
          ) : (
            <div className="doc-rendered">{renderMarkdown(current)}</div>
          )}
        </div>
      </div>
    </div>
  )
}
