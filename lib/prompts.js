// ─── Pre-compute hard facts from repoData in JS ────────────────────────────
// This runs BEFORE the prompt is built so every fact is a real value,
// not a placeholder the LLM has to guess at.

function extractFacts(repoData) {
  let pkg = {}
  try {
    pkg = JSON.parse(repoData.fileContents['package.json'] || '{}')
  } catch {}

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  }
  const depNames = Object.keys(allDeps)
  const hasDep = (d) => depNames.includes(d)
  const hasAny = (...ds) => ds.some(hasDep)

  // Framework
  const framework = hasDep('next')
    ? 'Next.js'
    : hasDep('react')
      ? 'React'
      : hasDep('vue')
        ? 'Vue.js'
        : hasDep('@angular/core')
          ? 'Angular'
          : hasDep('svelte')
            ? 'Svelte'
            : hasDep('astro')
              ? 'Astro'
              : hasDep('express')
                ? 'Express.js'
                : hasDep('fastify')
                  ? 'Fastify'
                  : hasDep('hono')
                    ? 'Hono'
                    : hasDep('koa')
                      ? 'Koa'
                      : repoData.fileContents['main.py'] ||
                          repoData.fileContents['app.py']
                        ? 'Python'
                        : repoData.language
                          ? repoData.language
                          : 'unknown'

  // DB / ORM
  const db = hasDep('prisma')
    ? 'Prisma + PostgreSQL'
    : hasDep('drizzle-orm')
      ? 'Drizzle ORM'
      : hasDep('@supabase/supabase-js')
        ? 'Supabase (Postgres)'
        : hasDep('mongoose')
          ? 'MongoDB + Mongoose'
          : hasDep('pg')
            ? 'PostgreSQL (pg)'
            : hasDep('mysql2')
              ? 'MySQL'
              : hasDep('better-sqlite3') || hasDep('sqlite3')
                ? 'SQLite'
                : hasDep('typeorm')
                  ? 'TypeORM'
                  : hasDep('sequelize')
                    ? 'Sequelize'
                    : hasDep('firebase')
                      ? 'Firebase / Firestore'
                      : null

  // Auth
  const auth = hasDep('next-auth')
    ? 'NextAuth.js'
    : hasDep('@clerk/nextjs') || hasDep('clerk')
      ? 'Clerk'
      : hasDep('@supabase/supabase-js')
        ? 'Supabase Auth'
        : hasDep('firebase')
          ? 'Firebase Auth'
          : hasDep('passport')
            ? 'Passport.js'
            : hasDep('jsonwebtoken')
              ? 'JWT (manual)'
              : hasDep('lucia')
                ? 'Lucia Auth'
                : null

  // State management
  const state = hasDep('zustand')
    ? 'Zustand'
    : hasDep('jotai')
      ? 'Jotai'
      : hasDep('recoil')
        ? 'Recoil'
        : hasDep('@reduxjs/toolkit') || hasDep('redux')
          ? 'Redux Toolkit'
          : hasDep('mobx')
            ? 'MobX'
            : hasDep('valtio')
              ? 'Valtio'
              : null

  // Data fetching
  const fetching =
    hasDep('@tanstack/react-query') || hasDep('react-query')
      ? 'TanStack Query'
      : hasDep('swr')
        ? 'SWR'
        : hasDep('@apollo/client')
          ? 'Apollo Client'
          : hasDep('axios')
            ? 'Axios'
            : null

  // Testing
  const testing =
    hasAny('jest', 'vitest', 'mocha', 'jasmine', 'ava') ||
    hasAny('cypress', 'playwright', '@testing-library/react') ||
    hasAny('pytest', 'unittest')

  const testLib = hasDep('vitest')
    ? 'Vitest'
    : hasDep('jest')
      ? 'Jest'
      : hasDep('cypress')
        ? 'Cypress'
        : hasDep('playwright')
          ? 'Playwright'
          : hasDep('mocha')
            ? 'Mocha'
            : null

  // Infra / tooling
  const hasDocker = repoData.allFiles.some((f) =>
    /dockerfile|docker-compose/i.test(f),
  )
  const hasCI = repoData.allFiles.some(
    (f) =>
      f.includes('.github') ||
      f.includes('vercel.json') ||
      f.includes('.gitlab-ci'),
  )
  const hasTS =
    Object.keys(repoData.languages || {}).includes('TypeScript') ||
    hasDep('typescript')
  const isMonorepo = repoData.allFiles.some((f) =>
    [
      'packages',
      'apps',
      'lerna.json',
      'pnpm-workspace.yaml',
      'turbo.json',
    ].includes(f),
  )
  const hasTRPC = hasAny('@trpc/server', '@trpc/client')
  const hasGraphQL = hasAny('graphql', '@apollo/server', '@apollo/client')
  const hasStripe = hasDep('stripe')
  const hasRedis = hasAny('redis', 'ioredis', '@upstash/redis')
  const hasSocket = hasAny('socket.io', 'ws', 'pusher')
  const hasZod = hasDep('zod')
  const hasTailwind = hasDep('tailwindcss')
  const hasOpenAI = hasAny('openai', '@anthropic-ai/sdk', 'langchain')
  const hasPrisma = hasDep('prisma')

  // npm scripts
  const scripts =
    Object.entries(pkg.scripts || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ') || 'none'

  // Key deps (filter noise)
  const noiseDeps = new Set([
    'typescript',
    'eslint',
    'prettier',
    '@types/node',
    'ts-node',
    'nodemon',
    'dotenv',
    'cross-env',
    'rimraf',
    'concurrently',
    'husky',
    'lint-staged',
  ])
  const keyDeps = depNames.filter((d) => !noiseDeps.has(d)).slice(0, 10)

  // Package manager hint
  const pkgManager = repoData.allFiles.includes('bun.lockb')
    ? 'bun'
    : repoData.allFiles.includes('pnpm-lock.yaml')
      ? 'pnpm'
      : repoData.allFiles.includes('yarn.lock')
        ? 'yarn'
        : 'npm'

  const installCmd =
    pkgManager === 'bun'
      ? 'bun install'
      : pkgManager === 'pnpm'
        ? 'pnpm install'
        : pkgManager === 'yarn'
          ? 'yarn'
          : 'npm install'
  const devCmd = pkg.scripts?.dev
    ? `${pkgManager === 'npm' ? 'npm run' : pkgManager} dev`
    : pkg.scripts?.start
      ? `${pkgManager === 'npm' ? 'npm run' : pkgManager} start`
      : repoData.fileContents['main.py']
        ? 'python main.py'
        : repoData.fileContents['app.py']
          ? 'python app.py'
          : 'npm run dev'

  return {
    framework,
    db,
    auth,
    state,
    fetching,
    testing,
    testLib,
    hasDocker,
    hasCI,
    hasTS,
    isMonorepo,
    hasTRPC,
    hasGraphQL,
    hasStripe,
    hasRedis,
    hasSocket,
    hasZod,
    hasTailwind,
    hasOpenAI,
    hasPrisma,
    keyDeps,
    scripts,
    pkgManager,
    installCmd,
    devCmd,
    langs: Object.keys(repoData.languages || {}),
    hasPkg: !!repoData.fileContents['package.json'],
    desc: repoData.description || 'No description',
    repo: repoData.repo,
    owner: repoData.owner,
    homepage: repoData.homepage || null,
    stars: repoData.stars || 0,
    allFiles: repoData.allFiles.slice(0, 30).join(', '),
  }
}

function trimFiles(fileContents, max = 1400) {
  return Object.entries(fileContents)
    .map(
      ([name, content]) =>
        `### ${name}\n\`\`\`\n${content.slice(0, max)}\n\`\`\``,
    )
    .join('\n\n')
}

// ─── User Doc ─────────────────────────────────────────────────────────────────

export function buildUserDocPrompt(repoData) {
  const f = extractFacts(repoData)

  return `You write docs like a sharp product designer, not a tech writer. Warm, visual, scannable. Every sentence pulls its weight. If it's boring, cut it.

THIS PROJECT:
- Name: ${f.repo}
- What it is: ${f.desc}
- Built with: ${f.framework}${f.hasTS ? ' + TypeScript' : ''}${f.db ? ' + ' + f.db : ''}
- Live at: ${f.homepage || 'not deployed'}
- Files: ${f.allFiles}

Code:
${trimFiles(repoData.fileContents)}

Write the user doc. Sections in this exact order. Be specific to THIS project — reference real features from the code.

---
${f.homepage ? `\n> 🚀 **[Open ${f.repo} — nothing to install](${f.homepage})**\n` : ''}

# ${f.repo}

One punchy sentence. What problem does it kill? Who cares? No fluff.

---

## What it actually does

2 sentences max. Start with the frustration it solves. End with what's now possible. If a smart 15-year-old wouldn't understand a word, swap it.

---

## What you can do with it

Turn real features from the code into a table. No generic bullets:

| Do this | And you get |
|---------|------------|
| [specific action in the UI/CLI] | [specific outcome, not "it works"] |
| [specific action] | [specific outcome] |
[4–6 rows max, only real features visible in the code]

---

## How it works ↓

Draw the actual flow for THIS project using real step names. Not generic boxes:

\`\`\`
  You                 ${f.repo}              ${f.db ? f.db : 'Output'}
   │                      │                      │
   │── [specific action] ▶│                      │
   │                      │── [what happens] ───▶│
   │                      │◀── [what comes back] ─│
   │◀── [what you see] ───│                      │
\`\`\`

One sentence explaining it like you're texting a friend.

---

## Get it running

${
  f.homepage
    ? `It lives online — zero setup.\n\n1. Open **[${f.homepage}](${f.homepage})**\n2. [First thing the user sees — be specific based on the UI]\n3. [Next action, one sentence]\n4. [Continue, max 5 steps total]`
    : `\`\`\`bash\ngit clone https://github.com/${f.owner}/${f.repo}.git\ncd ${f.repo}\n${f.installCmd}\n${f.devCmd}\n\`\`\`\n\nThree sentences max. What each command does in plain English. No jargon.`
}

---

## Real example

> Imagine you want to [specific use case for THIS tool, not a generic example]...

Walk it from start to result in 3–4 sentences. Make the reader go "oh yeah, I need that."

---

## Quick answers

Pick questions someone would ACTUALLY ask about THIS specific project:

**[Most obvious question about ${f.repo} specifically]**
→ [Direct answer, 1–2 sentences, no hedging]

**[Second question — about a feature or limitation unique to this tool]**
→ [Direct answer]

**[One thing that surprises new users of this type of tool]**
→ [Direct answer]

---

RULES: No sentence over 25 words. No paragraph over 2 sentences. No jargon without instant plain-English explanation. Always "you/your". BANNED: straightforward, simple, easy, just, seamlessly, leverage, robust, powerful, enables, allows you to, in order to, utilize.`
}

// ─── Dev Doc ──────────────────────────────────────────────────────────────────

export function buildDevDocPrompt(repoData) {
  const f = extractFacts(repoData)

  return `You're a staff engineer writing the internal technical doc for ${f.repo}. Opinionated, precise, scannable. Think ADR + code review. Every line = a specific insight. No filler.

HARD FACTS (ground every claim here):
- Stack: ${f.framework}${f.hasTS ? ' + TypeScript' : ''}
- DB: ${f.db || 'none'}
- Auth: ${f.auth || 'none'}
- State: ${f.state || 'none/local'}
- Data fetching: ${f.fetching || 'native fetch'}
- tRPC: ${f.hasTRPC ? 'yes' : 'no'} | GraphQL: ${f.hasGraphQL ? 'yes' : 'no'}
- Zod: ${f.hasZod ? 'yes' : 'no'} | Tailwind: ${f.hasTailwind ? 'yes' : 'no'}
- Redis: ${f.hasRedis ? 'yes' : 'no'} | Sockets: ${f.hasSocket ? 'yes' : 'no'}
- Stripe: ${f.hasStripe ? 'yes' : 'no'} | AI/LLM: ${f.hasOpenAI ? 'yes' : 'no'}
- Testing: ${f.testLib || 'none'}
- Docker: ${f.hasDocker ? 'yes' : 'no'} | CI: ${f.hasCI ? 'yes' : 'no'}
- Monorepo: ${f.isMonorepo ? 'yes' : 'no'}
- Key deps: ${f.keyDeps.join(', ')}
- Files: ${f.allFiles}

Code:
${trimFiles(repoData.fileContents)}

Write the developer doc. Bullets, tables, ASCII diagrams, code blocks only. Zero prose paragraphs.

---

## ⚡ TL;DR

- **Problem:** [one sentence — the exact pain point this solves]
- **Solution:** [one sentence — the mechanism, not "it's a tool that..."]
- **Not responsible for:** [one honest line about what it doesn't do]

---

## 🏗 Architecture

Draw the REAL architecture using actual file/module names from the code above. Use box-and-arrow ASCII. Not generic layers — actual files:

\`\`\`
          ┌──────────────────────────────────┐
          │  [entry point — actual filename] │
          └─────────────────┬────────────────┘
                            │
              ┌─────────────▼─────────────┐
              │  [core module — filename] │
              └──────┬────────────┬───────┘
                     │            │
         ┌───────────▼───┐  ┌─────▼──────────┐
         │ [module/file] │  │  [module/file]  │
         └───────┬───────┘  └────────┬────────┘
                 │                   │
         ┌───────▼───────┐  ┌────────▼────────┐
         │  [dep/service]│  │  [dep/service]  │
         └───────────────┘  └─────────────────┘
\`\`\`

---

## ↺ Request lifecycle

Trace the single most important user action through actual files. Name real functions:

\`\`\`
1. [User action]                ──────▶  [filename:functionName]
2. [Validation / middleware]    ──────▶  [filename:functionName]
3. [Core business logic]        ──────▶  [filename:functionName]
4. [DB / external call]         ──────▶  [service / dep]
5. [Response]                   ──────▶  { shape: of, the: data }
\`\`\`

- **State lives in:** [specific answer for this project]
- **Async:** [what's awaited and what isn't — and why]
- **Errors:** [where they're caught, what bubbles up, what fails silently]

---
${
  f.db
    ? `
## 🗃 Data model

Draw the schema / types visible in the code as an ER diagram:

\`\`\`
  ┌────────────────────┐          ┌────────────────────┐
  │   [Entity name]    │          │   [Entity name]    │
  ├────────────────────┤          ├────────────────────┤
  │ id        : type   │──1:n ───▶│ id        : type   │
  │ [field]   : type   │          │ [fk]      : type   │
  │ [field]   : type   │          │ [field]   : type   │
  └────────────────────┘          └────────────────────┘
\`\`\`

Key constraints and invariants: [what the data model enforces]

---
`
    : ''
}

## ⚙️ Stack decisions

Every row must say "why ${f.framework} over X" not just "what it does":

| Technology | What it does HERE | Why not the obvious alternative |
|------------|------------------|--------------------------------|
${f.framework !== 'unknown' ? `| ${f.framework} | [specific role in this repo] | [why not the obvious alternative, e.g. CRA / Rails / Flask] |` : ''}
${f.db ? `| ${f.db} | [specific role] | [why not ${f.db.includes('Postgres') ? 'MongoDB' : 'PostgreSQL'}] |` : ''}
${f.auth ? `| ${f.auth} | [specific role] | [why not ${f.auth === 'NextAuth.js' ? 'Clerk or custom JWT' : 'NextAuth'}] |` : ''}
${f.hasTRPC ? '| tRPC | [specific role] | [why not REST or GraphQL] |' : ''}
${f.hasZod ? '| Zod | [specific role] | [why not Yup or manual validation] |' : ''}
${f.fetching ? `| ${f.fetching} | [specific role] | [why not native fetch/useEffect] |` : ''}
[add rows for other key deps]

---

## 🔐 Security

| Surface | Implementation | Risk | Gap |
|---------|---------------|------|-----|
| Auth | ${f.auth || 'none'} | 🟢/🟡/🔴 | [specific gap] |
| Input | ${f.hasZod ? 'Zod validation' : 'manual/none'} | 🟢/🟡/🔴 | [specific gap] |
| Secrets | [env vars / vault / hardcoded?] | 🟢/🟡/🔴 | [specific gap] |
| Exposure | [what could leak from API] | 🟢/🟡/🔴 | [specific gap] |

Biggest unhandled risk: [one honest sentence about the real vulnerability]

---

## 📈 Performance

- **Hot path:** [most-called code path + its actual cost]
- **Breaks at 10x load because:** [specific — not "it will slow down"]
- **Current optimizations:** [what's actually in the code — caching, pagination, lazy loading, etc.]
- **Single biggest win:** [the one thing to add next, with filename]

---

## 🔀 Tradeoffs

3–4 real decisions visible in this code:

**[Name the actual decision, e.g. "Sequential LLM calls in route.js"]**
✅ Chose: [what] · ❌ Over: [alternative] · 💡 Because: [one line] · ⚠️ Costs: [one honest line]

---

## 🔧 What to fix

Ranked by impact. Each = a specific problem in THIS code + a concrete fix:

1. **[Actual problem in this file/pattern]** → [specific fix, not "refactor it"]
2. **[Actual problem]** → [specific fix]
3. **[Actual problem]** → [specific fix]

---

## 🚀 Local setup

\`\`\`bash
git clone https://github.com/${f.owner}/${f.repo}.git
cd ${f.repo}
${f.installCmd}
cp .env.example .env   # fill in values below
${f.devCmd}
\`\`\`

| Variable | Required | What it does |
|----------|----------|-------------|
[pull real env vars from code/imports]

---

RULES: Every claim grounded in actual files. Zero invented features. Be opinionated — "This is a security hole" not "could be improved". BANNED: robust, scalable, modern, seamlessly, best practices (without specifics), powerful, leverages.`
}

// ─── README ───────────────────────────────────────────────────────────────────

export function buildReadmePrompt(repoData) {
  const f = extractFacts(repoData)

  return `Write a GitHub README that makes someone stop scrolling. Think Bun, Excalidraw, shadcn/ui — not a corporate open-source doc. Developer reads it in 20 seconds and either stars it or forks it.

PROJECT:
- Repo: ${f.owner}/${f.repo}
- Stack: ${f.framework}${f.hasTS ? ' + TypeScript' : ''}${f.db ? ' + ' + f.db : ''}
- Key deps: ${f.keyDeps.slice(0, 7).join(', ')}
- Live: ${f.homepage || 'none'}
- Stars: ${f.stars}
- Description: ${f.desc}

Code:
${trimFiles(repoData.fileContents, 1200)}

Write the README. Fill every placeholder with real content from the code — no brackets left behind.

---

# [pick a fitting emoji] ${f.repo} — [tagline: what it does in under 10 words, specific enough that it couldn't describe another project]

![Stars](https://img.shields.io/github/stars/${f.owner}/${f.repo}?style=flat-square)&nbsp;![Last commit](https://img.shields.io/github/last-commit/${f.owner}/${f.repo}?style=flat-square)${f.homepage ? `&nbsp;[![Live](https://img.shields.io/badge/demo-live-4ade80?style=flat-square)](${f.homepage})` : ''}${f.hasTS ? '&nbsp;![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square)' : ''}

> **[The single most precise description possible. Reads like a pitch, not a definition. Makes someone immediately understand if they need this.]**

---

${
  f.homepage
    ? `## ↗ Demo\n\n**[Try it live → ${f.homepage}](${f.homepage})**\n\n> Drop a screenshot or GIF here — it's the first thing visitors look for.`
    : `## Preview\n\n> Add a screenshot to \`/screenshots/\` — it's the first thing visitors look for.`
}

---

## What it does

[2–3 sentences. Name the pain point. Name what's now possible. Be specific to THIS repo — not generic "it helps you with X".]

## How it works

\`\`\`
[Real input] ──▶ [Real core step using actual component/function names] ──▶ [Real output]
\`\`\`

## Features

[4–6 bullets. Each = a real feature visible in the code. Format: emoji **Bold feature name** — outcome for the user (not capability description)]

- 🔥 **[Feature from code]** — [outcome, not "supports X"]
- ⚡ **[Feature from code]** — [outcome]
- 🎯 **[Feature from code]** — [outcome]

## Stack

| Layer | Tech | Why |
|-------|------|-----|
${f.framework !== 'unknown' ? `| Framework | ${f.framework} | [one-line reason] |` : ''}
${f.db ? `| Database | ${f.db} | [one-line reason] |` : ''}
${f.auth ? `| Auth | ${f.auth} | [one-line reason] |` : ''}
${f.hasTailwind ? '| Styling | Tailwind CSS | [one-line reason] |' : ''}
[add real rows]

## Get started

\`\`\`bash
git clone https://github.com/${f.owner}/${f.repo}.git
cd ${f.repo}
${f.installCmd}
${f.devCmd}
\`\`\`

${f.homepage ? '' : `Then open **http://localhost:3000** (or the port shown in the terminal).`}

## License

MIT — [@${f.owner}](https://github.com/${f.owner})

---

RULES: Tagline must be specific enough it couldn't describe any other project. Features = outcomes ("generate docs in 10s") not capabilities ("supports doc generation"). > quote is the most important line — make it the sharpest sentence in the file. Fill EVERY placeholder with real content. BANNED: robust, powerful, seamlessly, modern, easy-to-use, cutting-edge, utilize.`
}

// ─── Interview Prep ───────────────────────────────────────────────────────────

export function buildInterviewPrepPrompt(repoData) {
  const f = extractFacts(repoData)

  // Build specific question angles from real detected facts
  // This is the key: angles are pre-computed from actual deps, not guessed
  const angles = [
    f.hasTRPC && {
      q: `Why tRPC over REST here?`,
      context: `tRPC is in the deps — probe why they chose type-safe RPC over a standard REST API`,
    },
    f.hasGraphQL && {
      q: `GraphQL vs REST — why GraphQL for this use case?`,
      context: `GraphQL is in the deps — ask about the schema design and resolver patterns`,
    },
    f.hasPrisma && {
      q: `How does the Prisma schema handle [detected relations]? Walk me through a migration.`,
      context: `Prisma is in deps — probe schema design, N+1 problem, migration strategy`,
    },
    f.db &&
      !f.hasPrisma && {
        q: `Why ${f.db} specifically? What would break if you swapped it?`,
        context: `DB is ${f.db} — probe the data model and why this DB fits the access patterns`,
      },
    f.auth && {
      q: `Walk me through the entire auth flow. What happens if the token expires mid-session?`,
      context: `Auth is ${f.auth} — probe session handling, refresh tokens, edge cases`,
    },
    f.hasSocket && {
      q: `How do you handle WebSocket disconnects and reconnection? What's the state on reconnect?`,
      context: `WebSockets detected — probe real-time state management and failure handling`,
    },
    f.hasStripe && {
      q: `How do you handle Stripe webhook failures and idempotency?`,
      context: `Stripe is in deps — probe payment reliability and webhook deduplication`,
    },
    f.hasRedis && {
      q: `What's your Redis eviction strategy? What happens when the cache is cold?`,
      context: `Redis detected — probe caching strategy, TTL, cold-start behavior`,
    },
    f.hasOpenAI && {
      q: `How do you handle AI response latency and rate limits? What's the fallback?`,
      context: `AI/LLM dep detected — probe streaming, error handling, cost control`,
    },
    f.hasTailwind && {
      q: `Tailwind in a large codebase — how do you avoid className spaghetti?`,
      context: `Tailwind detected — probe component abstraction and design system strategy`,
    },
    f.hasZod && {
      q: `Where exactly does Zod validation run? What's not validated?`,
      context: `Zod detected — probe validation coverage, server vs client, what slips through`,
    },
    f.state && {
      q: `Why ${f.state} over [obvious alternative]? Show me a complex state flow.`,
      context: `State management is ${f.state} — probe why it fits this project's complexity`,
    },
    f.fetching && {
      q: `How does ${f.fetching} cache invalidation work in this project? When does stale data bite you?`,
      context: `${f.fetching} detected — probe caching strategy, stale-while-revalidate, mutations`,
    },
    !f.testing && {
      q: `There are no tests. Where would a bug hide right now? What'd you test first?`,
      context: `No testing framework detected — probe awareness of risk and testing strategy`,
    },
    f.testing && {
      q: `What's NOT tested in this codebase? Where's the riskiest untested path?`,
      context: `${f.testLib} detected — probe what's missing, not just what's there`,
    },
    f.hasDocker && {
      q: `Walk me through the Dockerfile. What's the multi-stage strategy and why?`,
      context: `Docker detected — probe build optimization, security, layer caching`,
    },
    f.isMonorepo && {
      q: `How do you manage shared types across packages without circular deps?`,
      context: `Monorepo structure detected — probe dependency management and build order`,
    },
    !f.auth && {
      q: `There's no auth. How would you add it without rewriting the whole app?`,
      context: `No auth detected — probe where auth would hook in and what'd break`,
    },
    f.framework === 'Next.js' && {
      q: `Which pages are server components vs client components, and why?`,
      context: `Next.js detected — probe RSC vs client boundary decisions`,
    },
    f.framework === 'Next.js' && {
      q: `How do you handle data fetching at the component level vs route level?`,
      context: `Next.js detected — probe fetch strategy, caching, revalidation`,
    },
  ]
    .filter(Boolean)
    .slice(0, 10)

  // Pick 8 angles for the questions
  const selectedAngles = angles.slice(0, 8)

  return `You are a FAANG senior engineer giving a live mock interview about ${f.repo}. Your job: ask the sharpest possible questions about THIS project specifically, then give model answers that sound like a real senior — not a textbook.

CRITICAL RULE: Every question MUST reference something specific to this project:
- Framework: ${f.framework}${f.hasTS ? ' + TypeScript' : ''}
- DB: ${f.db || 'none'}
- Auth: ${f.auth || 'none'}
- Key packages: ${f.keyDeps.join(', ')}
- Interesting angles: ${selectedAngles.map((a) => a.q).join(' | ')}

Code to base questions on:
${trimFiles(repoData.fileContents)}

---

# 🎯 Interview Prep — ${f.repo}

---

## Your pitch (memorize this)

Fill it in for real. No brackets. Sound like a senior presenting at an eng all-hands:

> "[What ${f.repo} does + the most interesting technical decision you made + the outcome. 2 sentences. Lead with what makes this project technically interesting, not just functional.]"

---

## 🔥 The 10 questions they'll ask

Each question is about something REAL in this codebase. Each answer: max 3 sentences. Lead with the most interesting/surprising insight. No hedging. No "it depends" without finishing the sentence.

${selectedAngles
  .slice(0, 4)
  .map(
    (a, i) => `
**Q${i + 1}: ${a.q}**
*[Interviewer note: ${a.context}]*
**A:** [Answer for this specific project. Max 3 sentences. Name actual files or decisions visible in the code. Be direct.]
`,
  )
  .join('')}

**Q5: Walk me through what happens when a user does [the main action in ${f.repo}] — trace every layer.**
*[They want to see if you know your own code top to bottom]*
**A:** [Trace through actual files. Start from the trigger. End at the response. 3 sentences max.]

**Q6: What's the single biggest thing that breaks this architecture at 10x load?**
*[They want honesty and specificity — not "it might slow down"]*
**A:** [Name the specific bottleneck. Name the fix. One line each.]

**Q7: You have one week to make this production-ready. What do you do first?**
*[They want prioritization judgment, not a wish list]*
**A:** [3 concrete things. Ordered by risk. Each referenced to something real in this codebase.]

${selectedAngles
  .slice(4, 8)
  .map(
    (a, i) => `
**Q${i + 8}: ${a.q}**
*[Interviewer note: ${a.context}]*
**A:** [Answer for this specific project. Max 3 sentences. Direct. Technical. Honest.]
`,
  )
  .join('')}

**Q${selectedAngles.length + 2}: What would you do differently if you started ${f.repo} over today?**
*[They want self-awareness — not false modesty, not defensiveness]*
**A:** [Name the specific decision you'd undo. The file/pattern it's in. What you'd replace it with. 3 sentences.]

---

## 🃏 Rapid-fire cheat sheet

Practice these until they're instant:

| Question | Answer |
|----------|--------|
| What is ${f.repo}? | [one sentence, specific] |
| Why ${f.framework}? | [one line justification, not "it's popular"] |
| Biggest technical risk right now? | [specific, not "scaling"] |
| How does the core feature work? | [one sentence tracing the code] |
| What breaks first at scale? | [specific bottleneck] |
| What'd you change? | [specific file/decision] |
| Testing situation? | ${f.testLib ? `[honest answer about ${f.testLib} coverage]` : "[honest — no tests, here's what I'd add first]"} |
| What's next? | [one concrete feature, not "more features"] |

---

## ⚠️ Traps — questions where most candidates choke

These are gotchas specific to ${f.framework}${f.db ? ' + ' + f.db : ''} that interviewers use to separate people who used the tool from people who understand it:

**Trap 1: [A common misconception about ${f.framework} that trips up most devs — pick a real one based on how it's used here]**
→ [The answer that shows you understand WHY it works that way, not just WHAT it does]

**Trap 2: [An edge case or failure mode specific to ${f.db || f.auth || f.keyDeps[0] || 'the main dependency'} as used in this project]**
→ [The nuanced answer — not the Wikipedia definition]

**Trap 3: [A "zoom out" question: this architecture works well for X, but falls apart when...]**
→ [Honest, specific. Shows you know the limits of your own design choices]

---

FINAL CHECK BEFORE OUTPUTTING:
✓ Are all 10 questions about something specific in ${f.repo}'s actual code? (If any could be asked about any project unchanged — rewrite it)
✓ Are all answers ≤3 sentences?
✓ Does the cheat sheet have real values — no [brackets]?
✓ Does the pitch sound like a real engineer, not a product description?
✓ Are the traps genuinely tricky for THIS stack, not generic advice?`
}
