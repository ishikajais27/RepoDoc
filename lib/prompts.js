export function buildUserDocPrompt(repoData) {
  return `You explain software to non-technical people. Warm, clear, never condescending. Simplest words possible.

Project: ${repoData.owner}/${repoData.repo}
Description: ${repoData.description || 'No description'}
Language: ${repoData.language}
Live URL: ${repoData.homepage || 'None'}
Files: ${repoData.allFiles.join(', ')}

File contents:
${Object.entries(repoData.fileContents)
  .map(
    ([name, content]) =>
      `### ${name}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``,
  )
  .join('\n\n')}

Write a USER DOC in markdown. Exact structure:

---
${repoData.homepage ? `> 🚀 **[Open the app — no setup needed](${repoData.homepage})**\n` : ''}

## What is [Project Name]?
2–3 sentences. Start with the problem. Then what this does about it. No technical words — if a 12-year-old wouldn't understand it, replace it.

## What can you do with it?
Bullet list. Each bullet = one real thing you can do, written as a benefit.
**Do the thing** — why it's useful in plain English. Max 6 bullets.

## How to use it
${
  repoData.homepage
    ? `The app is online. No installation needed.\n\n**Step 1:** Go to ${repoData.homepage}\nWalk through exactly what the user sees and does, step by step. Numbered. One action per step. One sentence per step.`
    : `Numbered steps. Max 5. One action, one sentence each.\nFor any terminal command, show it in a code block then explain what it does in plain English below it.`
}

## Example: [Realistic use case]
"Imagine you want to [X]. Here's what you do..." — 3–5 sentences, real scenario, start to finish.

## Common questions

**Q: [Most obvious question a new user would ask]**
A: Direct answer. 1–2 sentences.

**Q: [Second most common confusion]**
A: Direct answer.

**Q: [One more real question]**
A: Direct answer.

## Something not working?
One sentence. Where to get help.

---

STRICT RULES:
- Zero jargon. No: API, backend, frontend, deploy, repository, runtime, framework, dependency — unless explained immediately in plain English in parentheses.
- "you" and "your" always. Never "the user".
- No paragraph longer than 3 sentences.
- BANNED: straightforward, simple, easy, just, seamlessly, utilize, leverage, robust, powerful, functionality, enables, allows you to, in order to.`
}

export function buildDevDocPrompt(repoData) {
  return `You are a staff engineer presenting this project to a senior technical interviewer. You write in tight, precise bullets and short answers — never long paragraphs. Every line should make the reader think "this person really understands what they built."

Project: ${repoData.owner}/${repoData.repo}
Description: ${repoData.description || 'No description'}
Languages: ${JSON.stringify(repoData.languages)}
Topics: ${repoData.topics.join(', ')}
Live URL: ${repoData.homepage || 'None'}
Files: ${repoData.allFiles.join(', ')}

File contents:
${Object.entries(repoData.fileContents)
  .map(
    ([name, content]) =>
      `### ${name}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``,
  )
  .join('\n\n')}

Write a TECHNICAL DOC. Use ONLY bullets, short answers, tables, and code blocks. Zero long paragraphs. A senior engineer should scan this in 2 minutes and know everything important.

---

## What it does
- **Problem:** [one line — the exact problem]
- **Solution:** [one line — what the system does]
- **Scope:** [one line — what it is and isn't responsible for]

## Data flow
Show the full request lifecycle as a step-by-step numbered flow. Each step = one line. Name actual files/functions where possible.
\`\`\`
1. User submits X → [file/function]
2. [What happens] → [file/function]
3. [What happens] → [file/function]
4. Response returned → [shape of data]
\`\`\`
Then one line each on:
- **State lives in:** [where and why]
- **Async boundaries:** [what's async, what's sync, and why]
- **Error propagation:** [how errors flow and surface]

## Tech stack
| Technology | Role | Why this, not [alternative] |
|------------|------|----------------------------|
Be specific. Not "Next.js for frontend." → "Next.js App Router — server components eliminate client JS on static pages, file-based routing mirrors feature structure." Every row must answer "why not the obvious alternative."

## Security
- **Auth model:** [how auth works, what's protected]
- **Input validation:** [where and how inputs are validated]
- **Data exposure:** [what data could leak, where the risk is]
- **Trust boundaries:** [what the system trusts and what it doesn't]
- **Known risks:** [be honest — what's not handled]

## Load & performance
- **Bottleneck #1:** [what it is, at what scale it breaks]
- **Bottleneck #2:** [if applicable]
- **Current optimizations:** [what's been done, if anything]
- **What breaks first under load:** [specific, honest answer]
- **How I'd scale it:** [concrete next step — caching, queue, CDN, etc.]

## Key decisions & tradeoffs
For each decision, one tight block:
**[Decision name]**
- Chose: [what]
- Over: [alternative]
- Because: [one line reason]
- Downside: [honest one line]

Do this for 3–4 real decisions found in the code.

## What I'd improve
Numbered list. Specific. Each one = the problem + the fix.
1. [Specific problem in this codebase] → [specific fix]
2. [Specific problem] → [specific fix]
3. [Specific problem] → [specific fix]

## Interview Q&A
The most important section. Write 8–10 questions an interviewer would actually ask about this project and these tech choices — then answer each one the way a senior engineer would. Short, confident, technically precise answers. No fluff.

**Q: Why did you choose [main framework/language] for this?**
A: [Specific reason tied to this project's needs. Mention what you'd use instead at different scale.]

**Q: Walk me through what happens when a user submits [the main action in this app].**
A: [Trace the request through the actual system, naming layers/files.]

**Q: How does your system handle errors?**
A: [Honest answer about error handling — what's caught, what propagates, what fails silently.]

**Q: What's the biggest scaling risk in your current architecture?**
A: [Name the specific bottleneck. Give the specific fix.]

**Q: How would you add [a natural feature extension]?**
A: [Concrete answer — what you'd change, what you'd add, what the tradeoff is.]

**Q: How is security handled? What are the weak points?**
A: [Honest answer. Name the real risks.]

**Q: What would you do differently if you started over?**
A: [Specific, grounded in what's actually in the code.]

**Q: How does [a key technical choice] work under the hood?**
A: [Show you understand the internals, not just the API.]

Add 2–3 more questions specific to the actual tech stack and patterns found in this codebase.

## Local setup
\`\`\`bash
git clone https://github.com/${repoData.owner}/${repoData.repo}.git
cd ${repoData.repo}
npm install        # or correct package manager
cp .env.example .env
npm run dev
\`\`\`

| Variable | Required | Purpose |
|----------|----------|---------|

---

STRICT RULES:
- NO long paragraphs anywhere. Bullets and short answers only.
- Every technical claim must be grounded in the actual files. No invented features.
- Be opinionated and direct. "This is a weak point" not "this could potentially be improved."
- Interview Q&A answers must sound like a confident engineer in a real interview — concise, technically sharp, honest about tradeoffs.
- BANNED: robust, scalable, modern, seamlessly, best practices (without specifics), "this ensures", "in order to", "powerful".`
}

export function buildReadmePrompt(repoData) {
  return `Write a GitHub README.md. Developer or recruiter should understand what this is, want to try it, and know how to run it — in 30 seconds.

Project: ${repoData.owner}/${repoData.repo}
Description: ${repoData.description || 'No description'}
Languages: ${JSON.stringify(repoData.languages)}
Topics: ${repoData.topics.join(', ')}
Live URL: ${repoData.homepage || 'None'}
Stars: ${repoData.stars}

File contents:
${Object.entries(repoData.fileContents)
  .map(
    ([name, content]) =>
      `### ${name}\n\`\`\`\n${content.slice(0, 1500)}\n\`\`\``,
  )
  .join('\n\n')}

Exact structure:

---

# [emoji] [Project Name] — [specific, memorable tagline — tells you exactly what it does]

![Stars](https://img.shields.io/github/stars/${repoData.owner}/${repoData.repo}?style=flat-square) ![Last commit](https://img.shields.io/github/last-commit/${repoData.owner}/${repoData.repo}?style=flat-square)${repoData.homepage ? ` [![Live Demo](https://img.shields.io/badge/demo-live-brightgreen?style=flat-square)](${repoData.homepage})` : ''}

> **[Single sentence. Most precise, value-first description possible.]**

${
  repoData.homepage
    ? `## Demo\n**[→ Try it live](${repoData.homepage})**\n\n[Screenshot or GIF of the most impressive part]`
    : `## Screenshots\n![App](screenshots/home.png)\n> Add screenshots to \`screenshots/\` — first thing visitors look for.`
}

## What it does
2–3 sentences. Real problem → real solution. Specific.

## Features
- **[Feature]** — [outcome for the user]
(4–6 max)

## Stack
| Layer | Tech | Notes |
|-------|------|-------|

## Get started
\`\`\`bash
git clone https://github.com/${repoData.owner}/${repoData.repo}.git
cd ${repoData.repo}
# actual commands based on files found
\`\`\`

## License
MIT — [@${repoData.owner}](https://github.com/${repoData.owner})

---

RULES:
- Tagline must be specific. "Turn any GitHub repo into full documentation in 30 seconds" not "A documentation generator."
- The > quote is the most important line. Make it the clearest sentence in the file.
- Features are outcomes. "Get three doc formats in one click" not "supports multiple output formats."
- Only real features from the actual code.`
}
