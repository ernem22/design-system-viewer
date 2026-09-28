import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSystem as buildSystemJs } from '../src/core/parse.js'

// parse.js's JSDoc only lists name/css; slug/createdAt are accepted too.
const buildSystem = buildSystemJs as (input: {
  name: string
  css: string
  slug?: string
  createdAt?: string
}) => { createdAt: string; updatedAt: string }

const SYSTEMS_DIR = fileURLToPath(new URL('../systems/', import.meta.url))
const INDEX_PATH = 'systems/index.json'

// Same bundle scripts/build-static.mjs writes for the legacy Pages build:
// every repo system rebuilt from its CSS (so taxonomy/schema changes land
// without a re-save), newest first. Read fresh per request so a system
// added to systems/ shows up on the next reload in dev.
function bundledSystems(): string {
  if (!existsSync(SYSTEMS_DIR)) return '[]'
  const systems = readdirSync(SYSTEMS_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => {
      const data = JSON.parse(readFileSync(join(SYSTEMS_DIR, f), 'utf8'))
      const rebuilt = buildSystem({ name: data.name, slug: data.slug, createdAt: data.createdAt, css: data.css })
      return { ...rebuilt, updatedAt: data.updatedAt || rebuilt.updatedAt }
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return JSON.stringify(systems)
}

/** Serves (dev) and emits (build) `systems/index.json` — the first-boot
    source for systems/store.ts, replacing the old /api + static fallback. */
function systemsIndex(): Plugin {
  return {
    name: 'dsv-systems-index',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (path !== `${server.config.base}${INDEX_PATH}`) return next()
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(bundledSystems())
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: INDEX_PATH, source: bundledSystems() })
    },
  }
}

const MAX_CSS_BYTES = 2_000_000
const MAX_REDIRECTS = 5

/** A destination the proxy refuses to reach. Distinct from an upstream error
    so the route can answer 400 (a bad request) instead of 502. */
class BlockedTargetError extends Error {}

/** Loopback, private-use, link-local, CGNAT and multicast/reserved ranges —
    every address a same-origin proxy on localhost must never reach. */
function isBlockedAddress(address: string): boolean {
  const v4 = address.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b] = v4.slice(1).map(Number)
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    if (a === 169 && b === 254) return true // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a >= 224) return true // multicast + reserved
    return false
  }
  const ip = address.toLowerCase()
  if (ip === '::' || ip === '::1') return true
  if (ip.startsWith('fe80')) return true // link-local
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true // unique-local
  const mapped = ip.match(/^::ffff:(.+)$/)
  if (mapped) return isBlockedAddress(mapped[1])
  return false
}

/** Rejects a hop whose host resolves to a blocked address, so a URL (or a
    redirect) cannot reach the dev machine's private network. */
async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost')) throw new BlockedTargetError('destination not allowed')
  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new BlockedTargetError('destination not allowed')
    return
  }
  const resolved = await lookup(host, { all: true })
  if (!resolved.length) throw new Error('could not resolve host')
  for (const { address } of resolved) {
    if (isBlockedAddress(address)) throw new BlockedTargetError('destination not allowed')
  }
}

/** Reads a body up to the byte cap, cancelling the moment it goes over, so an
    upstream cannot make the dev process buffer a body larger than the limit
    before it is rejected. */
async function readCapped(upstream: Response, limit: number): Promise<string | null> {
  if (!upstream.body) return ''
  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel()
      return null
    }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}

/** Dev-server twin of the legacy server's `/api/fetch-css`
    (`src/server/server.js:97`). The app's URL import tries this route first
    (`app/src/lib/cssImport.ts`), and without it the dev server answers the
    path with the SPA's index.html — which the client reads as "no proxy" and
    falls back to a direct fetch, where every host that sends no ACAO header
    fails. Same contract as the legacy route: 400 invalid url, 502 upstream
    status / oversized body, 200 text/plain for the stylesheet.

    Hardened for a same-origin dev surface: redirects are followed by hand so
    every hop is validated, private/loopback/link-local destinations are
    refused, and the body is streamed against the byte cap instead of being
    buffered first. */
function fetchCssProxy(): Plugin {
  return {
    name: 'dsv-fetch-css-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (path !== '/api/fetch-css' || req.method !== 'GET') return next()
        const target = new URL(req.url ?? '', 'http://localhost').searchParams.get('url') ?? ''
        const json = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(body))
        }
        let parsed: URL
        try {
          parsed = new URL(target)
        } catch {
          return json(400, { error: 'invalid url' })
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
          return json(400, { error: 'only http/https urls are supported' })
        void (async () => {
          try {
            let current = parsed
            for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
              await assertPublicHost(current.hostname)
              const upstream = await fetch(current, {
                redirect: 'manual',
                headers: { 'user-agent': 'design-system-viewer', accept: 'text/css,text/plain,*/*' },
                signal: AbortSignal.timeout(15_000),
              })
              if (upstream.status >= 300 && upstream.status < 400) {
                const location = upstream.headers.get('location')
                if (!location) return json(502, { error: `upstream ${upstream.status} ${upstream.statusText}` })
                let next: URL
                try {
                  next = new URL(location, current)
                } catch {
                  return json(502, { error: 'invalid redirect' })
                }
                if (next.protocol !== 'http:' && next.protocol !== 'https:')
                  return json(400, { error: 'only http/https urls are supported' })
                current = next
                continue
              }
              if (!upstream.ok) return json(502, { error: `upstream ${upstream.status} ${upstream.statusText}` })
              const declared = Number(upstream.headers.get('content-length') ?? '')
              if (Number.isFinite(declared) && declared > MAX_CSS_BYTES) {
                await upstream.body?.cancel()
                return json(502, { error: 'stylesheet too large (max 2 MB)' })
              }
              const text = await readCapped(upstream, MAX_CSS_BYTES)
              if (text === null) return json(502, { error: 'stylesheet too large (max 2 MB)' })
              res.setHeader('content-type', 'text/plain; charset=utf-8')
              res.end(text)
              return
            }
            return json(502, { error: 'too many redirects' })
          } catch (err) {
            if (err instanceof BlockedTargetError) return json(400, { error: err.message })
            json(502, { error: err instanceof Error ? err.message : 'fetch failed' })
          }
        })()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative base: the build works from any sub-path (GitHub Pages) as-is.
  base: './',
  plugins: [react(), systemsIndex(), fetchCssProxy()],
})
