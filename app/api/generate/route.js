import { fetchRepoData, parseRepoUrl } from '../../../lib/github'
import {
  buildDevDocPrompt,
  buildReadmePrompt,
  buildUserDocPrompt,
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

export async function POST(req) {
  try {
    const { url } = await req.json()
    if (!url) return Response.json({ error: 'URL required' }, { status: 400 })

    const { owner, repo } = await parseRepoUrl(url)
    const repoData = await fetchRepoData(owner, repo)

    // Groq free tier has rate limits, so run sequentially to avoid 429s
    const userDoc = await callGroq(buildUserDocPrompt(repoData))
    const devDoc = await callGroq(buildDevDocPrompt(repoData))
    const readme = await callGroq(buildReadmePrompt(repoData))

    return Response.json({ userDoc, devDoc, readme, repoData })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
