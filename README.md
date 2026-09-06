# Design System Viewer

Standalone tool. Paste a CSS custom-property block, get a categorized
design-system gallery (swatches, type specimens, spacing bars, radius/shadow
cards, motion demos). Saved systems are written to `systems/*.json` on disk.

The viewer itself (server + gallery) is Node standard library only, no
dependencies. The **Preview** tab is a separate React + Radix app under
`preview/` with its own `package.json` — it needs a one-time build.

## Run

```bash
npm start
```

Then open http://localhost:4173 (set `PORT` to change).

First `npm start` runs `npm run build` automatically if `preview/dist` is
missing (installs `preview/` deps + builds the React app, ~1 min once). Later
starts are instant. Force a rebuild after changing `preview/` code:

```bash
npm run build
```

If the preview is not built, the **System** tab still works; the **Preview**
tab shows a "run npm run build" message.

## Use

1. **Add System** → paste bare `--token: value;` lines (no `:root` needed), name it, **Save**.
2. The parser is selector-agnostic: it collects every `--name: value;` pair in
   the blob (comments stripped, last write wins).
3. Tokens are bucketed by name against the rules in `taxonomy.js`; anything
   unrecognized lands in **Other** as a raw name/value row.
4. Files land in `systems/<slug>.json` and reload on next start.

### Coverage against the canonical set

`schema.js` holds the full corporate token reference (139 names across 21
categories). The toolbar shows `present/expected` coverage; each gallery group
lists its **missing** tokens. Partial systems are fine — nothing is enforced.

- **Add Tokens** — paste another block onto the active system. It is appended to
  the stored CSS and re-parsed, so new declarations override and fill gaps.
- **Schema** — checklist view: every reference token, ✓ present / ✗ missing, plus
  any schema-outside tokens the system defines.
- **Filter tokens** (Esc clears) — live-filters gallery / schema by token-name
  substring.
- **Click any token** (swatch, row, schema cell) to copy `--name: value;`.
- **Double-click any value** to edit it inline — Enter saves (posts a one-line
  merge), Esc cancels.
- **Value warnings** — the parser flags likely typos (unitless lengths, bad
  hex, unknown colour syntax, `var()` to an undefined token). Shown live in the
  add/merge dialog and as a collapsible row above the gallery. Never blocks a save.
- **Accessibility / Contrast** — a gallery section runs the system's own
  text/surface colour pairs through WCAG relative-luminance (the browser resolves
  `var()` / `color-mix()` / `oklch` on a hidden probe) and tags each AA / AAA / Fail.
- **CSS / JSON** — download the active system as a clean `:root { … }` stylesheet
  or its raw JSON.

Both dialogs carry **Fill template** / **Copy template**: a grouped bare skeleton with one `--token: ;` line per expected token — the full
139 for a new system, only the missing ones when adding to an existing one.
Fill in values, delete lines you don't need, save. Blank `--x: ;` lines are
ignored by the parser.

### Preview tab

A React app (`preview/`) that renders real components styled **entirely** with
the active system's tokens — they literally render in your design system.
Switching the system in the header updates the preview live (`postMessage`, no
reload). The app fetches `/api/systems`, injects the active system's raw CSS,
and every style is written against the canonical `schema.js` token names with a
neutral fallback (`preview/src/styles/fallback.css`), so partial systems still
render.

If a system defines a dark variant (`.dark` / `[data-theme="dark"]` /
`@media (prefers-color-scheme: dark)` — captured into `system.themes.dark` at
save time), a **Dark theme** toggle appears in the rail; it flips `data-theme` /
`.dark` on the root and re-injects the parsed overrides so media-only systems
switch too. A **Fonts not bundled** note lists font families the system
names but ships no `@font-face` for.

Three nav groups:

- **Components** — every stable [Radix Primitive](https://www.radix-ui.com/primitives)
  (~35): Forms, Form + validation (Radix Form, Password Toggle, OTP), Overlays,
  Navigation, Feedback, Layout, Utilities (Accessible Icon, Visually Hidden,
  Direction Provider / RTL). Behaviour, a11y and focus management come from
  Radix; the look is 100% your tokens.
- **Extras** — components Radix Primitives does *not* ship, hand-built on the
  same tokens: table, data list, stat card, code block, tag, timeline, callout,
  banner, empty state, skeleton, spinner, breadcrumb, pagination, steps,
  segmented control, button group.
- **Screens** — 15 composite layouts: Login, Signup, Pricing, Settings,
  Profile, Dashboard, Analytics, Data table, Kanban, Chat, Notifications,
  Checkout, File upload, Empty state, Command palette.

Add a component: edit `preview/src/{components,extras}.jsx` (+ styles in
`preview/src/styles/components.css`), add a screen: `preview/src/screens.jsx`,
then `npm run build`.

### Compare tab

Two modes (segmented toggle):

- **Component** — same component, every system, side by side. Pick one component
  from the dropdown and 2–4 systems; each renders in its own column. The trick:
  instead of injecting tokens on `:root`, each column is `<div style="--color-accent:…;
  (all tokens)">` — CSS custom properties inherit, so every `var()` inside
  resolves to that column's system. Component CSS is unchanged. Column
  backgrounds are each system's own `--color-bg`, so a dark system shows as a
  dark card next to a light one. (Portalled overlays — dialog/popover/menu —
  fall back to `:root` tokens, so the compare set sticks to in-place components.)
- **Token diff** — value diff table, grouped by category: `token | A | B | …`
  with colour chips, differing rows tinted, `only differences` filter, and an
  `N tokens · M different · K same` summary. A **`<name>` patch** button per non-first
  column emits a `:root { … }` block that pulls that system up to the first
  column's values for every differing / missing token — paste it into **Add Tokens**.

Compare state (systems, view, component) round-trips through the URL:
`?tab=compare&cmp=a,b&cv=diff&cc=button` — shareable. The top-level `?sys=` and
`?tab=` are shareable too.

Registry + diff table: `preview/src/compare.jsx`.

**Performance:** ~1400 DOM nodes, ~13 MB JS heap, FCP ~100–300 ms. Closed
overlays don't render their content (Radix portals mount lazily); off-screen
sections are skipped via `content-visibility: auto`. The bundle (~132 kB
gzip, one-time, `immutable`-cached) is served uncompressed by the stdlib
server — fine for localhost.

## Test

```bash
npm test
```

## Files

| File                | Role                                                        |
| ------------------- | ---------------------------------------------------------- |
| `src/server/server.js` | Static server + `/api/systems` GET/POST(+merge)/DELETE  |
| `src/core/parse.js`    | CSS blob → token pairs; `parseThemes`, `lintTokens`, `buildSystem`, `mergeSystem` |
| `src/core/taxonomy.js` | Ordered category rules + `categorize()`                 |
| `src/core/schema.js`   | Canonical token reference + `coverage()`                |
| `src/core/contrast.js` | WCAG relative-luminance ratio + the token pairs to check|
| `src/viewer/app.js`    | Modal, fetch, gallery + schema view, 3-tab shell + iframe bridge |
| `index.html`           | Markup + styles, tab strip, preview/compare iframe      |
| `preview/`             | React + Radix app: gallery (`?sys=`), compare (`?mode=compare`) |
| `scripts/build-static.mjs` | Generates `systems/index.json` for static / Pages    |

## Not yet

Editing the schema itself, enforced/required tokens, more than one theme variant
per system (only `dark` is parsed).
