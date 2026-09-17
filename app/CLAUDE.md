# app/ — code style

React + TS + Vite sub-app, replacing repo root's `src/` and `preview/`.
Root `CLAUDE.md` still applies.

## Commands

`npm run dev|build|lint|test|preview` (from `app/`).

## Structure

- `gallery/registry.ts` + `gallery/components/index.ts` (`COMPONENT_ENTRIES`) — single source for rail nav + demos. No separate section-metadata files.
- `shell/` — chrome only, slot-based; `Shell` owns layout/tabs, never content.
- `systems/store.ts` — system data (+ mutations). First boot loads `systems/index.json`, served/emitted by the plugin in `vite.config.ts` from repo `systems/*.json`; after any write, localStorage (`dsv.app.systems`) wins, `[]` included. `tokens/` — Tokens tab (`useTokensView` model + view). `tokens/tokens.css` — only token source. `lib/` — shared utils.

## State

No Context/Redux/Zustand. Hooks + localStorage (`useSystems`, `usePanelOpen`). Lifted to `App.tsx`, passed down as props.

## Styling

Plain CSS, co-located 1:1 per component. No CSS modules/Tailwind/styled-components.
Prefixes: `dsv-*` gallery, `app-*` shell. Tokens: bare `var(--token)`, no fallbacks.

## Naming

- `IconActionButton` = stateless click; `IconToggleButton` = Radix `Toggle`.
- Gallery bodies: default export `XxxBody`. Elsewhere: named exports.
- Radix: `import * as Ns from "@radix-ui/react-x"`.

## TypeScript

Explicit `.ts`/`.tsx` import extensions required. No path aliases. `strict`; unused args prefixed `_`.
Root `src/core/*` imported untyped on purpose (`allowJs`).

## Comments

Explain why, not what.

## Notes

- Tokens applied via `document.documentElement.style` (`App.tsx`), not postMessage — unlike `preview/`'s iframe bridge. Compare columns scope tokens as inline styles; gallery portals must pass `usePortalContainer()`.
- Token inspector is Preview-only (`InCompareContext` hides it in Compare). Section token scans key by entry id (`tokensForEntry`) — never rely on `Body.name`, it's minified in builds.
- Coverage is always recomputed from CSS (`systemCoveragePercent`), never read from stored snapshots.
- Port from `preview/`, don't import it; `preview/` stays untouched. `lib/systemStorage.ts` is unused.
