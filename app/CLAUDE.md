# app/ — code style

React + TS + Vite sub-app, replacing repo root's `src/` and `preview/`.
Root `CLAUDE.md` still applies.

## Commands

`npm run dev|build|lint|preview` (from `app/`). No test script.

## Structure

- `gallery/registry.ts` + `gallery/components/index.ts` (`COMPONENT_ENTRIES`) — single source for rail nav + demos. No separate section-metadata files.
- `shell/` — chrome only, slot-based; `Shell` owns layout/tabs, never content.
- `systems/store.ts` — system data (+ mutations). `tokens/` — Tokens tab (`useTokensView` model + view). `tokens/tokens.css` — only token source. `lib/` — shared utils.

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

## Not yet implemented

- Compare tab is a placeholder in `App.tsx`. Tokens tab is implemented (gallery + schema + write flows: `AddSystemDialog`, `TokenDialog`, `InlineEditor` popover).
- Tokens applied via `document.documentElement.style` (`App.tsx`), not postMessage — unlike `preview/`'s iframe bridge.
- Port from `preview/`, don't import it; `preview/` stays untouched. `lib/systemStorage.ts` is unused, reserved for the Tokens port (`app/docs/tokens-port-plan.md`).
