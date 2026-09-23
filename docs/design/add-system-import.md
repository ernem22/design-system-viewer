# Add System → Import System — design research

Status: decisions locked (§5) after a review pass with the user on 2026-09-23.
Feeds the expansion of issue #116 from a legacy-parity bug into the import redesign.
Measurements below are against `melusine` @ `5ab6bf7`.

---

## ⛔ DARK MODE IS RETIRED — DO NOT BUILD ON IT

**Dark mode is not a feature of this product. It will be removed, not extended.**

User decision, 2026-09-23. It is declared here and in every other place that still
assumes dark mode exists, because it currently costs more than it returns: every
feature that touches it grows a second use case and a second handling path, and that
handling debt destabilises the paths that already work.

Hard consequences:

- **No worker adds, fixes, extends, restores or documents dark handling.** A finding
  about dark mode is not a defect and must not become an issue.
- **The cleanup itself is deferred.** It is not part of this work and not part of the
  import card. The inventory below exists so the cleanup can find its sites later.
- **Import carries no dark affordance:** no dark reporting, no dark-block input slot,
  no dark preview, no `themes.dark` in the import model. A source's dark block is
  parsed and ignored exactly like any other non-schema CSS.

Retirement inventory (current state, recorded for the deferred cleanup — *not* a work
list):

| Site | What it is |
| --- | --- |
| `src/core/parse.js:44` `parseThemes` | buckets `.dark` / `[data-theme="dark"]` / `@media (prefers-color-scheme: dark)` into `themes.dark` |
| `app/src/systems/store.ts:30,354` | `themes.dark` on the model; `resolveSystemTokens(dark)` overlay |
| `app/src/App.tsx:63-65,74,367` | `hasDark`, the system Dark switch, the `documentElement` application |
| `app/src/tokens/useTokensView.ts:58,72,109` | dark overlay in the value map |
| `app/src/preview/PreviewProps.tsx`, `app/src/shell/shell.css`, `app/src/gallery/gallery.css`, `gallery/components/screens/*` | dark branches and styling |
| `app/src/tokens/export.ts`, `TokensView.tsx:79` | the JSON export carries `themes.dark` |
| `README.md` "Limits" | documents the dark variant + Preview toggle as a feature |
| `ORCHESTRATION.md` (UI-audit axes) | "contrast in both light and dark" as an audit axis |
| issues #115, #111, #89, #87 | assume dark is reachable or desirable (comments added) |

---

## 1. What the product does today (measured)

| Surface | Where | Behaviour |
| --- | --- | --- |
| Paste CSS | `app/src/systems/AddSystemDialog.tsx:119` | one textarea of `--token: value;` lines; the primary path |
| Upload `.css` | `app/src/tokens/CssSourceBar.tsx:34` | `readCssFile` rejects anything but `.css` (`lib/cssImport.ts:7`) |
| Fetch URL | `app/src/tokens/CssSourceBar.tsx:15` | `/api/fetch-css` dev proxy first, direct fetch fallback (`lib/cssImport.ts:96`) |
| Page-wide drop | `app/src/App.tsx:155` | `.css` only; merges into the active system, or seeds the dialog when there is none (`App.tsx:126-141`) |
| Fill full template | `AddSystemDialog.tsx:108` | dumps `templateCss()` = all 432 schema names into the textarea |
| Copy template | legacy `src/viewer/app.js` (`dlgTplCopy` listener) | **gone** in the port — the original finding in #116 |
| Open in (after save) | `AddSystemDialog.tsx:140` | which tab to land on after Save |
| Export CSS / JSON | `app/src/tokens/TokensView.tsx:77-79` | CSS via `systemToCss`, JSON = the whole `DesignSystem` object |

Schema (`src/core/schema.js`): **54 groups / 432 token names**, and `coverage()`
(`schema.js:255`) already returns `groups[].{id,label,expected,present[],missing[]}`
plus a flat `extra[]` — the exact shape a grouped fill surface needs.

Data model: a system is **CSS text plus derived data** — `slug`, `name`, `css`,
`groups` (rebuilt from CSS, never hand-edited), `coverage`, `themes.dark` (retired —
see the notice above), timestamps. Persistence: `localStorage["dsv.app.systems"]`;
first boot loads the generated `systems/index.json` (38 files in `systems/`, rebuilt
from CSS by the vite plugin in `app/vite.config.ts`). `POST /api/systems`
(`src/server/server.js:68`) writes into `systems/` — **nothing in `app/src` calls it**
(verified: no `/api/systems` hit, no `FileReader` anywhere in `app/src`).

## 2. The gap

1. **No JSON import.** JSON export exists (`TokensView.tsx:79`) but nothing reads it
   back; `readCssFile` and the drop handler both hard-reject non-`.css`.
2. **No "start from an existing system".** Legacy's Copy template is gone (#116).
3. **The schema gate is silent and total.** Preview only reads the 432 schema names
   (`CssPreview.tsx:41-49`); a real stylesheet imports with hundreds of extras and the
   user learns about it after saving, in a `<details>` under one preview line.
4. **Collision is a dead end.** `addSystem` throws `"<slug>" already exists`
   (`systems/store.ts:245`) — no rename, no merge offer, no overwrite.
5. **No identity beyond a name.** No source URL, no imported-at, no format → no
   re-sync, no way to tell two systems from the same site apart.
6. **432 names through one textarea.** The whole schema is a single paste target:
   you cannot see what you have, what you are missing, or fill one token at a time.
   Copy-paste of a 432-line block is the only path, and it is not a usable one.

## 3. Design axes

### A. Sources

| # | Source | Notes |
| --- | --- | --- |
| A1 | Paste CSS | keep — power-user path, still the fastest for a full sheet |
| A2 | `.css` file / multi-file | multi-file = ordered merge into one system |
| A3 | URL | keep; consider inlining `@import` chains |
| A4 | Our own JSON export | round-trip: `{name, slug, css, …}` |
| A5 | External token JSON | W3C DTCG, Tokens Studio, Style Dictionary — adapter per format (later) |
| A6 | Existing system (clone / template) | #116's real intent; the 38 repo systems are seed sources too |
| A7 | Clipboard | auto-detect CSS vs JSON |
| A8 | Live site scan | list a page's `<link rel=stylesheet>`s, import selected (later) |
| A9 | Repo persistence | `POST /api/systems` — import into the repo, not just the browser (later) |

### B. Parse & normalise

- **Raw CSS stays the source of truth.** Adapters and the grouped form *emit CSS*;
  `buildSystem`/`mergeSystem` remain the only write pipeline.
- **Prefix stripping**: `--ds-color-bg` → `--color-bg`, opt-in per import via a chip
  row of detected prefixes.
- **Extras**: keep + report, with near-miss suggestions (`--color-background` →
  `--color-bg`). Mapping UI later.
- **Dark blocks are ignored** (retired): a source's dark rules are ordinary non-schema
  CSS — never reported, never offered as an input.

### C. Identity & collision

Three write modes in one flow: **new system**, **merge into existing**, **clone
existing**. Slug collision offers rename (`-2`), merge, replace, cancel — never a bare
exception.

### D. Review before write

Coverage `present/432` with the missing/extra split, lint warnings (`lintTokens`),
colour swatch strip, and — in merge mode — added/overridden/unchanged counts. Partial
import is the default (bad lines dropped with a warning); zero tokens is the only hard
fail.

### E. Persistence & provenance

Additive `source: {kind, url?, filename?, importedAt}` on the system, which unlocks a
later "Refresh from source" diff. Storage stays localStorage-only in the first cut;
repo persistence (A9) is a separate card.

### F. Flow shape

Stepper inside the existing `.tok-dialog` shell: **Source → Review → Save**. Back
navigation never loses parsed text; Cancel at any step writes nothing.

### G. Schema fill surface (the 432 problem)

The schema is already grouped — 54 groups in `REFERENCE` — so the review step renders
it as **collapsible group sections** instead of one block:

- one section per group, header = `label` + `present/expected` progress + missing count
  (driven straight from `coverage().groups[]`); collapsed by default, a group with
  content or misses opens itself;
- rows inside: token name + value input, status per row (present / missing / extra /
  invalid); empty rows are never emitted as CSS;
- a **"show only missing"** filter, a name search, and a group outline to jump by
  heading — 54 headings is a navigable list, 432 rows is not;
- **per-token fill**: any single row is fillable and savable on its own, so a user can
  complete a system token by token without ever copy-pasting the template;
- kind-aware input where the group kind is known (`TokenGroupKind`: colour swatch for
  colour groups, number+unit for sizes, etc.), reusing the rows/inspector vocabulary;
- **Form ⇄ Paste toggle** over the same `css` text: the form writes lines back into
  the same string, so the paste path and the form path can be interleaved and neither
  is a second source of truth.

Shell constraint: group sections live inside the dialog's single scroll area — no
nested scrollers, no `overflow: hidden` on a layout container (`app/CLAUDE.md`).

## 4. Out of scope

- **Dark mode — retired, see the notice at the top.** Nothing in the import flow reads,
  reports, offers or stores a dark variant.
- Repo persistence (A9), external token formats (A5), live-site scan (A8),
  refresh-from-source diff, rename-mapping UI — deferred, not refused.

## 5. Decisions (locked 2026-09-23)

| # | Question | Decision |
| --- | --- | --- |
| 1 | Source scope, first cut | CSS + our own JSON export + clone-from-existing (MVP). External token formats (DTCG/Tokens Studio) later |
| 2 | Extras policy | Keep + report, with near-miss suggestions. Rename-mapping UI later |
| 3 | Write modes | All three: new / merge into existing / clone existing |
| 4 | Flow shape | 3-step stepper inside one dialog: Source → Review → Save |
| 5 | Schema fill (added by the user) | Grouped by heading, collapsible, navigable; single tokens fillable one by one; paste stays as an alternative |
| 6 | Dark mode (supersedes the earlier "report + dark slot" decision) | **Retired. Not in import: no reporting, no dark-block slot** |

## 6. Slicing

The redesign is too large for one Coder dispatch (the repo's Task Creator opens one
small, well-scoped issue per task), so it lands as an umbrella plus slices:

1. **Stepper shell** — Source → Review → Save inside the dialog, back-navigation, no
   write before Save.
2. **Sources** — JSON reader (A4) + clone/template picker (A6) + clipboard/format
   detection (A7) on top of today's CSS readers.
3. **Grouped schema fill** — the §3.G surface (collapsible groups, per-token fill,
   form⇄paste toggle, missing-only filter).
4. **Review** — coverage/extras/lint summary, prefix chips, swatches.
5. **Write modes & collision** — new / merge / clone, slug collision resolution,
   provenance field.

Slices 1–4 are one card (**#124**) on purpose: they all edit `AddSystemDialog.tsx`, and
two branches editing one file is a guaranteed conflict. Slice 5 is **#125**, held until
PR #92 merges because it must touch `App.tsx`.

## 6a. As built — #124 on `feature/116-import-stepper`

Built: `app/src/systems/AddSystemDialog.tsx` (3-step stepper), `app/src/systems/SchemaFill.tsx`
(+ `.css`), `app/src/lib/systemImport.ts`, `app/src/lib/tokenCss.ts`, with 43 new tests
(`systemImport.test.ts`, `tokenCss.test.ts`, `SchemaFill.test.tsx`,
`AddSystemDialog.import.test.tsx`).

Where the build deviates from the text above, deliberately:

| Written | Built | Why |
| --- | --- | --- |
| "collapsed by default, auto-open when a group has content or misses" | collapsed by default; groups open only when a filter (search / missing-only / group) is active, plus Expand all | an empty import has all 432 names missing, so "auto-open on misses" opens all 54 groups — the exact wall the surface exists to remove |
| "kind-aware input (colour swatch, number+unit for sizes)" | colour swatch + hex detection on `--color-*` rows only | the size groups mix units and `calc()`; a numeric widget would lie about what is valid |
| "any single row savable on its own" | a row edit writes into the shared CSS text; the write happens at Save | the dialog's contract is that nothing is written before Save; per-row persistence belongs to the Add-tokens flow (#125 territory) |
| "clipboard paste with CSS/JSON auto-detection" | auto-detection on any paste/drop into the textarea; no separate "paste from clipboard" button | the textarea is already the paste target; a second button would duplicate the browser's own paste |
| prefix chips in the Source step | same, but the step is reachable again via the stepper (Back) | the chips act on the CSS text, which lives in step 1 |

## 7. Constraints inherited from the repo

- Shell contract (`app/CLAUDE.md`): one scroll container per screen, `overflow: clip`
  not `hidden` on layout containers, sizes from tokens, no literals.
- Systems rebuilt through `buildSystem`/`mergeSystem`; `groups`/`coverage` are derived,
  never hand-edited. Coverage always recomputed from CSS.
- Plain CSS co-located 1:1 per component; no CSS modules/Tailwind; `dsv-*`/`app-*`
  prefixes; explicit `.ts`/`.tsx` import extensions; Radix via `import * as Ns`.
- Port from `preview/`, never import it.
