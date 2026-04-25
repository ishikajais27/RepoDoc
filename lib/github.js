// ─── github.js ────────────────────────────────────────────────────────────────
const FILE_CONTENT_CAP = 3000
const MAX_DEEP_FILES = 40
const RATE_LIMIT_WARN_THRESHOLD = 100
const RATE_LIMIT_ERROR_THRESHOLD = 10

export async function parseRepoUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/?\s#]+)/)
  if (!match)
    throw new Error(
      'Invalid GitHub URL — expected format: https://github.com/owner/repo',
    )
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') }
}

function parseRateLimit(res) {
  const remaining = parseInt(
    res.headers.get('X-RateLimit-Remaining') || '-1',
    10,
  )
  const limit = parseInt(res.headers.get('X-RateLimit-Limit') || '-1', 10)
  const resetEpoch = parseInt(res.headers.get('X-RateLimit-Reset') || '0', 10)
  const resetAt = resetEpoch ? new Date(resetEpoch * 1000).toISOString() : null
  const resetInSec = resetEpoch
    ? Math.max(0, resetEpoch - Math.floor(Date.now() / 1000))
    : null
  return { remaining, limit, resetAt, resetInSec }
}

let _githubRateLimit = {
  remaining: -1,
  limit: 5000,
  resetAt: null,
  resetInSec: null,
}

export function getGithubRateLimit() {
  return _githubRateLimit
}

function updateRateLimit(res) {
  const rl = parseRateLimit(res)
  if (rl.remaining >= 0) {
    _githubRateLimit = rl
    if (rl.remaining < RATE_LIMIT_WARN_THRESHOLD) {
      console.warn(
        JSON.stringify({
          event: 'github_rate_limit_low',
          remaining: rl.remaining,
          resetAt: rl.resetAt,
          resetInSec: rl.resetInSec,
        }),
      )
    }
  }
  return rl
}

// Safe JSON parser — guards against empty bodies, 204s, truncated responses
async function safeJson(res, fallback) {
  try {
    const text = await res.text()
    if (!text || !text.trim()) return fallback
    return JSON.parse(text)
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: 'json_parse_failed',
        status: res.status,
        error: err.message,
      }),
    )
    return fallback
  }
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
      if (frontendDeps.some((d) => d in deps)) return true
    } catch {
      console.warn(JSON.stringify({ event: 'package_json_parse_failed' }))
    }
  }

  return hasFrontendLang && hasFrontendFile
}

async function fetchSocialPreview(owner, repo) {
  try {
    const url = `https://opengraph.githubassets.com/1/${owner}/${repo}`
    const res = await fetch(url, { method: 'HEAD' })
    if (res.ok && res.headers.get('content-type')?.startsWith('image/'))
      return url
  } catch (err) {
    console.warn(
      JSON.stringify({ event: 'social_preview_failed', error: err.message }),
    )
  }
  return null
}

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

        const text = await res.text()
        if (!text || !text.trim()) return

        let items
        try {
          items = JSON.parse(text)
        } catch {
          return
        }

        if (!Array.isArray(items)) return
        items.slice(0, 20).forEach((f) => found.push(`${dir}/${f.name}`))
      } catch (err) {
        console.warn(
          JSON.stringify({
            event: 'src_dir_not_found',
            dir,
            error: err.message,
          }),
        )
      }
    }),
  )

  return found.slice(0, 60)
}

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

  const rootSourceFiles = contents
    .filter(
      (f) => f.type === 'file' && /\.(js|ts|py|go|rb|java|rs)$/.test(f.name),
    )
    .slice(0, 5)
    .map((f) => f.name)

  const allTargets = [...new Set([...deepFiles, ...rootSourceFiles])].slice(
    0,
    MAX_DEEP_FILES,
  )
  const fileContents = {}

  await Promise.all(
    allTargets.map(async (path) => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
          { headers },
        )
        if (!res.ok) return

        const text = await res.text()
        if (!text || !text.trim()) return

        let info
        try {
          info = JSON.parse(text)
        } catch {
          return
        }

        if (!info || info.type !== 'file' || !info.download_url) return

        const textRes = await fetch(info.download_url, { headers })
        if (!textRes.ok) return

        const content = await textRes.text()
        fileContents[path] = content.slice(0, FILE_CONTENT_CAP)
      } catch (err) {
        console.warn(
          JSON.stringify({
            event: 'deep_file_fetch_failed',
            path,
            error: err.message,
          }),
        )
      }
    }),
  )

  return fileContents
}

export async function fetchRepoData(owner, repo, userToken) {
  const token = userToken || process.env.GITHUB_TOKEN

  if (!token) {
    console.warn(
      JSON.stringify({
        event: 'no_github_token',
        message: 'Running unauthenticated — 60 req/hr limit applies',
      }),
    )
  }

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }

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

  const rl = updateRateLimit(repoRes)
  if (rl.remaining !== -1 && rl.remaining < RATE_LIMIT_ERROR_THRESHOLD) {
    throw new Error(
      `GitHub API rate limit critically low (${rl.remaining} remaining). ` +
        `Resets in ${rl.resetInSec}s. Add your GitHub token to increase limit to 5000/hr.`,
    )
  }

  if (!repoRes.ok) {
    if (repoRes.status === 404) {
      throw new Error(
        'Repo not found or private — add your GitHub token under "Private repo?" to access it',
      )
    }
    if (repoRes.status === 403) {
      throw new Error(
        `GitHub API rate limited. ${
          token
            ? `Resets at ${rl.resetAt}.`
            : 'Add a GitHub token to increase the limit from 60 to 5000 requests/hour.'
        }`,
      )
    }
    throw new Error(`GitHub API error: HTTP ${repoRes.status}`)
  }

  const [repoInfo, contentsRaw, languages, commitsData, contributorsData] =
    await Promise.all([
      safeJson(repoRes, {}),
      safeJson(contentsRes, []),
      safeJson(langRes, {}),
      safeJson(commitsRes, []),
      safeJson(contributorsRes, []),
    ])

  const contentsArr = Array.isArray(contentsRaw) ? contentsRaw : []

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
            if (!text) return null
            return [f.name, text.slice(0, FILE_CONTENT_CAP)]
          } catch (err) {
            console.warn(
              JSON.stringify({
                event: 'root_file_fetch_failed',
                file: f.name,
                error: err.message,
              }),
            )
            return null
          }
        }),
    ).then((results) => Object.fromEntries(results.filter(Boolean))),

    fetchDeepFiles(owner, repo, contentsArr, headers),
    fetchSrcTree(owner, repo, headers),
  ])

  const fileContents = { ...rootFileContents, ...deepFileContents }

  const recentCommits = Array.isArray(commitsData)
    ? commitsData.slice(0, 8).map((c) => ({
        message: c.commit?.message?.split('\n')[0] || '',
        author: c.commit?.author?.name || '',
        date: c.commit?.author?.date?.slice(0, 10) || '',
      }))
    : []

  const topContributors = Array.isArray(contributorsData)
    ? contributorsData.slice(0, 5).map((c) => ({
        login: c.login,
        contributions: c.contributions,
      }))
    : []

  const isFrontend = detectFrontend(contentsArr, languages, fileContents)
  let screenshotUrl = null
  if (isFrontend) screenshotUrl = await fetchSocialPreview(owner, repo)

  console.log(
    JSON.stringify({
      event: 'repo_data_ready',
      owner,
      repo,
      filesFetched: Object.keys(fileContents).length,
      srcTreeSize: srcTree.length,
      languages: Object.keys(languages).slice(0, 5),
      githubRateLimitRemaining: rl.remaining,
    }),
  )

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
    _githubRateLimit: rl,
  }
}
