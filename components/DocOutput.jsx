'use client'
import { useState, useRef, useEffect } from 'react'

// ─── Inline markdown → HTML string (for PDF) ─────────────────────────────────
function inlineToHtml(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
}

// ─── Full markdown → clean HTML body (for PDF) ───────────────────────────────
function markdownToHtml(md) {
  if (!md) return ''
  const lines = md.split('\n')
  const out = []
  let i = 0
  let inUl = false,
    inOl = false

  const closeList = () => {
    if (inUl) {
      out.push('</ul>')
      inUl = false
    }
    if (inOl) {
      out.push('</ol>')
      inOl = false
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      closeList()
      const lang = line.trim().slice(3).trim()
      const code = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        code.push(
          lines[i]
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;'),
        )
        i++
      }
      const isDiagram = /[┌│└─▶→▲▼╔╗╚╝║═┐┘├┤┬┴┼]/.test(code.join(''))
      out.push(
        `<pre class="${isDiagram ? 'diagram' : 'code'}"><code>${code.join('\n')}</code></pre>`,
      )
      i++
      continue
    }

    // Table
    if (line.includes('|') && lines[i + 1]?.match(/^\|[-: |]+\|$/)) {
      closeList()
      const heads = line
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean)
      i += 2
      const rows = []
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(
          lines[i]
            .split('|')
            .map((c) => c.trim())
            .filter(Boolean),
        )
        i++
      }
      out.push('<div class="tbl-wrap"><table>')
      out.push(
        '<thead><tr>' +
          heads.map((h) => `<th>${inlineToHtml(h)}</th>`).join('') +
          '</tr></thead>',
      )
      out.push(
        '<tbody>' +
          rows
            .map(
              (r) =>
                '<tr>' +
                r.map((c) => `<td>${inlineToHtml(c)}</td>`).join('') +
                '</tr>',
            )
            .join('') +
          '</tbody>',
      )
      out.push('</table></div>')
      continue
    }

    // Image
    const imgM = line.match(/^!\[(.+?)\]\((.+?)\)$/)
    if (imgM) {
      closeList()
      out.push(
        `<div class="img-wrap"><img src="${imgM[2]}" alt="${inlineToHtml(imgM[1])}" /></div>`,
      )
      i++
      continue
    }

    // Blockquote
    if (line.startsWith('>')) {
      closeList()
      out.push(`<blockquote>${inlineToHtml(line.slice(1).trim())}</blockquote>`)
      i++
      continue
    }

    // Headings
    const h1 = line.match(/^# (.+)/)
    if (h1) {
      closeList()
      out.push(`<h1>${inlineToHtml(h1[1])}</h1>`)
      i++
      continue
    }
    const h2 = line.match(/^## (.+)/)
    if (h2) {
      closeList()
      out.push(`<h2>${inlineToHtml(h2[1])}</h2>`)
      i++
      continue
    }
    const h3 = line.match(/^### (.+)/)
    if (h3) {
      closeList()
      out.push(`<h3>${inlineToHtml(h3[1])}</h3>`)
      i++
      continue
    }
    const h4 = line.match(/^#### (.+)/)
    if (h4) {
      closeList()
      out.push(`<h4>${inlineToHtml(h4[1])}</h4>`)
      i++
      continue
    }

    // HR
    if (/^---+$/.test(line.trim())) {
      closeList()
      out.push('<hr>')
      i++
      continue
    }

    // Unordered list (with sub-bullet support)
    if (/^[-*] /.test(line)) {
      if (inOl) {
        out.push('</ol>')
        inOl = false
      }
      if (!inUl) {
        out.push('<ul>')
        inUl = true
      }
      const txt = line.replace(/^[-*] /, '')
      const subItems = []
      let j = i + 1
      while (j < lines.length && /^  [-*] /.test(lines[j])) {
        subItems.push(lines[j].replace(/^  [-*] /, ''))
        j++
      }
      if (subItems.length) {
        out.push(
          `<li>${inlineToHtml(txt)}<ul>${subItems.map((s) => `<li>${inlineToHtml(s)}</li>`).join('')}</ul></li>`,
        )
        i = j
      } else {
        out.push(`<li>${inlineToHtml(txt)}</li>`)
        i++
      }
      continue
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      if (inUl) {
        out.push('</ul>')
        inUl = false
      }
      if (!inOl) {
        out.push('<ol>')
        inOl = true
      }
      out.push(`<li>${inlineToHtml(line.replace(/^\d+\. /, ''))}</li>`)
      i++
      continue
    }

    // Empty line
    if (!line.trim()) {
      closeList()
      out.push('<div class="sp"></div>')
      i++
      continue
    }

    // Paragraph
    closeList()
    out.push(`<p>${inlineToHtml(line)}</p>`)
    i++
  }
  closeList()
  return out.join('\n')
}

// ─── Build full styled PDF HTML document ─────────────────────────────────────
function buildPdfHtml(title, docType, content) {
  const themes = {
    user: {
      accent: '#7c3aed',
      light: '#f5f3ff',
      dark: '#4c1d95',
      badge: '👤 User Documentation',
    },
    dev: {
      accent: '#0f766e',
      light: '#f0fdfa',
      dark: '#134e4a',
      badge: '⚙️ Developer Documentation',
    },
    readme: {
      accent: '#1d4ed8',
      light: '#eff6ff',
      dark: '#1e3a8a',
      badge: '📄 README',
    },
    interview: {
      accent: '#b45309',
      light: '#fffbeb',
      dark: '#78350f',
      badge: '🎯 Interview Preparation',
    },
  }
  const { accent, light, dark, badge } = themes[docType] || themes.dev
  const body = markdownToHtml(content)
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
  html { font-size: 11pt }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
    color: #1f2937;
    background: #fff;
    line-height: 1.75;
    max-width: 820px;
    margin: 0 auto;
  }

  /* Cover */
  .cover {
    background: linear-gradient(135deg, ${dark} 0%, ${accent} 100%);
    color: #fff;
    padding: 44px 52px 36px;
  }
  .cover-badge {
    display: inline-block;
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 20px;
    padding: 4px 14px;
    font-size: 9pt;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .cover h1 {
    font-size: 28pt;
    font-weight: 800;
    letter-spacing: -0.025em;
    line-height: 1.1;
    margin-bottom: 10px;
    color: #fff;
    border: none; padding: 0;
  }
  .cover-sub { font-size: 10pt; opacity: 0.75 }
  .cover-stripe {
    height: 5px;
    background: linear-gradient(90deg, ${accent}22, ${accent}, ${accent}22);
    margin-bottom: 44px;
  }

  /* Content */
  .content { padding: 0 52px 56px }

  /* Headings */
  h1 {
    font-size: 19pt; font-weight: 800; color: ${accent};
    border-bottom: 2px solid ${accent};
    padding-bottom: 8px; margin: 38px 0 14px; line-height: 1.2;
  }
  h2 {
    font-size: 13.5pt; font-weight: 700; color: #111827;
    border-left: 4px solid ${accent};
    padding-left: 12px; margin: 30px 0 10px; line-height: 1.3;
  }
  h3 {
    font-size: 11pt; font-weight: 700; color: ${accent};
    margin: 22px 0 8px;
  }
  h4 {
    font-size: 9.5pt; font-weight: 700; color: #6b7280;
    text-transform: uppercase; letter-spacing: 0.08em;
    margin: 16px 0 6px;
  }

  /* Body text */
  p { margin: 0 0 10px; color: #374151 }
  a { color: ${accent} }
  strong { font-weight: 700; color: #111827 }
  em { font-style: italic; color: #4b5563 }

  /* Lists */
  ul { margin: 8px 0 14px; padding: 0; list-style: none }
  ul > li {
    position: relative; padding-left: 18px;
    margin-bottom: 5px; color: #374151;
  }
  ul > li::before {
    content: ''; position: absolute; left: 2px; top: 8px;
    width: 7px; height: 7px; border-radius: 50%;
    background: ${accent};
  }
  ul ul { margin: 4px 0 4px 10px }
  ul ul > li::before { width: 5px; height: 5px; background: #9ca3af; top: 9px }
  ol { margin: 8px 0 14px; padding: 0; counter-reset: li; list-style: none }
  ol > li {
    position: relative; padding-left: 30px;
    margin-bottom: 6px; counter-increment: li; color: #374151;
  }
  ol > li::before {
    content: counter(li);
    position: absolute; left: 0; top: 1px;
    width: 21px; height: 21px; border-radius: 50%;
    background: ${accent}; color: #fff;
    font-size: 8pt; font-weight: 700; text-align: center;
    line-height: 21px;
  }

  /* Code */
  code {
    font-family: 'Cascadia Code', 'Fira Code', 'Courier New', monospace;
    font-size: 9pt; background: ${light}; color: ${dark};
    border: 1px solid ${accent}33; padding: 1px 5px; border-radius: 4px;
  }
  pre {
    background: #0f172a; color: #e2e8f0;
    font-family: 'Cascadia Code', 'Fira Code', 'Courier New', monospace;
    font-size: 8.5pt; line-height: 1.6;
    padding: 16px 20px; border-radius: 8px;
    margin: 12px 0 16px;
    white-space: pre-wrap; word-break: break-all;
    border-left: 4px solid ${accent};
    page-break-inside: avoid;
  }
  pre code { background: none; border: none; padding: 0; color: inherit; font-size: inherit }
  pre.diagram { background: #1e1b4b; color: #a5b4fc; border-left-color: #818cf8 }

  /* Blockquote */
  blockquote {
    border-left: 4px solid ${accent};
    background: ${light};
    padding: 12px 18px; margin: 14px 0 18px;
    border-radius: 0 8px 8px 0;
    font-style: italic; color: #374151;
    page-break-inside: avoid;
  }

  /* Tables */
  .tbl-wrap {
    margin: 14px 0 20px;
    border-radius: 8px; overflow: hidden;
    box-shadow: 0 1px 6px rgba(0,0,0,0.09);
    page-break-inside: avoid;
  }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt }
  thead tr { background: ${accent}; color: #fff }
  th { padding: 9px 14px; text-align: left; font-weight: 700; font-size: 9pt; letter-spacing: 0.02em }
  td { padding: 8px 14px; color: #374151; vertical-align: top; border-bottom: 1px solid #e5e7eb }
  tbody tr:nth-child(even) { background: ${light} }
  tbody tr:last-child td { border-bottom: none }

  /* HR */
  hr {
    border: none; height: 1px;
    background: linear-gradient(90deg, transparent, ${accent}55, transparent);
    margin: 26px 0;
  }

  /* Misc */
  .sp { height: 6px }
  .img-wrap { margin: 14px 0 }
  img { max-width: 100%; border-radius: 8px }

  /* Print */
  h1, h2, h3 { page-break-after: avoid }
  @media print {
    body { max-width: 100% }
    .cover, thead tr, tbody tr:nth-child(even), pre, h2 {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
</head>
<body>
  <div class="cover">
    <div class="cover-badge">${badge}</div>
    <h1>${title}</h1>
    <div class="cover-sub">Generated by GitDoc &nbsp;·&nbsp; ${date}</div>
  </div>
  <div class="cover-stripe"></div>
  <div class="content">
    ${body}
  </div>
</body>
</html>`
}

// ─── Inline markdown → React (web preview) ───────────────────────────────────
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

// ─── Block markdown → React ───────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

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

    const imgMatch = line.match(/^!\[(.+?)\]\((.+?)\)$/)
    if (imgMatch) {
      out.push(
        <div key={i} className="md-img-wrap">
          <img
            src={imgMatch[2]}
            alt={imgMatch[1]}
            className="md-img"
            loading="lazy"
          />
          {imgMatch[1] && imgMatch[1] !== 'image' && (
            <span className="md-img-caption">{imgMatch[1]}</span>
          )}
        </div>,
      )
      i++
      continue
    }

    if (line.startsWith('>')) {
      out.push(
        <blockquote key={i} className="md-bq">
          {inlineMarkdown(line.slice(1).trim())}
        </blockquote>,
      )
      i++
      continue
    }

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

    if (/^---+$/.test(line.trim())) {
      out.push(<hr key={i} className="md-hr" />)
      i++
      continue
    }

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

// ─── Parse inline markdown for docx TextRun children ─────────────────────────
function parseInlineDocx(text, TextRun) {
  const runs = []
  let rem = text
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
      if (rem) runs.push(new TextRun({ text: rem }))
      break
    }
    const { type, m } = hits[0]
    if (m.index > 0) runs.push(new TextRun({ text: rem.slice(0, m.index) }))
    if (type === 'bold') runs.push(new TextRun({ text: m[1], bold: true }))
    if (type === 'italic') runs.push(new TextRun({ text: m[1], italics: true }))
    if (type === 'code')
      runs.push(
        new TextRun({
          text: m[1],
          font: 'Courier New',
          size: 18,
          color: '0F766E',
        }),
      )
    if (type === 'link')
      runs.push(new TextRun({ text: m[1], color: '4F46E5', underline: {} }))
    rem = rem.slice(m.index + m[0].length)
  }
  return runs.length ? runs : [new TextRun({ text: text })]
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

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [activeTab])

  const current = data[activeTab] || ''
  const repoName = data.repoData?.repo || 'project'

  const handleCopy = () => {
    navigator.clipboard.writeText(current)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = async () => {
    const names = {
      user: 'user-docs',
      dev: 'dev-docs',
      readme: 'README',
      interview: 'interview-prep',
    }
    const filename = names[activeTab]

    // ── PDF ──────────────────────────────────────────────────────────────────
    if (format === 'pdf') {
      const docTitles = {
        user: `${repoName} — User Guide`,
        dev: `${repoName} — Developer Docs`,
        readme: `${repoName} — README`,
        interview: `${repoName} — Interview Prep`,
      }
      const html = buildPdfHtml(
        docTitles[activeTab] || repoName,
        activeTab,
        current,
      )
      const w = window.open('', '_blank')
      if (!w) {
        alert('Pop-up blocked — please allow pop-ups and try again')
        return
      }
      w.document.write(html)
      w.document.close()
      w.focus()
      setTimeout(() => w.print(), 700)
      return
    }

    // ── DOCX ─────────────────────────────────────────────────────────────────
    if (format === 'docx') {
      try {
        if (!window.docx) {
          const script = document.createElement('script')
          script.src =
            'https://cdnjs.cloudflare.com/ajax/libs/docx/9.0.2/docx.umd.min.js'
          await new Promise((res, rej) => {
            script.onload = res
            script.onerror = rej
            document.head.appendChild(script)
          })
        }
        const {
          Document,
          Packer,
          Paragraph,
          TextRun,
          HeadingLevel,
          Table,
          TableRow,
          TableCell,
          WidthType,
          BorderStyle,
          AlignmentType,
          ShadingType,
          convertInchesToTwip,
        } = window.docx

        const accentMap = {
          user: '7C3AED',
          dev: '0F766E',
          readme: '1D4ED8',
          interview: 'B45309',
        }
        const accent = accentMap[activeTab] || '4F46E5'
        const lightMap = {
          user: 'F5F3FF',
          dev: 'F0FDFA',
          readme: 'EFF6FF',
          interview: 'FFFBEB',
        }
        const light = lightMap[activeTab] || 'F5F3FF'

        const docTitles = {
          user: `${repoName} — User Guide`,
          dev: `${repoName} — Developer Documentation`,
          readme: `${repoName} — README`,
          interview: `${repoName} — Interview Preparation`,
        }

        const children = []

        // Title block
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: docTitles[activeTab] || repoName,
                bold: true,
                size: 56,
                color: accent,
                font: 'Segoe UI',
              }),
            ],
            spacing: { after: 160 },
          }),
        )
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated by GitDoc  ·  ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
                size: 20,
                color: '9CA3AF',
                italics: true,
              }),
            ],
            spacing: { after: 480 },
            border: {
              bottom: { color: accent, size: 10, style: BorderStyle.SINGLE },
            },
          }),
        )

        const lines = current.split('\n')

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]

          if (/^# (.+)/.test(line)) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: line.slice(2),
                    bold: true,
                    size: 38,
                    color: accent,
                    font: 'Segoe UI',
                  }),
                ],
                spacing: { before: 400, after: 140 },
                border: {
                  bottom: { color: accent, size: 6, style: BorderStyle.SINGLE },
                },
              }),
            )
            continue
          }
          if (/^## (.+)/.test(line)) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: line.slice(3),
                    bold: true,
                    size: 28,
                    color: '111827',
                    font: 'Segoe UI',
                  }),
                ],
                spacing: { before: 300, after: 100 },
                border: {
                  left: { color: accent, size: 20, style: BorderStyle.SINGLE },
                },
                indent: { left: 200 },
              }),
            )
            continue
          }
          if (/^### (.+)/.test(line)) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: line.slice(4),
                    bold: true,
                    size: 24,
                    color: accent,
                    font: 'Segoe UI',
                  }),
                ],
                spacing: { before: 220, after: 80 },
              }),
            )
            continue
          }

          if (/^---+$/.test(line.trim())) {
            children.push(
              new Paragraph({
                text: '',
                spacing: { before: 140, after: 140 },
                border: {
                  bottom: {
                    color: `${accent}`,
                    size: 4,
                    style: BorderStyle.SINGLE,
                  },
                },
              }),
            )
            continue
          }

          if (/^!\[(.+?)\]\((.+?)\)$/.test(line)) {
            const m = line.match(/^!\[(.+?)\]\((.+?)\)$/)
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `[Image: ${m[1]}]`,
                    italics: true,
                    color: '9CA3AF',
                    size: 18,
                  }),
                ],
                spacing: { before: 80, after: 80 },
              }),
            )
            continue
          }

          if (line.startsWith('> ')) {
            children.push(
              new Paragraph({
                children: parseInlineDocx(line.slice(2), TextRun).map(
                  (r) => new TextRun({ ...r, italics: true }),
                ),
                indent: { left: 720 },
                spacing: { before: 80, after: 80 },
                border: {
                  left: { color: accent, size: 18, style: BorderStyle.SINGLE },
                },
                shading: { type: ShadingType.CLEAR, fill: light },
              }),
            )
            continue
          }

          if (/^[-*] /.test(line)) {
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                children: parseInlineDocx(line.replace(/^[-*] /, ''), TextRun),
                spacing: { before: 50, after: 50 },
              }),
            )
            continue
          }

          if (/^\d+\. /.test(line)) {
            children.push(
              new Paragraph({
                numbering: { reference: 'default-numbering', level: 0 },
                children: parseInlineDocx(line.replace(/^\d+\. /, ''), TextRun),
                spacing: { before: 50, after: 50 },
              }),
            )
            continue
          }

          if (line.trimStart().startsWith('```')) {
            const codeLines = []
            i++
            while (
              i < lines.length &&
              !lines[i].trimStart().startsWith('```')
            ) {
              codeLines.push(lines[i])
              i++
            }
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: codeLines.join('\n'),
                    font: 'Courier New',
                    size: 18,
                    color: 'E2E8F0',
                  }),
                ],
                spacing: { before: 140, after: 140 },
                shading: { type: ShadingType.CLEAR, fill: '0F172A' },
                indent: { left: 360, right: 360 },
              }),
            )
            continue
          }

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
            i--
            const colW = Math.floor(9000 / Math.max(heads.length, 1))
            const headerRow = new TableRow({
              tableHeader: true,
              children: heads.map(
                (h) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: h,
                            bold: true,
                            color: 'FFFFFF',
                            size: 20,
                            font: 'Segoe UI',
                          }),
                        ],
                      }),
                    ],
                    shading: { type: ShadingType.CLEAR, fill: accent },
                    width: { size: colW, type: WidthType.DXA },
                    margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  }),
              ),
            })
            const dataRows = rows.map(
              (row, ri) =>
                new TableRow({
                  children: row.map(
                    (cell) =>
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: parseInlineDocx(cell, TextRun),
                            spacing: { before: 40, after: 40 },
                          }),
                        ],
                        shading: {
                          type: ShadingType.CLEAR,
                          fill: ri % 2 === 0 ? 'FFFFFF' : light,
                        },
                        width: { size: colW, type: WidthType.DXA },
                        margins: { top: 60, bottom: 60, left: 120, right: 120 },
                      }),
                  ),
                }),
            )
            children.push(
              new Table({
                rows: [headerRow, ...dataRows],
                width: { size: 9000, type: WidthType.DXA },
              }),
            )
            children.push(new Paragraph({ text: '', spacing: { after: 140 } }))
            continue
          }

          if (!line.trim()) {
            children.push(new Paragraph({ text: '', spacing: { after: 70 } }))
            continue
          }

          children.push(
            new Paragraph({
              children: parseInlineDocx(line, TextRun),
              spacing: { before: 60, after: 60 },
            }),
          )
        }

        const doc = new Document({
          styles: {
            default: {
              document: {
                run: { font: 'Segoe UI', size: 22, color: '374151' },
                paragraph: { spacing: { line: 340 } },
              },
            },
          },
          numbering: {
            config: [
              {
                reference: 'default-numbering',
                levels: [
                  {
                    level: 0,
                    format: 'decimal',
                    text: '%1.',
                    alignment: AlignmentType.START,
                    style: {
                      paragraph: { indent: { left: 720, hanging: 360 } },
                    },
                  },
                ],
              },
            ],
          },
          sections: [
            {
              properties: {
                page: {
                  margin: {
                    top: convertInchesToTwip(1),
                    bottom: convertInchesToTwip(1),
                    left: convertInchesToTwip(1.2),
                    right: convertInchesToTwip(1.2),
                  },
                },
              },
              children,
            },
          ],
        })

        const blob = await Packer.toBlob(doc)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${filename}.docx`
        a.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        console.error('DOCX generation failed:', err)
        alert('DOCX generation failed — try .md instead')
      }
      return
    }

    // ── Markdown ──────────────────────────────────────────────────────────────
    const blob = new Blob([current], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="output-section">
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

      <div className="tabs-bar">
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

      <div className="doc-panel">
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
                <option value="docx">.docx</option>
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
