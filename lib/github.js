export async function parseRepoUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/?\s]+)/)
  if (!match) throw new Error('Invalid GitHub URL')
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') }
}

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

async function fetchSocialPreview(owner, repo) {
  try {
    const url = `https://opengraph.githubassets.com/1/${owner}/${repo}`
    const res = await fetch(url, { method: 'HEAD' })
    if (res.ok && res.headers.get('content-type')?.startsWith('image/'))
      return url
  } catch {}
  return null
}

// Recursively fetch src/ directory tree (max depth 2, max 40 files)
async function fetchSrcTree(owner, repo, headers) {
  const srcPaths = [
    'src',
    'app',
    'lib',
    'server',
    'client',
    'pages',
    'components',
    'api',
  ]
  const found = []
  await Promise.all(
    srcPaths.map(async (dir) => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${dir}`,
          { headers },
        )
        if (!res.ok) return
        const items = await res.json()
        if (!Array.isArray(items)) return
        items.slice(0, 20).forEach((f) => {
          found.push(`${dir}/${f.name}`)
        })
      } catch {}
    }),
  )
  return found.slice(0, 60)
}

// Fetch key files beyond root level
async function fetchDeepFiles(owner, repo, contents, headers) {
  const deepFiles = [
    'src/index.js',
    'src/index.ts',
    'src/main.ts',
    'src/main.js',
    'src/App.jsx',
    'src/App.tsx',
    'src/app.js',
    'src/app.ts',
    'src/server.js',
    'src/server.ts',
    'app/layout.tsx',
    'app/page.tsx',
    'app/layout.js',
    'app/page.js',
    'server/index.js',
    'server/index.ts',
    'lib/db.js',
    'lib/db.ts',
    'lib/auth.js',
    'lib/auth.ts',
    'prisma/schema.prisma',
    '.env.example',
    '.env.sample',
    '.env.template',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'docker-compose.yml',
    'docker-compose.yaml',
    '.github/workflows/ci.yml',
    '.github/workflows/deploy.yml',
    'Makefile',
  ]

  // Also grab any files from root contents that look important
  const rootFiles = contents
    .filter(
      (f) => f.type === 'file' && /\.(js|ts|py|go|rb|java|rs)$/.test(f.name),
    )
    .slice(0, 5)
    .map((f) => f.name)

  const allTargets = [...new Set([...deepFiles, ...rootFiles])]
  const fileContents = {}

  await Promise.all(
    allTargets.map(async (path) => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
          { headers },
        )
        if (!res.ok) return
        const info = await res.json()
        if (info.type !== 'file' || !info.download_url) return
        const text = await fetch(info.download_url, { headers }).then((r) =>
          r.text(),
        )
        fileContents[path] = text.slice(0, 2000) // cap per file
      } catch {}
    }),
  )
  return fileContents
}

export async function fetchRepoData(owner, repo, userToken) {
  const token = userToken || process.env.GITHUB_TOKEN
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  }

  // Step 1 — fetch all metadata in parallel, parse each response exactly once
  const [repoRes, contentsRes, langRes, commitsRes, contributorsRes] =
    await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, {
        headers,
      }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, {
        headers,
      }),
      fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`,
        { headers },
      ),
      fetch(
        `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=10`,
        { headers },
      ),
    ])

  if (!repoRes.ok) {
    throw new Error(
      repoRes.status === 404
        ? 'Repo not found or private — add your GitHub token under "Private repo?" to access it'
        : 'GitHub API error',
    )
  }

  // Parse each response body exactly once — never call .json() twice on the same response
  const [repoInfo, contentsRaw, languages, commitsData, contributorsData] =
    await Promise.all([
      repoRes.json(),
      contentsRes.ok ? contentsRes.json() : Promise.resolve([]),
      langRes.ok ? langRes.json() : Promise.resolve({}),
      commitsRes.ok ? commitsRes.json() : Promise.resolve([]),
      contributorsRes.ok ? contributorsRes.json() : Promise.resolve([]),
    ])

  const contentsArr = Array.isArray(contentsRaw) ? contentsRaw : []

  // Step 2 — fetch root files + deep files + src tree in parallel
  const rootImportant = [
    'README.md',
    'package.json',
    'requirements.txt',
    'go.mod',
    'Cargo.toml',
    'pyproject.toml',
    'index.js',
    'index.ts',
    'main.py',
    'app.py',
    'vite.config.js',
    'vite.config.ts',
    'next.config.js',
    'next.config.ts',
  ]

  const [rootFileContents, deepFileContents, srcTree] = await Promise.all([
    // Root files — download directly from download_url, no extra API call needed
    Promise.all(
      contentsArr
        .filter(
          (f) =>
            rootImportant.includes(f.name) &&
            f.type === 'file' &&
            f.download_url,
        )
        .map(async (f) => {
          try {
            const r = await fetch(f.download_url, { headers })
            if (!r.ok) return null
            const text = await r.text()
            return [f.name, text.slice(0, 2000)]
          } catch {
            return null
          }
        }),
    ).then((results) => Object.fromEntries(results.filter(Boolean))),

    // Deep files inside subdirs
    fetchDeepFiles(owner, repo, contentsArr, headers),

    // src/ directory tree
    fetchSrcTree(owner, repo, headers),
  ])

  const fileContents = { ...rootFileContents, ...deepFileContents }

  // Process commits
  const recentCommits = Array.isArray(commitsData)
    ? commitsData.slice(0, 8).map((c) => ({
        message: c.commit?.message?.split('\n')[0] || '',
        author: c.commit?.author?.name || '',
        date: c.commit?.author?.date?.slice(0, 10) || '',
      }))
    : []

  // Process contributors
  const topContributors = Array.isArray(contributorsData)
    ? contributorsData.slice(0, 5).map((c) => ({
        login: c.login,
        contributions: c.contributions,
      }))
    : []

  const isFrontend = detectFrontend(contentsArr, languages, fileContents)
  let screenshotUrl = null
  if (isFrontend) screenshotUrl = await fetchSocialPreview(owner, repo)

  return {
    name: repoInfo.name,
    description: repoInfo.description,
    homepage: repoInfo.homepage,
    stars: repoInfo.stargazers_count,
    forks: repoInfo.forks_count,
    openIssues: repoInfo.open_issues_count || 0,
    language: repoInfo.language,
    languages,
    topics: repoInfo.topics || [],
    defaultBranch: repoInfo.default_branch,
    license: repoInfo.license?.spdx_id || null,
    owner,
    repo,
    fileContents,
    allFiles: contentsArr.map((f) => f.name),
    srcTree,
    recentCommits,
    topContributors,
    createdAt: repoInfo.created_at,
    updatedAt: repoInfo.updated_at,
    pushedAt: repoInfo.pushed_at,
    isFrontend,
    screenshotUrl,
  }
}
