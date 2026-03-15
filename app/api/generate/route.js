import { parseRepoUrl, fetchRepoData } from '../../../lib/github'
import {
  buildDevDocPrompt,
  buildReadmePrompt,
  buildUserDocPrompt,
  buildInterviewPrepPrompt,
} from '../../../lib/prompts'

async function callGroq(prompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Groq API error')
  return data.choices[0].message.content
}

// All available doc types and their prompt builders
const DOC_BUILDERS = {
  user: (repoData) => buildUserDocPrompt(repoData),
  dev: (repoData) => buildDevDocPrompt(repoData),
  readme: (repoData) => buildReadmePrompt(repoData),
  interview: (repoData) => buildInterviewPrepPrompt(repoData),
}

export async function POST(req) {
  try {
    const { url, userToken, selectedDocs } = await req.json()
    if (!url) return Response.json({ error: 'URL required' }, { status: 400 })

    // Default: generate all docs if none specified
    const docsToGenerate =
      Array.isArray(selectedDocs) && selectedDocs.length > 0
        ? selectedDocs
        : ['user', 'dev', 'readme', 'interview']

    const { owner, repo } = await parseRepoUrl(url)
    const repoData = await fetchRepoData(owner, repo, userToken)

    // Groq free tier has rate limits — run sequentially to avoid 429s
    const results = {}
    for (const docType of docsToGenerate) {
      if (DOC_BUILDERS[docType]) {
        results[docType] = await callGroq(DOC_BUILDERS[docType](repoData))
      }
    }

    return Response.json({
      ...results,
      repoData,
      generatedDocs: docsToGenerate,
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
