export async function parseRepoUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/?\s]+)/)
  if (!match) throw new Error('Invalid GitHub URL')
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') }
}

// Detect if repo is a frontend project by checking files and languages
function detectFrontend(contents, languages, fileContents) {
  const frontendLangs = [
    'JavaScript',
    'TypeScript',
    'HTML',
    'CSS',
    'Vue',
    'Svelte',
  ]
  const frontendFiles = [
    'package.json',
    'index.html',
    'vite.config.js',
    'vite.config.ts',
    'next.config.js',
    'next.config.ts',
    'nuxt.config.js',
    'angular.json',
    'svelte.config.js',
    'tailwind.config.js',
  ]
  const fileNames = contents.map((f) => f.name)

  const hasFrontendLang = Object.keys(languages).some((l) =>
    frontendLangs.includes(l),
  )
  const hasFrontendFile = frontendFiles.some((f) => fileNames.includes(f))

  // Check package.json for frontend frameworks
  const pkg = fileContents['package.json']
  if (pkg) {
    try {
      const parsed = JSON.parse(pkg)
      const deps = { ...parsed.dependencies, ...parsed.devDependencies }
      const frontendDeps = [
        'react',
        'vue',
        'svelte',
        'next',
        'nuxt',
        'angular',
        'vite',
        'astro',
      ]
      if (frontendDeps.some((d) => deps[d])) return true
    } catch {}
  }

  return hasFrontendLang && hasFrontendFile
}

// Fetch the GitHub social preview image (og:image) for a repo
async function fetchSocialPreview(owner, repo) {
  try {
    // GitHub serves an auto-generated social preview for every public repo
    // at this URL — it's the same image shown in link previews
    const url = `https://opengraph.githubassets.com/1/${owner}/${repo}`
    // Verify it returns a valid image by checking headers (no auth needed)
    const res = await fetch(url, { method: 'HEAD' })
    if (res.ok && res.headers.get('content-type')?.startsWith('image/')) {
      return url
    }
  } catch {}
  return null
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
    'src/App.tsx',
    'vite.config.js',
    'vite.config.ts',
    'next.config.js',
    'next.config.ts',
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

  const isFrontend = detectFrontend(contents, languages, fileContents)

  // Fetch social preview screenshot for frontend repos
  let screenshotUrl = null
  if (isFrontend) {
    screenshotUrl = await fetchSocialPreview(owner, repo)
  }

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
    isFrontend,
    screenshotUrl,
  }
}
