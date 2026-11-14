# Design System Viewer

Paste a block of CSS custom properties, get a categorized token gallery, a
live component preview, and a side-by-side diff between systems.

The app lives in `app/` (React 19 + TypeScript + Vite).

## Run

```bash
cd app
npm install
npm run dev
```

The dev server prints its URL (currently <http://localhost:5199>). Use
`localhost`, not `127.0.0.1` — Vite binds to the IPv6 loopback (`::1`).

```bash
npm test       # vitest
npm run lint
npm run build
```

Systems save to `systems/<slug>.json`. The dev server and the build emit
`systems/index.json` from those files, so a system added to `systems/` shows up
on the next reload in dev and in the next build. Anything added in the browser
stays in that browser's localStorage.

## Tabs

- **Tokens** — swatches, type specimens, spacing bars, shadow/radius cards.
  Coverage against a 432-token reference (`src/core/schema.js`), value warnings,
  contrast (WCAG), copy/edit/export.
- **Preview** — Radix primitives, extras Radix does not ship, and composite
  screens, all rendered with the active system's tokens live. This only reads the
  schema's exact names (`--color-accent`, `--space-4`, …) — the Tokens gallery
  groups any name by pattern, but a token named anything else renders there and
  nowhere else.
- **Compare** — one component across systems side by side, or a full token diff
  table.

State (system, tab, search, compare selection) lives in the URL (`?tab=`,
`?sys=`, `?q=`, `?cmp=`), so any view is a shareable link.

## Layout

- `app/` — the React/TS Vite app; see `app/CLAUDE.md` for its code style.
- `src/core/` — dependency-free parsing, taxonomy, schema and contrast. Plain JS,
  imported by `app/` (`allowJs`); it is the shared source of truth, not legacy.
- `systems/` — saved systems (`*.json`).
- `tools/orchestration/` + `ORCHESTRATION.md` — the unattended pipeline that
  develops `app/`.

## Limits

**Dark mode is retired** (user decision, 2026-09-23): it is not a feature of this
product and will not be extended — no new dark handling. The `dark` variant is
still parsed (`themes.dark`); the cleanup is deferred. Schema isn't editable from
the UI. Nothing about a system is required.
