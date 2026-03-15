export function buildUserDocPrompt(repoData) {
  const hasUI = repoData.isFrontend && repoData.homepage
  return `You write product docs that feel like a friendly product designer wrote them — not a corporate manual. Short, visual, scannable. Think Notion meets Linear meets a good Twitter thread.

Project: ${repoData.owner}/${repoData.repo}
Description: ${repoData.description || 'No description'}
Language: ${repoData.language}
Live URL: ${repoData.homepage || 'None'}
Is Frontend App: ${repoData.isFrontend ? 'Yes' : 'No'}
Files: ${repoData.allFiles.join(', ')}
${repoData.screenshotUrl ? `App Screenshot URL: ${repoData.screenshotUrl}` : ''}

File contents:
${Object.entries(repoData.fileContents)
  .map(
    ([name, content]) =>
      `### ${name}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``,
  )
  .join('\n\n')}

Write a USER DOC in markdown. Follow this EXACT structure:

---
${repoData.homepage ? `> 🚀 **[Open the app — nothing to install](${repoData.homepage})**\n` : ''}

# 👋 What is ${repoData.repo}?

2 sentences. First: the problem. Second: what this solves.
Zero jargon. If a curious 14-year-old wouldn't get it, rewrite it.

---

## ✨ What you can do with it

| What | Why it's useful |
|------|----------------|
| [action] | [benefit in plain English] |
(4–6 rows max)

---

## 🗺️ How it works — the big picture

\`\`\`
You → [Step 1] → [Step 2] → [Step 3] → ✅ Result
\`\`\`

1–2 sentences in plain English.

---
${
  hasUI
    ? `
## 🖼️ What it looks like

> The app is live at [${repoData.homepage}](${repoData.homepage})
${repoData.screenshotUrl ? `\n![${repoData.repo} screenshot](${repoData.screenshotUrl})\n` : ''}
Describe the main screen in 2 sentences — what the user sees first, and what they interact with first.

---
`
    : ''
}

## 🚀 Getting started

${
  repoData.homepage
    ? `The app is online — no setup needed.\n\n**Step 1:** Go to [${repoData.homepage}](${repoData.homepage})\n\nThen numbered steps. One sentence each. Max 5 steps.`
    : `Numbered steps. Max 5. One action per step, one sentence each.\nFor terminal commands, show in a code block then explain in plain English below.`
}

---

## 💡 Real example

> "Imagine you want to [realistic scenario]. Here's exactly what happens..."

3–4 sentences. Concrete. Specific.

---

## ❓ Quick answers

**[Most obvious question a new user would ask]**
→ [Direct 1–2 sentence answer]

**[Second most common confusion]**
→ [Direct answer]

**[One more real question]**
→ [Direct answer]

---

## 🆘 Something not working?

One sentence. Where to go.

---

STRICT RULES:
- ZERO jargon. Ban: API, backend, frontend, deploy, repository, runtime, framework — unless explained immediately in parentheses.
- Always "you" and "your". Never "the user".
- No paragraph longer than 2 sentences.
- BANNED: straightforward, simple, easy, just, seamlessly, utilize, leverage, robust, powerful, functionality, enables, allows you to, in order to.
- ASCII flow diagram is REQUIRED.
- Write like a human, not a chatbot.`
}

export function buildDevDocPrompt(repoData) {
  const hasUI = repoData.isFrontend
  return `You are a principal engineer writing internal technical documentation. Style: concise, opinionated, scannable. Like a great ADR mixed with a staff engineer's code review. Senior devs should get the full picture in 3 minutes.

Project: ${repoData.owner}/${repoData.repo}
Description: ${repoData.description || 'No description'}
Languages: ${JSON.stringify(repoData.languages)}
Topics: ${repoData.topics.join(', ')}
Live URL: ${repoData.homepage || 'None'}
Is Frontend: ${hasUI ? 'Yes' : 'No'}
Files: ${repoData.allFiles.join(', ')}
${repoData.screenshotUrl ? `App Screenshot URL: ${repoData.screenshotUrl}` : ''}

File contents:
${Object.entries(repoData.fileContents)
  .map(
    ([name, content]) =>
      `### ${name}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``,
  )
  .join('\n\n')}

Write a DEVELOPER DOC. Follow this EXACT structure:

---

## 🧠 TL;DR

- **Problem:** [one line]
- **Solution:** [one line — what the system does, technically]
- **Scale target:** [what it's built for]

---

## 🗺️ System architecture

\`\`\`
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   [Layer 1] │────▶│   [Layer 2]  │────▶│  [Layer 3]  │
│  [file/mod] │     │  [file/mod]  │     │  [file/mod] │
└─────────────┘     └──────────────┘     └─────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │  [External]  │
                   └──────────────┘
\`\`\`

Use actual file names and service names from the code.

---

## 🔄 Data flow — request lifecycle

\`\`\`
1. [User action] → [file:function]
2. [What happens] → [file:function]
3. [What happens] → [file:function]
4. [Response shape returned]
\`\`\`

- **State lives in:** [where and why]
- **Async boundaries:** [what's async, what's sync]
- **Error propagation:** [how errors surface]

---

## 🗄️ Data models & schema

If any models/schemas/types detected, render as ER diagram:

\`\`\`
┌──────────────────┐         ┌──────────────────┐
│   [ModelName]    │         │   [ModelName2]    │
├──────────────────┤         ├──────────────────┤
│ id: type         │────────▶│ id: type         │
│ field: type      │  1..n   │ foreignKey: type │
└──────────────────┘         └──────────────────┘
\`\`\`

If no models: "No persistent data models detected — stateless system."

---
${
  hasUI
    ? `
## 🖼️ UI component map
${repoData.screenshotUrl ? `\n> **Live screenshot:** ![${repoData.repo}](${repoData.screenshotUrl})\n` : ''}
Main UI components detected in the code:

| Component | File | What it renders | Key state |
|-----------|------|-----------------|-----------|

Component hierarchy:

\`\`\`
App
└── [Layout/Shell]
    ├── [Component A]
    │   └── [Sub-component]
    └── [Component B]
\`\`\`

---
`
    : ''
}

## ⚙️ Tech stack decisions

| Technology | Role | Why this, not [alternative] |
|------------|------|-------------------------------|
(Each row must justify the choice.)

---

## 🔐 Security model

| Area | Implementation | Risk |
|------|---------------|------|
| Auth | [how auth works] | 🟢/🟡/🔴 |
| Input validation | [where/how] | 🟢/🟡/🔴 |
| Data exposure | [what could leak] | 🟢/🟡/🔴 |
| Trust boundaries | [what's trusted] | 🟢/🟡/🔴 |
| Known gaps | [honest answer] | 🔴 |

---

## 📈 Performance & scaling

- **Bottleneck #1:** [what — at what scale it breaks]
- **Bottleneck #2:** [if applicable]
- **Current optimizations:** [what's done]
- **What breaks first at 10x load:** [specific, honest]
- **Next scaling move:** [concrete]

---

## 🏗️ Key decisions & tradeoffs

**[Decision]**
- ✅ Chose: [what]
- ❌ Over: [alternative]
- 💡 Because: [one line]
- ⚠️ Downside: [honest one line]

(3–4 real decisions from the actual code)

---

## 🔧 What I'd improve

1. [Specific problem in this code] → [concrete fix]
2. [Problem] → [fix]
3. [Problem] → [fix]
4. [Problem] → [fix]

---

## ⚡ Local setup

\`\`\`bash
git clone https://github.com/${repoData.owner}/${repoData.repo}.git
cd ${repoData.repo}
# [correct install command from files]
cp .env.example .env
# [correct dev command]
\`\`\`

**Environment variables:**

| Variable | Required | What it does |
|----------|----------|-------------|

---

STRICT RULES:
- Every claim grounded in actual files. No invented features.
- ASCII diagrams REQUIRED — architecture + data models${hasUI ? ' + component tree' : ''}.
- Be opinionated. "This is a weak point" not "could be improved."
- BANNED: robust, scalable, modern, seamlessly, best practices (without specifics), powerful.`
}

export function buildReadmePrompt(repoData) {
  return `Write a GitHub README.md that makes someone stop scrolling. Think: best open-source READMEs — Excalidraw, Bun, shadcn/ui. Scannable in 30 seconds. Interesting enough to star.

Project: ${repoData.owner}/${repoData.repo}
Description: ${repoData.description || 'No description'}
Languages: ${JSON.stringify(repoData.languages)}
Topics: ${repoData.topics.join(', ')}
Live URL: ${repoData.homepage || 'None'}
Is Frontend: ${repoData.isFrontend ? 'Yes' : 'No'}
Stars: ${repoData.stars}
${repoData.screenshotUrl ? `App Screenshot URL: ${repoData.screenshotUrl}` : ''}

File contents:
${Object.entries(repoData.fileContents)
  .map(
    ([name, content]) =>
      `### ${name}\n\`\`\`\n${content.slice(0, 1500)}\n\`\`\``,
  )
  .join('\n\n')}

Exact structure:

---

# [emoji] [Project Name]

**[One sentence. Specific, value-first. Like a good tweet, not a job posting.]**

${repoData.homepage ? `[![Live Demo](https://img.shields.io/badge/▶_Try_it_live-4f46e5?style=for-the-badge)](${repoData.homepage})` : ''} ![Stars](https://img.shields.io/github/stars/${repoData.owner}/${repoData.repo}?style=for-the-badge&color=gold) ![Last commit](https://img.shields.io/github/last-commit/${repoData.owner}/${repoData.repo}?style=for-the-badge)

---

${
  repoData.screenshotUrl
    ? `## Demo\n\n**[→ Try it live](${repoData.homepage || '#'})**\n\n![${repoData.repo} screenshot](${repoData.screenshotUrl})`
    : repoData.homepage
      ? `## Demo\n\n**[→ ${repoData.homepage}](${repoData.homepage})**\n\n> Add a GIF or screenshot here — first thing visitors look for.`
      : `## Screenshots\n\n> Add a GIF or screenshot to \`/screenshots\` — first thing visitors look for.`
}

---

## What it does

2–3 sentences. Real problem → real solution.

## Features

- 🔥 **[Feature]** — [outcome, not capability]
- ⚡ **[Feature]** — [outcome]
- 🎯 **[Feature]** — [outcome]
(4–6 max, only real features from code)

## How it works

\`\`\`
[Input] ──▶ [Process] ──▶ [Output]
\`\`\`

1 sentence explanation.

## Stack

| Layer | Tech |
|-------|------|
(Only real tech from the code)

## Get started

\`\`\`bash
git clone https://github.com/${repoData.owner}/${repoData.repo}.git
cd ${repoData.repo}
# [correct commands from files]
\`\`\`

## License

MIT — [@${repoData.owner}](https://github.com/${repoData.owner})

---

RULES:
- Bold sentence = most important line. Specific enough that someone knows exactly what this does.
- Features are OUTCOMES not capabilities.
- Flow diagram required and real.
- Only real features from actual code.
- BANNED: robust, powerful, seamlessly, easy-to-use, modern, cutting-edge, leverage.`
}

export function buildInterviewPrepPrompt(repoData) {
  return `You are a senior engineer who just reviewed this codebase and is now helping the developer crush their next technical interview. You know exactly what interviewers at top companies ask. Style: direct, energetic, like a great tech mentor — not a textbook. Short punchy answers. Real talk.

Project: ${repoData.owner}/${repoData.repo}
Description: ${repoData.description || 'No description'}
Languages: ${JSON.stringify(repoData.languages)}
Topics: ${repoData.topics.join(', ')}
Live URL: ${repoData.homepage || 'None'}
Is Frontend: ${repoData.isFrontend ? 'Yes' : 'No'}
Files: ${repoData.allFiles.join(', ')}
${repoData.screenshotUrl ? `App Screenshot: ${repoData.screenshotUrl}` : ''}

File contents:
${Object.entries(repoData.fileContents)
  .map(
    ([name, content]) =>
      `### ${name}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``,
  )
  .join('\n\n')}

Write a KILLER INTERVIEW PREP DOC. Every section matters:

---

# 🎯 Interview Prep — ${repoData.repo}

> This is your weapon for technical interviews. Every answer is tuned for THIS project, not generic advice.

---

## ⚡ Your 60-second pitch

Practice this until it's muscle memory. This is your answer to "Tell me about a project you're proud of."

\`\`\`
"I built [project name with real description].
 The interesting challenge was [actual hard part from the code].
 I solved it by [your approach, specific to this project].
 The result: [outcome — what works now, what you learned]."
\`\`\`

---

## 🧠 Questions they WILL ask — with model answers

### 🗺️ Round 1 — Architecture & walkthrough

**"Walk me through your architecture."**
> [Confident, concise architecture walkthrough specific to THIS project. Name actual layers and files. 5–7 sentences. Sounds natural, not rehearsed.]

**"Why did you choose [main tech stack]?"**
> [Direct answer tied to THIS project's actual needs. Name the alternative you considered and why you didn't use it. 3–4 sentences.]

**"What was the hardest technical problem you solved?"**
> [Identify the actual hardest thing in this codebase. Describe problem → your approach → solution. Make it interesting. 4–5 sentences.]

**"How does your app handle errors?"**
> [Honest answer from actual code. What's caught. What propagates. What fails silently. What you'd add next.]

---

### 🔬 Round 2 — Deep dive (where most candidates fail)

**"Explain how [core feature] works under the hood."**
> [Pick the most interesting feature. Trace through actual code layers. Show you understand internals, not just the API. 4–6 sentences.]

**"What's the biggest scaling risk in your current architecture?"**
> [Name the actual bottleneck. Be specific. Give the concrete fix. Being honest about risks shows maturity — don't dodge this.]

**"How would you add [natural next feature] to this?"**
> [Pick a logical extension. Concrete plan: what you'd change, what you'd add, the tradeoff. 4–5 sentences.]

**"How is security handled? What are the weak points?"**
> [Honest breakdown: what's protected, what's not, what the real risks are. Being upfront about gaps is better than pretending it's perfect.]

---

### 🏗️ Round 3 — System design spin-offs

Interviewers use these to see how you THINK — inspired by your project:

**"If you had to handle 100x more traffic, what changes first?"**
> [Based on actual architecture — what breaks first, what you'd add: CDN, caching, queue, DB optimization. Concrete steps.]

**"How would you add real-time features to this?"**
> [WebSockets vs SSE vs polling — which fits this project, what the tradeoff is, what you'd actually change in the code.]

**"How would you make this fully production-ready?"**
> [Gap analysis specific to this code: logging, monitoring, error tracking, CI/CD, tests, rate limiting. Be specific.]

---

### 🔄 Round 4 — The "what would you change" questions

**"What would you do differently if you started over?"**
> [3 specific things from this actual code. Be direct. Good engineering judgment = honest self-assessment.]

**"What's the weakest part of this codebase?"**
> [Pick real weak spots. Format: here's what it is → why it's a risk → the fix. Don't be defensive.]

**"How did you test this?"**
> [Honest answer about what testing exists. If minimal, say so and describe what you'd add: unit, integration, e2e, tools.]

---

## 💬 Behavioral — project edition

**"Tell me about a technical decision you made that you later regretted."**
> [Find something real in the code. Frame it: decision → why it seemed right → what you learned. Shows reflection.]

**"What tradeoffs did you make building this?"**
> [2–3 real tradeoffs from the code. Format: chose X over Y because Z, but it costs you W.]

**"How did you scope this project?"**
> [Estimate the timeline based on complexity. Describe how you'd break it into milestones. Shows project management thinking.]

---

## 🃏 Cheat sheet — know these cold

| Question | Your answer |
|----------|------------|
| Main language | [language] |
| Core dependencies | [2–3 most important] |
| How requests flow | [1-line summary] |
| Biggest tech decision | [decision + 1-line reason] |
| Biggest weakness | [honest 1-liner] |
| How to scale it | [concrete first step] |
| What you'd add next | [specific feature + why] |

---

## 🚀 Phrases that signal senior thinking

Drop these naturally into your answers:

- *"The tradeoff I made was..."* → shows you think in tradeoffs
- *"If I were to scale this, the first thing that breaks is..."* → systems thinking
- *"I chose X over Y because at this scale..."* → context-aware decisions
- *"The thing I'd add next is X, because the current bottleneck is..."* → product + engineering thinking
- *"Looking back, I would have..."* → reflection and growth

---

## ⚠️ Traps — don't get caught

**"Is this production-ready?"**
→ Don't say yes if it's not. Say: "It's production-capable, with X and Y to add for full load. Here's what I'd prioritize..."

**"How does [library/framework you used] actually work internally?"**
→ Know the internals. For this project, be ready to explain how [key tech] actually works, not just what it does.

**"Why didn't you use [obvious alternative]?"**
→ You need a "why not X" answer for every major tech choice in your stack. Review the stack now.

---

STRICT RULES:
- Every answer MUST be specific to this actual codebase. No generic "best practices" filler.
- The 60-second pitch must be filled in with real project details — not a template with brackets.
- The cheat sheet must have real answers, not placeholders.
- Tone: mentor + peer. Confident, direct, occasionally opinionated.
- Make the developer feel READY — sharp and focused, not overwhelmed.
- BANNED: "it's important to", "one might consider", "it's worth noting", "in today's world", "robust", "best practices" (without specifics).`
}
