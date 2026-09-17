import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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

// https://vite.dev/config/
export default defineConfig({
  // Relative base: the build works from any sub-path (GitHub Pages) as-is.
  base: './',
  plugins: [react(), systemsIndex()],
})
