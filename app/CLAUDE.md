# app/ — code style

React + TS + Vite sub-app, replacing repo root's `src/` and `preview/`.
Root `CLAUDE.md` still applies.

## Commands

`npm run dev|build|lint|test|preview` (from `app/`).

## Structure

- `gallery/registry.ts` + `gallery/components/index.ts` (`COMPONENT_ENTRIES`) — single source for rail nav + demos. No separate section-metadata files.
- `shell/` — chrome only, slot-based; `Shell` owns layout/tabs, never content.
- `systems/store.ts` — system data (+ mutations). First boot loads `systems/index.json`, served/emitted by the plugin in `vite.config.ts` from repo `systems/*.json`; after any write, localStorage (`dsv.app.systems`) wins, `[]` included. `tokens/` — Tokens tab (`useTokensView` model + view). `tokens/tokens.css` — only token source. `lib/` — shared utils.

## Shell layout (contract)

The shell is the frame; tabs fill it. One rule decides every layout bug here:
**the chrome never moves, and exactly one region scrolls.**

- `shell/` owns one topbar, one rail region, one props region and one content region,
  declared once in `.app-shell`'s grid (`grid-template-areas`). A tab supplies rail
  *content* (groups) and props *content* — it never renders its own rail frame and
  never introduces a second scroll container.
- **Exactly one scroll container per screen: the content region (`.app-main`).** The
  rail and props frames may scroll inside their own frame when their content exceeds
  it; the shell itself never scrolls.
- `overflow: hidden` is banned on layout containers. It hides the scrollbar but leaves
  the element programmatically scrollable, so a fragment link or any `scrollIntoView`
  moves it — that is how a rail click shifted the whole layout by the topbar height.
  Use `overflow: clip` when a container must not scroll.
- In-app navigation targets the content scroller explicitly. `scrollIntoView` walks
  every scrollable ancestor, so it is not an in-app scroll primitive.
- Sizes resolve from the token root: the topbar height is `--app-topbar-height`, no
  literals in shell layout.

Enforced by `shell/shellContract.test.ts` (CSS invariants) and by the UI audit's shell
axis, which measures the chrome's position before and after a rail click in the running
app.

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
- Port from `preview/`, don't import it; `preview/` stays untouched.
