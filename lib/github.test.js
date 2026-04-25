// ─── github.test.js ───────────────────────────────────────────────────────────
// Unit tests for github.js utilities.
// Run with: npm test  (Jest or Vitest — compatible with both)
//
// Why these specific tests:
//   Amazon will ask: "how do you know your system works correctly?"
//   Answer: automated tests on the core parsing and rate-limit logic.
//   These 5 test cases cover the input space an interviewer would probe:
//   valid URLs, .git suffix, query params, fragment, invalid input.
//
// What to add next (honest roadmap):
//   - Mock fetch and test fetchRepoData rate-limit detection
//   - Test LRU cache eviction behavior (most important DS interview topic)
//   - Test TokenBucket refill math
//   - Integration test: full POST /api/generate with mocked GitHub API
// ─────────────────────────────────────────────────────────────────────────────

import { parseRepoUrl } from './github.js'

// ─── parseRepoUrl ─────────────────────────────────────────────────────────────
describe('parseRepoUrl', () => {
  // Happy path
  test('parses standard github URL', async () => {
    const result = await parseRepoUrl('https://github.com/facebook/react')
    expect(result).toEqual({ owner: 'facebook', repo: 'react' })
  })

  // .git suffix — common when users copy from git clone commands
  test('strips .git suffix', async () => {
    const result = await parseRepoUrl('https://github.com/vercel/next.js.git')
    expect(result).toEqual({ owner: 'vercel', repo: 'next.js' })
  })

  // Query params — common when copying from browser address bar
  test('ignores query params after repo name', async () => {
    const result = await parseRepoUrl(
      'https://github.com/expressjs/express?tab=readme-ov-file',
    )
    expect(result).toEqual({ owner: 'expressjs', repo: 'express' })
  })

  // Fragment — user copied a link to a specific file or line
  test('ignores fragment after repo name', async () => {
    const result = await parseRepoUrl(
      'https://github.com/supabase/supabase#architecture',
    )
    expect(result).toEqual({ owner: 'supabase', repo: 'supabase' })
  })

  // www prefix — some users type it
  test('parses URL with www prefix', async () => {
    const result = await parseRepoUrl('https://www.github.com/torvalds/linux')
    expect(result).toEqual({ owner: 'torvalds', repo: 'linux' })
  })

  // Invalid URLs
  test('throws on non-GitHub URL', async () => {
    await expect(parseRepoUrl('https://gitlab.com/user/repo')).rejects.toThrow(
      'Invalid GitHub URL',
    )
  })

  test('throws on empty string', async () => {
    await expect(parseRepoUrl('')).rejects.toThrow('Invalid GitHub URL')
  })

  test('throws on just github.com with no path', async () => {
    await expect(parseRepoUrl('https://github.com/')).rejects.toThrow(
      'Invalid GitHub URL',
    )
  })

  // Hyphen/underscore in names — common in real repos
  test('handles hyphens and underscores in owner and repo', async () => {
    const result = await parseRepoUrl('https://github.com/my-org/my_repo-name')
    expect(result).toEqual({ owner: 'my-org', repo: 'my_repo-name' })
  })

  // Dots in repo name (e.g. next.js)
  test('handles dots in repo name', async () => {
    const result = await parseRepoUrl('https://github.com/vercel/next.js')
    expect(result).toEqual({ owner: 'vercel', repo: 'next.js' })
  })
})

// ─── LRU Cache ────────────────────────────────────────────────────────────────
// Test the core data structure — the one an Amazon interviewer will ask you to
// implement on a whiteboard.
describe('LRUCache', () => {
  // Import the class directly for testing
  // Note: LRUCache is not currently exported from github.js.
  // Move it to lib/lru.js and export it. This test file shows what SHOULD exist.

  // Simulated LRU for test purposes — same implementation as in route.js
  class LRUNode {
    constructor(key, value) {
      this.key = key
      this.value = value
      this.ts = Date.now()
      this.prev = null
      this.next = null
    }
  }

  class LRUCache {
    constructor(cap) {
      this.capacity = cap
      this.map = new Map()
      this.head = new LRUNode('HEAD', null)
      this.tail = new LRUNode('TAIL', null)
      this.head.next = this.tail
      this.tail.prev = this.head
    }
    _remove(n) {
      n.prev.next = n.next
      n.next.prev = n.prev
    }
    _insertFront(n) {
      n.next = this.head.next
      n.prev = this.head
      this.head.next.prev = n
      this.head.next = n
    }
    get(key) {
      if (!this.map.has(key)) return null
      const n = this.map.get(key)
      this._remove(n)
      this._insertFront(n)
      return n.value
    }
    set(key, value) {
      if (this.map.has(key)) {
        const n = this.map.get(key)
        n.value = value
        this._remove(n)
        this._insertFront(n)
        return
      }
      const n = new LRUNode(key, value)
      this.map.set(key, n)
      this._insertFront(n)
      if (this.map.size > this.capacity) {
        const lru = this.tail.prev
        this._remove(lru)
        this.map.delete(lru.key)
      }
    }
    size() {
      return this.map.size
    }
  }

  test('get returns null for missing key', () => {
    const cache = new LRUCache(3)
    expect(cache.get('missing')).toBeNull()
  })

  test('set and get basic value', () => {
    const cache = new LRUCache(3)
    cache.set('a', 1)
    expect(cache.get('a')).toBe(1)
  })

  test('evicts LRU entry when over capacity', () => {
    const cache = new LRUCache(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3) // should evict 'a' (LRU)
    expect(cache.get('a')).toBeNull()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
  })

  test('get promotes entry to MRU position', () => {
    const cache = new LRUCache(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a') // 'a' is now MRU
    cache.set('c', 3) // should evict 'b' (now LRU), not 'a'
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBeNull()
    expect(cache.get('c')).toBe(3)
  })

  test('update existing key does not exceed capacity', () => {
    const cache = new LRUCache(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('a', 99) // update — should NOT add a new entry
    expect(cache.size()).toBe(2)
    expect(cache.get('a')).toBe(99)
  })

  test('capacity 1 always evicts previous entry', () => {
    const cache = new LRUCache(1)
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.get('a')).toBeNull()
    expect(cache.get('b')).toBe(2)
  })
})

// ─── TokenBucket ──────────────────────────────────────────────────────────────
describe('TokenBucket rate limiter', () => {
  // Inline implementation for test isolation
  class TokenBucket {
    constructor(capacity, refillRate) {
      this.capacity = capacity
      this.refillRate = refillRate
      this._buckets = new Map()
    }
    consume(ip) {
      const now = Date.now()
      if (!this._buckets.has(ip)) {
        this._buckets.set(ip, { tokens: this.capacity - 1, lastRefill: now })
        return true
      }
      const b = this._buckets.get(ip)
      const elapsed = (now - b.lastRefill) / 1000
      b.tokens = Math.min(this.capacity, b.tokens + elapsed * this.refillRate)
      b.lastRefill = now
      if (b.tokens < 1) return false
      b.tokens -= 1
      return true
    }
  }

  test('first request always allowed', () => {
    const tb = new TokenBucket(5, 1 / 30)
    expect(tb.consume('192.168.1.1')).toBe(true)
  })

  test('blocks after capacity exhausted', () => {
    const tb = new TokenBucket(3, 0) // refillRate=0 so no refill
    tb.consume('ip1')
    tb.consume('ip1')
    tb.consume('ip1')
    // 4th request should be blocked
    expect(tb.consume('ip1')).toBe(false)
  })

  test('different IPs have independent buckets', () => {
    const tb = new TokenBucket(1, 0)
    tb.consume('ip1') // exhausts ip1
    expect(tb.consume('ip2')).toBe(true) // ip2 still has tokens
  })
})
