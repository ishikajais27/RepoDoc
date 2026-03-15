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
      max_tokens: 3500,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Groq API error')
  return data.choices[0].message.content
}

const DOC_BUILDERS = {
  user: (r) => buildUserDocPrompt(r),
  dev: (r) => buildDevDocPrompt(r),
  readme: (r) => buildReadmePrompt(r),
  interview: (r) => buildInterviewPrepPrompt(r),
}

export async function POST(req) {
  try {
    const { url, userToken, selectedDocs } = await req.json()
    if (!url) return Response.json({ error: 'URL required' }, { status: 400 })

    const docsToGenerate =
      Array.isArray(selectedDocs) && selectedDocs.length > 0
        ? selectedDocs
        : ['user', 'dev', 'readme', 'interview']

    const { owner, repo } = await parseRepoUrl(url)
    const repoData = await fetchRepoData(owner, repo, userToken)

    // ⚡ Parallel with 600ms stagger — avoids Groq 429s, ~5x faster than sequential
    const entries = await Promise.all(
      docsToGenerate
        .filter((d) => DOC_BUILDERS[d])
        .map(async (docType, i) => {
          await new Promise((r) => setTimeout(r, i * 600))
          const content = await callGroq(DOC_BUILDERS[docType](repoData))
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
