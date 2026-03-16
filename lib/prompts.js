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

  return `You write docs like a sharp product designer, not a tech writer. Warm, visual, scannable. Every sentence pulls its weight. Only include sections for things that actually exist in the project.

THIS PROJECT:
- Name: ${f.repo}
- What it is: ${f.desc}
- Built with: ${f.framework}${f.hasTS ? ' + TypeScript' : ''}${f.db ? ' + ' + f.db : ''}
${f.homepage ? `- Live at: ${f.homepage}` : ''}
- Files: ${f.allFiles}

Code:
${trimFiles(repoData.fileContents)}

Write the user doc. Sections in this exact order. Only include a section if there is real content for it from the code. Do NOT write placeholder text about missing features in the body.

---
${f.homepage ? `\n> 🚀 **[Open ${f.repo} — nothing to install](${f.homepage})**\n` : ''}
${repoData.screenshotUrl ? `\n![${f.repo} preview](${repoData.screenshotUrl})\n` : ''}

# ${f.repo}

One punchy sentence. What problem does it kill? Who is it for? No fluff.

---

## 📌 About this project

> **[One sentence: what ${f.repo} is + what specific problem it solves.]**

- **What it is:** [plain-English description — no jargon]
- **Who it's for:** [specific user type — not "anyone who needs X"]
- **Built with:** ${f.framework}${f.hasTS ? ' + TypeScript' : ''}${f.db ? ' + ' + f.db : ''}
${f.homepage ? `- **Try it:** [${f.homepage}](${f.homepage})` : ''}

---

## What it does

2 sentences max. Start with the frustration it solves. End with what is now possible. If a 15-year-old would not understand a word, swap it.

---

## What you can do with it

| Do this | And you get |
|---------|------------|
| [specific action from the actual UI/CLI] | [specific outcome] |
| [specific action] | [specific outcome] |
[4–6 rows — only real features visible in the code]

---

## How it works

\`\`\`
  You                 ${f.repo}              ${f.db ? f.db : 'Output'}
   │                      │                      │
   │── [specific action] ▶│                      │
   │                      │── [what happens] ───▶│
   │                      │◀── [what comes back]─│
   │◀── [what you see] ───│                      │
\`\`\`

One sentence explaining it like texting a friend.

---

## Get started

${
  f.homepage
    ? `1. Open **[${f.homepage}](${f.homepage})**
2. [First thing the user sees — be specific]
3. [Next action]
4. [What you get at the end]`
    : `\`\`\`bash
git clone https://github.com/${f.owner}/${f.repo}.git
cd ${f.repo}
${f.installCmd}
${f.devCmd}
\`\`\`

- **Step 1:** [what the clone does]
- **Step 2:** [what install does]
- **Step 3:** [what the dev command starts and where to open it]`
}

---

## Real example

> Imagine you want to [specific use case for THIS tool]...

Walk from start to result in 3–4 sentences. Make the reader think "I need that."

---

## Common questions

**[Most obvious question about ${f.repo}]**
→ [Direct answer, 1–2 sentences]

**[Question about a real feature or behavior unique to this tool]**
→ [Direct answer]

**[Something that surprises new users]**
→ [Direct answer]

---

## 💡 How to improve this project

*Things not yet built that would make ${f.repo} better:*

${!f.auth ? `- **User accounts & login** — anyone can currently use the tool without authentication; adding login would unlock [saved history / personalization / private data]` : ''}
${!f.db ? `- **Persistent storage** — results are not saved between sessions; a lightweight database would let users revisit past outputs` : ''}
- **[One specific missing feature visible from the code that real users would want]** — [one sentence on how to add it]
- **[One UX improvement based on the current flow]** — [one sentence on the impact]

---

RULES: No section about a feature that does not exist in the code body — only in "How to improve". No sentence over 25 words. No jargon without instant plain-English explanation. Always "you/your". BANNED: straightforward, simple, easy, just, seamlessly, leverage, robust, powerful, enables, allows you to, in order to, utilize.`
}

// ─── Dev Doc ──────────────────────────────────────────────────────────────────

export function buildDevDocPrompt(repoData) {
  const f = extractFacts(repoData)

  return `You are a staff engineer writing a visually compelling, technically precise internal dev doc for ${f.repo}. Target audience: developers joining the project or reviewing it. Make it scannable and attractive — use emojis for section headers, ASCII diagrams for architecture, tables for comparisons, and bullet points throughout. Zero prose paragraphs. Every bullet must name a specific file, function, or decision — never generic statements.

HARD FACTS:
- Stack: ${f.framework}${f.hasTS ? ' + TypeScript' : ''}
- DB: ${f.db || 'none'} | Auth: ${f.auth || 'none'} | State: ${f.state || 'none'}
- Fetching: ${f.fetching || 'native fetch'} | tRPC: ${f.hasTRPC} | GraphQL: ${f.hasGraphQL}
- Zod: ${f.hasZod} | Tailwind: ${f.hasTailwind} | Redis: ${f.hasRedis} | Sockets: ${f.hasSocket}
- Testing: ${f.testLib || 'none'} | Docker: ${f.hasDocker} | CI: ${f.hasCI} | Monorepo: ${f.isMonorepo}
- Key deps: ${f.keyDeps.join(', ')}
- Files: ${f.allFiles}

Code:
${trimFiles(repoData.fileContents)}

Write EXACTLY the sections below. Fill every placeholder with real project content — no brackets in output.

---

# 🛠 ${f.repo} — Developer Documentation

---

## 📌 Project Overview

> **[One precise sentence: what ${f.repo} is and the core technical problem it solves.]**

| Field | Detail |
|-------|--------|
| **Stack** | ${f.framework}${f.hasTS ? ' + TypeScript' : ''}${f.db ? ' + ' + f.db : ''} |
${f.auth ? `| **Auth** | ${f.auth} |` : ''}
${f.db ? `| **Database** | ${f.db} |` : ''}
${f.testLib ? `| **Testing** | ${f.testLib} |` : ''}
${f.hasDocker ? '| **Docker** | Yes |' : ''}
${f.hasCI ? '| **CI/CD** | Configured |' : ''}
| **Repo** | [github.com/${f.owner}/${f.repo}](https://github.com/${f.owner}/${f.repo}) |
${f.homepage ? `| **Live** | [${f.homepage}](${f.homepage}) |` : ''}

---

## ⚡ TL;DR

- **What it is:** [one precise sentence — mechanism, not marketing]
- **Core problem solved:** [the exact technical/user pain this eliminates]
- **Out of scope:** [one honest line — what it intentionally does not handle]
- **Critical constraint:** [the one assumption that breaks everything if violated]

---

## 🏗️ System Architecture

High-level view using actual filenames from the code:

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

${
  f.hasDocker || f.hasCI
    ? `**Infrastructure in use:**
| Layer | Tool | Notes |
|-------|------|-------|
${f.hasDocker ? '| Containerization | Docker | [specific usage — build, dev, prod] |' : ''}
${f.hasCI ? '| CI/CD | [GitHub Actions / detected CI] | [pipeline file location] |' : ''}
[add cloud/hosting row if inferable from config files]
`
    : ''
}
**Key structural decisions:**
- **[Decision #1 from actual code]:** [why this pattern, what it buys]
- **[Decision #2 from actual code]:** [trade-off + cost]

---

## ↺ Request Lifecycle

Trace the most critical user action through actual files:

\`\`\`
1. [User action]               ──▶  [filename:function()]
2. [Validation/middleware]     ──▶  [filename:function()]
3. [Core business logic]       ──▶  [filename:function()]
4. [DB / external call]        ──▶  [service or query shape]
5. [Response]                  ──▶  { shape: of, the: response }
\`\`\`

- **State lives in:** [specific location — component, store, server]
- **Async strategy:** [what is awaited vs fire-and-forget and why]
- **Error propagation:** [what is caught, what bubbles, what fails silently — with filename]
${f.hasRedis || f.fetching ? `- **Cache layer:** [what is cached, TTL, invalidation trigger]` : ''}

---
${
  f.db
    ? `
## 🗃️ Data Model

\`\`\`
  ┌────────────────────┐          ┌────────────────────┐
  │   [Entity name]    │          │   [Entity name]    │
  ├────────────────────┤          ├────────────────────┤
  │ id        : type   │──1:n ───▶│ id        : type   │
  │ [field]   : type   │          │ [fk]      : type   │
  │ [field]   : type   │          │ [field]   : type   │
  └────────────────────┘          └────────────────────┘
\`\`\`

- **DB-level constraints:** [indexes, unique rules, foreign keys visible in schema]
- **App-level invariants:** [what the ORM or code layer enforces]
- **Migration strategy:** [how schema changes are applied — tool + process]
- **N+1 risk:** [specific query path that causes it, if any]

---
`
    : ''
}

## ⚙️ Stack Decisions

*Why each choice — not just what it is:*

| Technology | Role in this repo | Why not the alternative |
|------------|------------------|------------------------|
${f.framework !== 'unknown' ? `| ${f.framework} | [specific architectural role] | [why not ${f.framework.includes('Next') ? 'Vite+React or Remix' : f.framework.includes('Express') ? 'Fastify or Hono' : 'simpler alternative'}] |` : ''}
${f.db ? `| ${f.db} | [specific data access pattern] | [why not ${f.db.includes('Postgres') ? 'MongoDB or SQLite' : 'PostgreSQL'}] |` : ''}
${f.auth ? `| ${f.auth} | [specific auth flow] | [why not ${f.auth === 'NextAuth.js' ? 'Clerk or custom JWT' : 'NextAuth.js'}] |` : ''}
${f.hasTRPC ? '| tRPC | [type-safety boundary it enforces] | [why not REST + Zod or GraphQL] |' : ''}
${f.hasZod ? '| Zod | [exact validation boundary — client/server/both] | [why not Yup or manual] |' : ''}
${f.fetching ? `| ${f.fetching} | [caching/mutation pattern used] | [why not raw fetch + useEffect] |` : ''}
[add real rows for remaining key deps only]

---

## 🔐 Security

Only include rows for surfaces that actually exist in this codebase:

| Surface | Implementation | Threat Level | Gap |
|---------|---------------|-------------|-----|
${f.auth ? `| Auth | ${f.auth} | 🟢/🟡/🔴 | [specific unhandled case] |` : ''}
${f.hasZod ? '| Input Validation | Zod schemas | 🟢/🟡/🔴 | [what is not validated] |' : '| Input Validation | Manual | 🟡 | [what is not validated] |'}
| Secret Management | [env vars / hardcoded — from code] | 🟢/🟡/🔴 | [exposure risk] |
| API Surface | [public endpoints from code] | 🟢/🟡/🔴 | [what leaks / is not rate-limited] |

- **🚨 Most critical risk:** [exact vulnerability + attack vector — name the file]
- **🏆 Quickest win:** [specific file + specific change to fix it]

---

## 📈 Performance

- **Hot path:** [most-executed code path and its cost]
- **Bottleneck at 10x load:** [exact resource that saturates first]
- **Current optimizations:** [list only what is actually implemented — caching, pagination, memoization, etc.]
- **Highest-ROI fix:** [specific change + expected impact + filename]

---

## 🔀 Architectural Trade-offs

**Decision: [Actual pattern from codebase, e.g. "Monolithic handler in api/generate/route.ts"]**
- ✅ **Chose:** [what + why it fits current scale]
- ❌ **Over:** [the alternative not picked]
- 💡 **Rationale:** [the specific constraint that drove it]
- ⚠️ **Cost:** [concrete failure mode or limitation accepted]

**Decision: [Second real decision from codebase]**
- ✅ **Chose:** [what] · ❌ **Over:** [alternative] · 💡 **Because:** [one line] · ⚠️ **Costs:** [one line]

**Decision: [Third real decision]**
- ✅ **Chose:** [what] · ❌ **Over:** [alternative] · 💡 **Because:** [one line] · ⚠️ **Costs:** [one line]

---
${
  f.testLib
    ? `
## 🧪 Testing Strategy

| Test Type | Framework | Coverage | Location |
|-----------|-----------|----------|----------|
| Unit | ${f.testLib} | [X% or estimated] | [folder path] |
${f.testLib === 'Cypress' || f.testLib === 'Playwright' ? `| E2E | ${f.testLib} | [critical paths covered] | [folder path] |` : ''}
[add integration row only if integration tests exist]

**Run tests:**
\`\`\`bash
${f.testLib === 'Vitest' ? 'npx vitest\nnpx vitest --watch' : f.testLib === 'Jest' ? 'npx jest\nnpx jest --watch' : `npx ${f.testLib.toLowerCase()}`}
\`\`\`

**Highest-risk untested paths:**
- **[Specific untested path #1]** — risk: [what breaks silently]
- **[Specific untested path #2]** — risk: [what breaks silently]

**Test data:** [fixtures / factories / seeded DB — where it comes from]

**Bug report template:**
\`\`\`
Title: [short description]
Steps to reproduce: [numbered]
Expected: [what should happen]
Actual: [what happens]
Environment: [OS / browser / node version]
Logs: [paste here]
Severity: Critical / High / Medium / Low
\`\`\`

---
`
    : ''
}
${
  f.hasCI || f.hasDocker
    ? `
## 🚀 Deployment

**Environments:**
| Environment | URL | How to deploy |
|-------------|-----|--------------|
| Development | localhost:[port] | \`${f.devCmd}\` |
${f.homepage ? `| Production | [${f.homepage}](${f.homepage}) | [deploy method from config] |` : ''}

${
  f.hasCI
    ? `**CI/CD Pipeline:**
- **Stages:** Build → Test → Package → Deploy
- **Pipeline file:** [.github/workflows/*.yml — actual filename]
- **Artifact storage:** [Docker registry / npm — from config]
`
    : ''
}
${
  f.hasPrisma || f.db
    ? `**Database Migrations:**
- **Tool:** [${f.hasPrisma ? 'Prisma Migrate' : 'detected migration tool'}]
- **Apply in prod:** [automated on deploy / manual]
- **Rollback:** [how to revert a bad migration]
`
    : ''
}
---
`
    : ''
}

## 💻 Local Setup

\`\`\`bash
git clone https://github.com/${f.owner}/${f.repo}.git
cd ${f.repo}
${f.installCmd}
cp .env.example .env
${f.devCmd}
\`\`\`

**Environment variables:**
| Variable | Required | What it controls |
|----------|----------|-----------------|
[list only real env vars found in code — name each var and what breaks without it]

**IDE:** VS Code with [ESLint / Prettier / relevant extensions from actual deps]

---

## 💡 Recommendations

*These are improvements the project would benefit from — not currently implemented:*

${!f.auth ? `- **Add authentication** — no auth exists; recommend [NextAuth.js / Clerk / Supabase Auth] for [the specific API surface that needs protection]` : ''}
${!f.testLib ? `- **Add a test suite** — no tests detected; start with [Vitest / Jest] for unit tests on [the highest-risk functions], then [Playwright / Cypress] for E2E on [the core user flow]` : ''}
${!f.hasCI ? `- **Set up CI/CD** — no pipeline detected; a GitHub Actions workflow running tests on every PR would catch regressions before merge` : ''}
${!f.hasDocker ? `- **Containerize with Docker** — no Dockerfile detected; a multi-stage Docker build would make deployments reproducible and remove "works on my machine" issues` : ''}
${!f.hasRedis && !f.fetching ? `- **Add a caching layer** — no caching detected; [Redis via Upstash / TanStack Query] on [the most-called endpoint] would reduce load and improve response time` : ''}
${!f.db ? `- **Add persistent storage** — data appears to be in-memory or stateless; consider [Supabase / PlanetScale / SQLite] depending on scale requirements` : ''}
- **Add monitoring** — no observability detected; [Sentry for errors + Vercel Analytics / Posthog] would make production issues visible instead of silent
- **[One more specific recommendation based on what is in the code — a gap, a missing abstraction, or a tech upgrade that would genuinely help this project]**

RULES: Only include sections for things that actually exist in the code. Do not write "not detected", "none", or "not configured" anywhere in the doc body — those gaps go in Recommendations only. Every bullet names a specific file, function, or dep. Be opinionated. No bullet under 8 words. BANNED: robust, scalable, modern, seamlessly, leverages, best practices (without specifics).`
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

  // Domain detection for question pool selection
  const isFrontend =
    f.hasTailwind ||
    f.framework === 'React' ||
    f.framework === 'Next.js' ||
    f.framework === 'Vue.js' ||
    f.framework === 'Svelte'
  const isBackend =
    f.db ||
    f.auth ||
    f.hasTRPC ||
    f.hasGraphQL ||
    f.framework === 'Express.js' ||
    f.framework === 'Fastify'
  const isFullStack = isFrontend && isBackend
  const isML = f.hasOpenAI
  const isDevOps = f.hasDocker || f.hasCI

  // Pre-compute specific tech-based angles
  const techAngles = [
    f.hasTRPC && {
      q: `Why tRPC over REST? Where does the type contract actually get enforced?`,
      domain: 'fullstack',
    },
    f.hasGraphQL && {
      q: `Walk through your GraphQL schema design. How do you prevent over-fetching?`,
      domain: 'fullstack',
    },
    f.hasPrisma && {
      q: `Show me a Prisma migration. How do you handle a breaking schema change in prod?`,
      domain: 'backend',
    },
    f.db &&
      !f.hasPrisma && {
        q: `Why ${f.db}? What query would fall apart at 100k rows?`,
        domain: 'backend',
      },
    f.auth && {
      q: `Trace the full auth flow. What happens when the token expires mid-request?`,
      domain: 'security',
    },
    f.hasSocket && {
      q: `How do you handle a WebSocket disconnect during an active session? What's the client state?`,
      domain: 'backend',
    },
    f.hasStripe && {
      q: `Walk me through Stripe webhook handling. How do you guarantee idempotency?`,
      domain: 'backend',
    },
    f.hasRedis && {
      q: `What's your Redis eviction strategy? What degrades when the cache is cold?`,
      domain: 'backend',
    },
    f.hasOpenAI && {
      q: `How do you handle LLM latency and rate limits? What's the fallback path?`,
      domain: 'ml',
    },
    f.hasTailwind && {
      q: `How do you prevent Tailwind class sprawl across components? Where does your design system live?`,
      domain: 'frontend',
    },
    f.hasZod && {
      q: `Exactly where does Zod run — client, server, or both? What input is NOT validated?`,
      domain: 'fullstack',
    },
    f.state && {
      q: `Why ${f.state} over alternatives? Show me a non-trivial state flow.`,
      domain: 'frontend',
    },
    f.fetching && {
      q: `How does ${f.fetching} cache invalidation work after a mutation? When does stale data bite you?`,
      domain: 'frontend',
    },
    !f.testing && {
      q: `There are zero tests. Where would a bug hide right now undetected? What'd you test first?`,
      domain: 'general',
    },
    f.testing && {
      q: `What's the highest-risk path NOT covered by ${f.testLib} tests? Why hasn't it been tested?`,
      domain: 'general',
    },
    f.hasDocker && {
      q: `Walk me through the Dockerfile. What's in each layer and why?`,
      domain: 'devops',
    },
    f.isMonorepo && {
      q: `How do you manage shared types across packages without circular dependencies?`,
      domain: 'fullstack',
    },
    !f.auth && {
      q: `There's no auth. If you added it tomorrow, where would it hook in and what would break?`,
      domain: 'security',
    },
    f.framework === 'Next.js' && {
      q: `Which pages are Server Components vs Client Components, and what was the deciding factor?`,
      domain: 'frontend',
    },
    f.framework === 'Next.js' && {
      q: `How do you handle data fetching — at route level or component level? When do you revalidate?`,
      domain: 'frontend',
    },
  ].filter(Boolean)

  // General domain question pools
  const generalPool = [
    {
      q: `Give a 60-second overview of ${f.repo} — problem, solution, stack, and what you'd change.`,
      domain: 'general',
    },
    {
      q: `What was the hardest bug you hit in ${f.repo}? How did you find it?`,
      domain: 'general',
    },
    {
      q: `If ${f.repo} got 10x traffic tomorrow, what breaks first?`,
      domain: 'general',
    },
    {
      q: `What would you do differently if you started ${f.repo} over with the same requirements?`,
      domain: 'general',
    },
    {
      q: `Walk me through the most important user flow — from click to response, naming actual files.`,
      domain: 'general',
    },
    {
      q: `What's the one thing in this codebase you're least proud of? Why hasn't it been fixed?`,
      domain: 'general',
    },
    {
      q: `How did you decide what logic belongs on the frontend vs backend?`,
      domain: 'fullstack',
    },
    {
      q: `How do you handle errors — what surfaces to the user vs what gets swallowed?`,
      domain: 'general',
    },
    {
      q: `What does "done" mean in this project? What's your definition of production-ready?`,
      domain: 'general',
    },
    {
      q: `How would you onboard a new developer to this codebase in 30 minutes?`,
      domain: 'general',
    },
    {
      q: `What security assumptions does ${f.repo} make that could be wrong?`,
      domain: 'security',
    },
    {
      q: `How do you measure if ${f.repo} is working correctly in production?`,
      domain: 'devops',
    },
  ]

  // Merge tech-specific + general, shuffle deterministically, pick 10
  const allAngles = [...techAngles, ...generalPool]
  const seed = f.repo.length + f.keyDeps.length // deterministic "random" based on repo
  const shuffled = allAngles
    .map((item, i) => ({ item, sort: (i * 1664525 + seed) % allAngles.length }))
    .sort((a, b) => a.sort - b.sort)
    .map((x) => x.item)
  const selected = shuffled.slice(0, 10)

  return `You are a FAANG senior engineer running a live technical interview about ${f.repo}. Your job: ask laser-sharp questions about THIS project specifically, then provide model answers that sound like a real senior engineer — concrete, direct, occasionally self-critical.

CRITICAL: Every question must reference something verifiably true in this codebase. Generic questions are forbidden.

Stack: ${f.framework}${f.hasTS ? ' + TypeScript' : ''} | DB: ${f.db || 'none'} | Auth: ${f.auth || 'none'} | Key packages: ${f.keyDeps.join(', ')}
Domains: ${[isFrontend && 'Frontend', isBackend && 'Backend', isML && 'ML/AI', isDevOps && 'DevOps'].filter(Boolean).join(', ') || 'General'}

Code:
${trimFiles(repoData.fileContents)}

---

# 🎯 Interview Prep — ${f.repo}

---

## 📌 Project Snapshot

> **[One sentence: what ${f.repo} is and why it is technically interesting.]**

| | |
|---|---|
| **Stack** | ${f.framework}${f.hasTS ? ' + TypeScript' : ''}${f.db ? ' · ' + f.db : ''} |
${f.auth ? `| **Auth** | ${f.auth} |` : ''}
| **Key packages** | ${f.keyDeps.slice(0, 5).join(', ')} |
${f.testLib ? `| **Testing** | ${f.testLib} |` : ''}
| **Domains** | ${[isFrontend && 'Frontend', isBackend && 'Backend', isML && 'AI/ML', isDevOps && 'DevOps'].filter(Boolean).join(', ') || 'General'} |

---

## 🎤 Your 60-Second Pitch

*Memorize this. Deliver it without filler words:*

> "[What ${f.repo} does + the most interesting technical decision + the measurable outcome. Lead with what makes this technically interesting, not just that it works. Sound like an engineer at an all-hands, not a product page.]"

---

## 💬 The 10 Questions They'll Ask

*Each answer: 2–3 sentences max. Lead with the sharpest insight. No hedging.*

${selected
  .slice(0, 5)
  .map(
    (a, i) => `
**Q${i + 1}: ${a.q}**
**A:** [Answer grounded in actual ${f.repo} code. Name real files or decisions. Direct and specific — no "it depends" without finishing the sentence. Max 3 sentences.]
`,
  )
  .join('')}

**Q6: Trace what happens when a user does [the main action in ${f.repo}] — name every layer.**
*[They want proof you know your own code top-to-bottom, not just the happy path]*
**A:** [Start from the trigger. Name actual files. End at the response. 3 sentences max.]

**Q7: What's the single architectural decision you'd undo if you started over?**
*[They want self-awareness — not false modesty, not defensiveness]*
**A:** [Name the specific file or pattern. What you'd replace it with. Why you didn't do it right the first time.]

${selected
  .slice(5, 10)
  .map(
    (a, i) => `
**Q${i + 8}: ${a.q}**
**A:** [Answer grounded in ${f.repo}'s actual code. Technical, honest, specific. Max 3 sentences.]
`,
  )
  .join('')}

---

## 🃏 Rapid-Fire Cheat Sheet

*Practice until these are instant — no "um, well..." allowed:*

| Question | Your Answer |
|----------|------------|
| What is ${f.repo} in one sentence? | [specific — not "a tool that helps with X"] |
| Why ${f.framework}? | [one technical reason, not "it's popular"] |
| Biggest technical risk right now? | [specific, not "scaling" or "security"] |
| How does the core feature work? | [one sentence tracing real code] |
| What breaks first at scale? | [specific bottleneck — file/query/service] |
| Testing situation? | ${f.testLib ? `[honest coverage summary for ${f.testLib}]` : '[no tests \u2014 what you would add first]'} |
| Hardest thing you built here? | [specific component or decision] |
| What's next on the roadmap? | [one concrete feature, not "more features"] |

---

## 🧩 Domain-Specific Deep Dives

${
  isFrontend
    ? `
**Frontend:**
- How do you manage component state vs global state in this project? Where's the line?
- What's the render performance story — any unnecessary re-renders? How would you find them?
- How do you handle loading, error, and empty states consistently across the UI?
`
    : ''
}
${
  isBackend
    ? `
**Backend:**
- What does your API error response shape look like? Is it consistent?
- How do you prevent duplicate requests from causing data corruption?
- What happens to in-flight requests during a deployment/restart?
`
    : ''
}
${
  isML
    ? `
**AI/ML:**
- How do you control LLM output format reliability? What happens when the model ignores your prompt?
- How do you measure if AI responses are getting better or worse over time?
- What's your cost per request? At what scale does it become a problem?
`
    : ''
}
${
  isDevOps
    ? `
**DevOps:**
- How do you roll back a bad deploy? What's the recovery time?
- What's the health check strategy — how do you know the app is actually healthy, not just up?
- How do secrets get into the running container without appearing in logs?
`
    : ''
}

---

## ⚠️ Interviewer Traps

*Questions where most candidates give the wrong answer. Know the nuance:*

**Trap 1: [A common misconception about ${f.framework} that trips up devs who only used it, not understood it — pick the one most relevant to how ${f.repo} uses it]**
→ [The answer that shows you understand the WHY, not just the WHAT]

**Trap 2: [An edge case or failure mode specific to ${f.db || f.auth || f.keyDeps[0] || 'the core dependency'} as used in ${f.repo}]**
→ [The nuanced, experienced answer — not the documentation definition]

**Trap 3: "This seems like a good project, but how would you make it enterprise-ready?"**
→ [Don't get defensive. Name 3 specific things: auth/authz hardening, observability, and [one project-specific gap]. Show you already know the gaps.]

---

## 📋 Pre-Interview Checklist

- [ ] Can you demo ${f.repo} live without it breaking?
- [ ] Do you know every file in the root directory and what it does?
- [ ] Can you explain the main feature flow without looking at the code?
- [ ] Have you prepared answers for: "why ${f.framework}?", "biggest challenge?", "what broke in prod?"
- [ ] Do you know the exact line count / component count / endpoint count?
- [ ] Can you draw the architecture on a whiteboard from memory?
- [ ] Do you have metrics? (load time, response time, lines of code, users)

---

## 💡 How You Would Improve This Project

*Be ready to answer "what would you add next?" — interviewers love this question. Have concrete answers:*

${!f.auth ? `- **Authentication** — no auth exists; you would add [NextAuth.js / Clerk] to protect [specific routes/API endpoints] and enable per-user data` : ''}
${!f.testLib ? `- **Test coverage** — no tests exist; you would start with unit tests on [the core business logic function] using [Vitest / Jest], then E2E tests for [the main user flow]` : ''}
${!f.hasCI ? `- **CI/CD pipeline** — no automation exists; a GitHub Actions workflow running tests + lint on PRs would catch regressions before they merge` : ''}
${!f.hasRedis && !f.fetching ? `- **Caching layer** — [the most-called API endpoint] makes a fresh request every time; adding [Redis via Upstash / TanStack Query] would cut response time significantly` : ''}
${!f.db ? `- **Persistent storage** — data is currently stateless; adding [Supabase / PlanetScale] would allow users to save and revisit their work` : ''}
- **[One specific feature gap visible in the code]** — [one sentence on what it would unlock for users]
- **[One architectural improvement]** — [one sentence on the technical benefit and how you would implement it]

---

FINAL CHECK:
✓ All 10 questions reference something specific to ${f.repo}'s actual code
✓ All answers are ≤3 sentences, direct, and technically precise
✓ Cheat sheet has zero [brackets] — real values only
✓ Pitch sounds like an engineer, not a product description
✓ Traps are genuinely tricky for THIS stack, not generic interview advice
✓ Improvements section has specific, realistic suggestions — not generic wishlist items`
}
