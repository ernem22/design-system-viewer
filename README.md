# Design System Viewer

Paste a block of CSS custom properties, get a categorized token gallery, a
live component preview, and a side-by-side diff between systems.

Live: <https://ernem22.github.io/design-system-viewer>

## Run

```bash
npm start      # http://localhost:4173  (PORT to change)
npm test
```

First `npm start` builds the `preview/` app (React + Radix, ~1 min once).
Run `npm run build` again after changing anything under `preview/`.

Systems save to `systems/<slug>.json`. On GitHub Pages (no server) the
bundled systems load from `systems/index.json`, and anything you add stays
in that browser's localStorage.

## Tabs

- **Tokens** — swatches, type specimens, spacing bars, shadow/radius cards.
  Coverage against a 141-token reference (`schema.js`), value warnings,
  contrast (WCAG), copy/edit/export.
- **Preview** — ~35 Radix primitives, extras Radix doesn't ship, and 15
  composite screens, all rendered with the active system's tokens live.
  This only reads the schema's exact names (`--color-accent`, `--space-4`, …) —
  the Tokens gallery groups any name by pattern, but a token named anything
  else renders there and nowhere else.
- **Compare** — one component across 2–4 systems side by side, or a full
  token diff table.

State (system, tab, compare selection) lives in the URL, so any view is a
shareable link.

## Layout

- `src/core/` — parsing, taxonomy, schema, contrast (no dependencies)
- `src/server/` — static server + `/api/systems`
- `src/viewer/` — the Tokens tab
- `preview/` — the React/Radix app (Preview + Compare)

## Limits

Only a `dark` theme variant is parsed (light is the default; the Preview
tab shows a dark toggle when a system ships one). Schema isn't editable
from the UI. Nothing about a system is required.
