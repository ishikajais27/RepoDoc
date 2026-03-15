export async function parseRepoUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/?\s]+)/)
  if (!match) throw new Error('Invalid GitHub URL')
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') }
}

export async function fetchRepoData(owner, repo, userToken) {
  const token = userToken || process.env.GITHUB_TOKEN
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  }

  const [repoRes, contentsRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, {
      headers,
    }),
  ])

  if (!repoRes.ok) {
    throw new Error(
      repoRes.status === 404
        ? 'Repo not found or private — add your GitHub token under "Private repo?" to access it'
        : 'GitHub API error',
    )
  }

  const repoInfo = await repoRes.json()
  const contents = await contentsRes.json()

  const importantFiles = [
    'README.md',
    'package.json',
    'requirements.txt',
    'index.js',
    'index.ts',
    'main.py',
    'app.py',
    'src/index.js',
    'src/App.jsx',
  ]

  const fileContents = {}
  await Promise.all(
    contents
      .filter((f) => importantFiles.includes(f.name) && f.type === 'file')
      .map(async (f) => {
        const r = await fetch(f.download_url, { headers })
        fileContents[f.name] = await r.text()
      }),
  )

  const langRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/languages`,
    { headers },
  )
  const languages = await langRes.json()

  return {
    name: repoInfo.name,
    description: repoInfo.description,
    homepage: repoInfo.homepage,
    stars: repoInfo.stargazers_count,
    language: repoInfo.language,
    languages,
    topics: repoInfo.topics || [],
    defaultBranch: repoInfo.default_branch,
    owner,
    repo,
    fileContents,
    allFiles: contents.map((f) => f.name),
    createdAt: repoInfo.created_at,
    updatedAt: repoInfo.updated_at,
  }
}
