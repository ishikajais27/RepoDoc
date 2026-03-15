'use client'
import { useState, useEffect, useRef } from 'react'

// ─── Inline markdown helpers ─────────────────────────────────────────────────

function inlineMarkdown(text) {
  if (!text) return ''
  const parts = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    const italicMatch = remaining.match(/\*(.+?)\*/)
    const codeMatch = remaining.match(/`(.+?)`/)
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/)

    const candidates = [
      boldMatch && { type: 'bold', match: boldMatch },
      italicMatch && { type: 'italic', match: italicMatch },
      codeMatch && { type: 'code', match: codeMatch },
      linkMatch && { type: 'link', match: linkMatch },
    ]
      .filter(Boolean)
      .sort((a, b) => a.match.index - b.match.index)

    if (!candidates.length) {
      parts.push(remaining)
      break
    }

    const first = candidates[0]
    const before = remaining.slice(0, first.match.index)
    if (before) parts.push(before)

    switch (first.type) {
      case 'bold':
        parts.push(<strong key={key++}>{first.match[1]}</strong>)
        break
      case 'italic':
        parts.push(<em key={key++}>{first.match[1]}</em>)
        break
      case 'code':
        parts.push(
          <code key={key++} className="inline-code">
            {first.match[1]}
          </code>,
        )
        break
      case 'link':
        parts.push(
          <a
            key={key++}
            href={first.match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="md-link"
          >
            {first.match[1]}
          </a>,
        )
        break
    }
    remaining = remaining.slice(first.match.index + first.match[0].length)
  }
  return parts
}

// ─── Full markdown renderer ───────────────────────────────────────────────────

function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const output = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      const code = codeLines.join('\n')
      const isAscii = lang === '' && /[┌│└─▶→▲▼╔╗╚╝║═]/.test(code)
      output.push(
        <div
          key={`cb-${i}`}
          className={`code-block ${isAscii ? 'diagram-block' : ''}`}
        >
          {(lang || isAscii) && (
            <span className={`code-lang ${isAscii ? 'diagram-label' : ''}`}>
              {isAscii ? 'diagram' : lang}
            </span>
          )}
          <pre>
            <code>{code}</code>
          </pre>
        </div>,
      )
      i++
      continue
    }

    // Table (header + separator)
    if (line.includes('|') && lines[i + 1]?.match(/\|[-: ]+\|/)) {
      const headers = line
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
      output.push(
        <div key={`tbl-${i}`} className="table-wrapper">
          <table className="md-table">
            <thead>
              <tr>
                {headers.map((h, j) => (
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
      // Check if it's an image blockquote
      const imgMatch = line.match(/^>\s*!\[(.+?)\]\((.+?)\)/)
      if (imgMatch) {
        output.push(
          <div key={`img-${i}`} className="md-screenshot">
            <img
              src={imgMatch[2]}
              alt={imgMatch[1]}
              className="repo-screenshot"
              loading="lazy"
            />
            <span className="screenshot-label">📸 App screenshot</span>
          </div>,
        )
      } else {
        output.push(
          <blockquote key={`bq-${i}`} className="md-blockquote">
            {inlineMarkdown(line.slice(1).trim())}
          </blockquote>,
        )
      }
      i++
      continue
    }

    // Inline image (not in blockquote)
    const imgLine = line.match(/^!\[(.+?)\]\((.+?)\)/)
    if (imgLine) {
      output.push(
        <div key={`img-${i}`} className="md-screenshot">
          <img
            src={imgLine[2]}
            alt={imgLine[1]}
            className="repo-screenshot"
            loading="lazy"
          />
          <span className="screenshot-label">📸 App screenshot</span>
        </div>,
      )
      i++
      continue
    }

    // Headings
    const h1m = line.match(/^# (.+)/)
    const h2m = line.match(/^## (.+)/)
    const h3m = line.match(/^### (.+)/)
    if (h1m) {
      output.push(
        <h1 key={`h1-${i}`} className="md-h1">
          {inlineMarkdown(h1m[1])}
        </h1>,
      )
      i++
      continue
    }
    if (h2m) {
      output.push(
        <h2 key={`h2-${i}`} className="md-h2">
          {inlineMarkdown(h2m[1])}
        </h2>,
      )
      i++
      continue
    }
    if (h3m) {
      output.push(
        <h3 key={`h3-${i}`} className="md-h3">
          {inlineMarkdown(h3m[1])}
        </h3>,
      )
      i++
      continue
    }

    // HR
    if (line.trim() === '---' || line.trim() === '***') {
      output.push(<hr key={`hr-${i}`} className="md-hr" />)
      i++
      continue
    }

    // Unordered list
    if (line.match(/^[-*] /)) {
      const items = []
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        items.push(lines[i].replace(/^[-*] /, ''))
        i++
      }
      output.push(
        <ul key={`ul-${i}`} className="md-ul">
          {items.map((it, j) => (
            <li key={j}>{inlineMarkdown(it)}</li>
          ))}
        </ul>,
      )
      continue
    }

    // Ordered list
    if (line.match(/^\d+\. /)) {
      const items = []
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ''))
        i++
      }
      output.push(
        <ol key={`ol-${i}`} className="md-ol">
          {items.map((it, j) => (
            <li key={j}>{inlineMarkdown(it)}</li>
          ))}
        </ol>,
      )
      continue
    }

    // Empty line
    if (line.trim() === '') {
      output.push(<div key={`sp-${i}`} className="md-spacer" />)
      i++
      continue
    }

    // Paragraph
    output.push(
      <p key={`p-${i}`} className="md-p">
        {inlineMarkdown(line)}
      </p>,
    )
    i++
  }

  return output
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function downloadMd(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function downloadDocx(content, filename) {
  // Dynamically import docx — must be installed: npm install docx
  try {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } =
      await import('docx')

    const lines = content.split('\n')
    const children = []

    for (const line of lines) {
      if (!line.trim()) {
        children.push(new Paragraph(''))
        continue
      }
      const h1 = line.match(/^# (.+)/)
      if (h1) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun(h1[1])],
          }),
        )
        continue
      }
      const h2 = line.match(/^## (.+)/)
      if (h2) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun(h2[1])],
          }),
        )
        continue
      }
      const h3 = line.match(/^### (.+)/)
      if (h3) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun(h3[1])],
          }),
        )
        continue
      }
      // Bold-heavy line
      const cleaned = line
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/^[-*] /, '')
        .replace(/^\d+\. /, '')
      children.push(new Paragraph({ children: [new TextRun(cleaned)] }))
    }

    const doc = new Document({
      styles: {
        default: { document: { run: { font: 'Arial', size: 24 } } },
        paragraphStyles: [
          {
            id: 'Heading1',
            name: 'Heading 1',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: { size: 36, bold: true, font: 'Arial' },
            paragraph: {
              spacing: { before: 300, after: 160 },
              outlineLevel: 0,
            },
          },
          {
            id: 'Heading2',
            name: 'Heading 2',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: { size: 28, bold: true, font: 'Arial' },
            paragraph: {
              spacing: { before: 240, after: 120 },
              outlineLevel: 1,
            },
          },
          {
            id: 'Heading3',
            name: 'Heading 3',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: { size: 24, bold: true, font: 'Arial' },
            paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 },
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
          },
          children,
        },
      ],
    })

    const buffer = await Packer.toBlob(doc)
    const url = URL.createObjectURL(buffer)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    // Fallback: download as .md if docx not available
    alert(
      'docx export requires the `docx` package (npm install docx). Downloading as markdown instead.',
    )
    downloadMd(content, filename.replace('.docx', '.md'))
  }
}

async function downloadPdf(content, title, filename) {
  // Use browser print-to-PDF via a styled popup window
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; font-size: 12pt; line-height: 1.6; color: #1a1a2e; padding: 40px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 22pt; font-weight: 800; margin: 0 0 16px; color: #0f0f23; border-bottom: 3px solid #4f46e5; padding-bottom: 10px; }
  h2 { font-size: 16pt; font-weight: 700; margin: 28px 0 10px; color: #1e1b4b; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  h3 { font-size: 13pt; font-weight: 600; margin: 20px 0 8px; color: #312e81; }
  p  { margin: 0 0 10px; }
  ul, ol { margin: 6px 0 12px 24px; }
  li { margin-bottom: 4px; }
  code { font-family: 'Courier New', monospace; font-size: 10pt; background: #f3f4f6; border: 1px solid #e5e7eb; padding: 1px 5px; border-radius: 3px; }
  pre { background: #1e293b; color: #e2e8f0; font-family: 'Courier New', monospace; font-size: 9pt; padding: 14px 16px; border-radius: 6px; margin: 12px 0; overflow-x: auto; white-space: pre-wrap; }
  blockquote { border-left: 3px solid #4f46e5; padding: 8px 16px; background: #eef2ff; margin: 12px 0; border-radius: 0 6px 6px 0; font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  th { background: #4f46e5; color: white; padding: 8px 12px; text-align: left; font-weight: 600; }
  td { padding: 7px 12px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
  strong { color: #111827; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
${markdownToHtmlString(content)}
</body>
</html>`

  const win = window.open('', '_blank')
  win.document.write(htmlContent)
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
    // win.close() — let user close after saving
  }, 500)
}

// Very simple markdown → HTML string for PDF popup
function markdownToHtmlString(md) {
  return md
    .split('\n')
    .map((line) => {
      if (line.match(/^### (.+)/)) return `<h3>${line.slice(4)}</h3>`
      if (line.match(/^## (.+)/)) return `<h2>${line.slice(3)}</h2>`
      if (line.match(/^# (.+)/)) return `<h1>${line.slice(2)}</h1>`
      if (line.trim() === '---') return '<hr>'
      if (line.startsWith('> '))
        return `<blockquote>${line.slice(2)}</blockquote>`
      if (line.match(/^[-*] /)) return `<li>${line.slice(2)}</li>`
      if (line.match(/^\d+\. /))
        return `<li>${line.replace(/^\d+\. /, '')}</li>`
      if (line.trim() === '') return '<br>'
      return `<p>${line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')}</p>`
    })
    .join('\n')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const ALL_TABS = [
  { id: 'user', label: '👤 User Docs', badge: 'For everyone' },
  { id: 'dev', label: '⚙️ Dev Docs', badge: 'Technical' },
  { id: 'readme', label: '📄 README', badge: 'For GitHub' },
  { id: 'interview', label: '🎯 Interview Prep', badge: 'Job-ready' },
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
  Dart: '#00b4ab',
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DocOutput({ data }) {
  // Only show tabs for docs that were actually generated
  const availableTabs = ALL_TABS.filter((t) => data[t.id])
  const [activeTab, setActiveTab] = useState(availableTabs[0]?.id || 'user')
  const [viewMode, setViewMode] = useState('rendered')
  const [copied, setCopied] = useState('')
  const [format, setFormat] = useState('md')
  const contentRef = useRef(null)

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [activeTab])

  const content = {
    user: data.user,
    dev: data.dev,
    readme: data.readme,
    interview: data.interview,
  }

  const filenames = {
    user: { md: 'user-docs.md', docx: 'user-docs.docx', pdf: 'user-docs.pdf' },
    dev: { md: 'dev-docs.md', docx: 'dev-docs.docx', pdf: 'dev-docs.pdf' },
    readme: { md: 'README.md', docx: 'README.docx', pdf: 'README.pdf' },
    interview: {
      md: 'interview-prep.md',
      docx: 'interview-prep.docx',
      pdf: 'interview-prep.pdf',
    },
  }

  const tabTitles = {
    user: 'User Documentation',
    dev: 'Developer Documentation',
    readme: `${data.repoData.repo} README`,
    interview: 'Interview Prep Guide',
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(content[activeTab])
    setCopied(activeTab)
    setTimeout(() => setCopied(''), 2000)
  }

  const handleDownload = async () => {
    const text = content[activeTab]
    const fname = filenames[activeTab][format]
    const title = tabTitles[activeTab]
    if (format === 'md') return downloadMd(text, fname)
    if (format === 'docx') return downloadDocx(text, fname)
    if (format === 'pdf') return downloadPdf(text, title, fname)
  }

  return (
    <div className="output-section">
      {/* ── Repo header ── */}
      <div className="repo-meta">
        <div className="repo-title-row">
          <div className="repo-badge">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ opacity: 0.7 }}
            >
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            <span className="repo-name">
              <span className="repo-owner">{data.repoData.owner}</span>
              <span className="repo-sep">/</span>
              <strong>{data.repoData.repo}</strong>
            </span>
            {data.repoData.isFrontend && (
              <span className="frontend-badge">frontend</span>
            )}
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
          <div className="repo-stats">
            {data.repoData.stars > 0 && (
              <span className="stat-badge">
                ⭐ {data.repoData.stars.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="lang-badges">
          {Object.keys(data.repoData.languages)
            .slice(0, 5)
            .map((lang) => (
              <span
                key={lang}
                className="lang-tag"
                style={{ '--lang-color': LANG_COLORS[lang] || '#888' }}
              >
                <span className="lang-dot" />
                {lang}
              </span>
            ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-label">{tab.label}</span>
            <span className="tab-badge">{tab.badge}</span>
          </button>
        ))}
      </div>

      {/* ── Doc panel ── */}
      <div className="doc-panel">
        {/* Actions bar */}
        <div className="doc-actions">
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'rendered' ? 'active' : ''}`}
              onClick={() => setViewMode('rendered')}
            >
              ✦ Preview
            </button>
            <button
              className={`view-btn ${viewMode === 'raw' ? 'active' : ''}`}
              onClick={() => setViewMode('raw')}
            >
              {'<>'} Markdown
            </button>
          </div>

          <div className="action-group">
            <button className="action-btn" onClick={handleCopy}>
              {copied === activeTab ? '✅ Copied!' : '📋 Copy'}
            </button>

            {/* Format selector + download */}
            <div className="download-group">
              <select
                className="format-select"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                aria-label="Download format"
              >
                <option value="md">⬇ .md</option>
                <option value="docx">⬇ .docx</option>
                <option value="pdf">⬇ .pdf</option>
              </select>
              <button className="action-btn primary" onClick={handleDownload}>
                Download
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} className="doc-content">
          {viewMode === 'raw' ? (
            <pre className="raw-content">{content[activeTab]}</pre>
          ) : (
            <div className="rendered-content">
              {renderMarkdown(content[activeTab])}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
