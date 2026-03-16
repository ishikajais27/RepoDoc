import { parseRepoUrl, fetchRepoData } from '../../../lib/github'
import {
  buildDevDocPrompt,
  buildReadmePrompt,
  buildUserDocPrompt,
  buildInterviewPrepPrompt,
} from '../../../lib/prompts'

// ─── Groq model rotation ──────────────────────────────────────────────────────
// Each model has its OWN separate rate limit bucket on Groq free tier.
// We rotate through them so one doc uses model A, the next uses model B, etc.
// If a model is rate-limited, we automatically fall back to the next one.
// ─── Groq models (primary) ────────────────────────────────────────────────────
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']

// ─── OpenRouter free models (fallback when Groq is fully rate-limited) ────────
// openrouter/free automatically picks the best available free model —
// it never breaks when individual models get decommissioned
const OPENROUTER_MODELS = [
  'openrouter/auto', // auto-picks best available free model
  'meta-llama/llama-3.3-70b-instruct:free', // confirmed working March 2026
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
]

async function callGroq(prompt, modelIndex = 0) {
  if (modelIndex >= GROQ_MODELS.length) return null // signal to try OpenRouter

  const model = GROQ_MODELS[modelIndex]
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 3500,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()

  if (res.status === 429 || data.error?.code === 'rate_limit_exceeded') {
    console.warn(`[Groq] ${model} rate-limited, trying next...`)
    return callGroq(prompt, modelIndex + 1)
  }

  if (!res.ok) throw new Error(data.error?.message || `Groq error (${model})`)
  return data.choices[0].message.content
}

async function callOpenRouter(prompt, modelIndex = 0) {
  if (!process.env.OPENROUTER_API_KEY) return null

  if (modelIndex >= OPENROUTER_MODELS.length) {
    throw new Error(
      'All AI providers are rate-limited. Please wait a few minutes and try again.',
    )
  }

  const model = OPENROUTER_MODELS[modelIndex]
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer':
        process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'GitDoc',
    },
    body: JSON.stringify({
      model,
      max_tokens: 3500,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()

  if (res.status === 429 || data.error?.code === 'rate_limit_exceeded') {
    console.warn(`[OpenRouter] ${model} rate-limited, trying next...`)
    return callOpenRouter(prompt, modelIndex + 1)
  }

  if (!res.ok)
    throw new Error(data.error?.message || `OpenRouter error (${model})`)
  return data.choices[0].message.content
}

// Try Groq first, fall back to OpenRouter if all Groq models are rate-limited
async function callAI(prompt, groqStartIndex = 0) {
  const groqResult = await callGroq(prompt, groqStartIndex)
  if (groqResult !== null) return groqResult

  console.warn(
    '[AI] All Groq models rate-limited, falling back to OpenRouter...',
  )
  return callOpenRouter(prompt)
}

// ─── Doc builders ─────────────────────────────────────────────────────────────
const DOC_BUILDERS = {
  user: (r, opts) => buildUserDocPrompt(r, opts),
  dev: (r, opts) => buildDevDocPrompt(r, opts),
  readme: (r, opts) => buildReadmePrompt(r, opts),
  interview: (r, opts) => buildInterviewPrepPrompt(r, opts),
}

// ─── POST /api/generate ───────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const {
      url,
      userToken,
      selectedDocs,
      options = {},
      regenerateInstruction,
    } = await req.json()
    if (!url) return Response.json({ error: 'URL required' }, { status: 400 })

    const docsToGenerate =
      Array.isArray(selectedDocs) && selectedDocs.length > 0
        ? selectedDocs
        : ['user', 'dev', 'readme', 'interview']

    const opts = regenerateInstruction
      ? { ...options, extraInstruction: regenerateInstruction }
      : options

    const { owner, repo } = await parseRepoUrl(url)
    const repoData = await fetchRepoData(owner, repo, userToken)

    // ⚡ Parallel with 800ms stagger + each doc starts on a different model
    const entries = await Promise.all(
      docsToGenerate
        .filter((d) => DOC_BUILDERS[d])
        .map(async (docType, i) => {
          await new Promise((r) => setTimeout(r, i * 800))
          const startModel = i % GROQ_MODELS.length
          const content = await callAI(
            DOC_BUILDERS[docType](repoData, opts),
            startModel,
          )
          return [docType, content]
        }),
    )

    const results = Object.fromEntries(entries)
    return Response.json({
      ...results,
      repoData,
      generatedDocs: docsToGenerate,
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
