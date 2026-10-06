# Token schema v2

Status: **proposal, waiting for owner approval** (2026-10-06).
Replaces: the v1 reference in `src/core/schema.js` (54 groups, 432 names).

## Files

- **Source of truth:** [`schema-v2/schema.mjs`](schema-v2/schema.mjs) defines every name, its `$type` and its default alias. [`schema-v2/elements.mjs`](schema-v2/elements.mjs) defines what every Preview element reads. [`schema-v2/migration.mjs`](schema-v2/migration.mjs) maps every v1 name.
- **Check:** `node docs/design/schema-v2/check.mjs`. It verifies every rule in §3 and §6, and fails on any violation.
  - **What it checks against the app:** every Preview demo and screen that exists today is listed exactly once, and no listed demo is missing from the app.
  - **What it checks against v1:** every v1 name is either moved or removed.
  - **Tested:** errors were injected into a copy (a tier skip, a banned word, an unread token, a renamed demo, a broken migration target, a missing v1 name), and all of them were reported.
- **Generated, never edited by hand:**
  - [`schema-v2/tokens.md`](schema-v2/tokens.md): every name, with its type, default, the elements that read it, and the names that alias it.
  - [`schema-v2/elements.md`](schema-v2/elements.md): every Preview element and the explicit list of names it reads.
  - [`schema-v2/migration.md`](schema-v2/migration.md): every v1 name and where it goes.

Totals from the check: tier 1 = 199, tier 2 = 260, tier 3 = 283, so **742 names**, in 41 component sets. The required core is 86 names (§4).

## 1. Why v2: the structural review of v1

v1 was judged by structure only (names, grouping, coverage), not by values: a schema is given empty and the user fills the values.

| # | v1 problem | Evidence in v1 (`src/core/schema.js`) | v2 answer |
|---|---|---|---|
| R1 | A token's tier cannot be read from its name. | Raw ramps (`--color-brand-500`), roles (`--color-accent`) and component values (`--button-radius`) share one flat namespace. | §3.1: `--ref-*` is tier 1. A tier-2 name starts with a category. A tier-3 name starts with a component. |
| R2 | Several tokens do one job. | Control height: `size-control-*`, `button-height-*`, `input-height-*`. Page padding: `container-padding-*`, `grid-margin-*`, `mobile-/desktop-page-padding`, `composition-gutter`. Also `opacity-overlay` / `overlay-opacity`, `color-on-accent` / `color-text-on-accent`, `color-active-overlay` / `color-pressed-overlay`, `media-aspect-*` / `composition-aspect-*`. | §4: one token per decision. Every merge is in `migration.md`. |
| R3 | The grammar is inconsistent. | A state follows the role (`color-accent-hover`) or the property (`color-input-border-hover`). Scale suffixes are mixed (`xs…3xl`, `50…1000`, none). | §3.2: one grammar per tier, the state always last, and one scale vocabulary per group. The check enforces it. |
| R4 | Typography has no roles. | Size, weight, line height and letter spacing are separate ramps. Nothing defines "body" or "label". | 16 text roles: display, headline, title and body at lg/md/sm, label at lg/md/sm, and code-md. Each role has a size, line height, weight and tracking. |
| R5 | App-specific names are in the product schema. | `size-header-height`, `size-sidebar-width` (an app shell), `mobile-*` / `desktop-*` (a mode spelled into names), `composition-*`, `glow-*`, `gradient-*` (marketing art direction). | The app shell becomes the `appshell` component. Responsiveness becomes a mode (§6.3). Marketing effects are removed. |
| R6 | The primitive palette is incomplete. | Only the `brand` and `neutral` ramps exist. Status and chart colours have no ramp. | Ten colour families × 11 steps. |
| R7 | Semantic colour has holes. | There is one icon role (`color-icon-disabled`), a hover border only for inputs, no neutral fill for a secondary button, and no visited link, highlight or skeleton. | Property-first colour roles: bg, text, icon and border share roles and states. |
| R8 | Some tokens cannot work in CSS. | `--breakpoint-*`: `var()` is invalid inside `@media`. | Removed (§6.3). |
| R9 | The component tier is partial. | v1 has 10 component groups (button, card, navigation, badge, modal, tooltip, input, avatar, divider, overlay). | Every component the Preview renders has a tier-3 set: 41 sets. |

v1's `--heading-*` tokens live only in `app/src/tokens/tokens.css` (the viewer's own chrome). They were never part of the schema; §6.4 maps them to text roles.

## 2. What v2 guarantees

1. **One decision, one token.** The grammar alone answers "which token?".
2. **Frictionless override.** Every tier-3 name aliases a tier-2 name, and every tier-2 name aliases a tier-1 name. Changing one value moves everything that should move and nothing else.
3. **The user fills values, never names.** The schema is fixed. Names outside it are reported as *extras*.
4. **Complete from a small core.** Filling the 86 core names yields a complete working system, and any other name can then be overridden alone (§4).
5. **Machine-readable.** Every name has a DTCG `$type`: `color`, `dimension`, `fontFamily`, `fontWeight`, `number`, `duration`, `cubicBezier`, `shadow` or `transition`.

## 3. Tiers and grammar

### 3.1 Tiers

| Tier | A name starts with | It holds | Its default |
|---|---|---|---|
| 1 Reference | `ref-` | ramps and scales | none; the user fills it |
| 2 System | a category: `color` `text` `space` `size` `radius` `border-width` `shadow` `focus` `opacity` `blur` `motion` `z` `layout` `icon` | decisions by intent | a tier-1 name |
| 3 Component | a component name (see `tokens.md`) | one component's decisions | a tier-2 name |

**Root decisions.** 23 tier-2 or tier-3 names have no lower scale to alias, so they have no default and belong to the core:
- `z-*` (9);
- `layout-container-*` (4), `layout-measure-*` (3), `layout-grid-columns` (1);
- `modal-width-*` (3), `toast-width` (1);
- `appshell-sidebar-width`, `appshell-sidebar-width-collapsed` (2).

### 3.2 Grammar

```
tier 1  ref-{category}-{family?}-{step}                    ref-color-blue-600   ref-space-4
tier 2  {category}-{property?}-{role}-{emphasis?}-{state?} color-bg-accent-bold-hover   text-size-body-md
tier 3  {component}-{variant?}-{part?}-{property}-{scale|state?}
                                                           button-primary-bg-hover   menu-item-danger-text   button-height-md
```

- **Order:** property first, for colour (`color-bg-*`, `color-text-*`, `color-icon-*`, `color-border-*`) and for text (`text-size-*`, `text-weight-*`, …).
- **State words** are `hover`, `pressed`, `selected`, `checked`, `focus`, `error`, `current`, `visited` and `done`. A state word is always last. A scaled name has no state.
- **Scales:**
  - colour ramps use `50…950`;
  - space uses n × 4 px (`ref-space-4` = 16 px, plus `0-5` = 2 px);
  - everything else uses `xs sm md lg xl 2xl…`.
- **Emphasis words:** `subtle` < `regular` < `strong` for strokes, and `subtle` < (none) < `bold` for fills. `primary`, `secondary` and `tertiary` are used for text and icon hierarchy only.
- **Banned words:** `active`, `muted`, `main`, `default`.
- **`on-`** appears only in `color-text-on-*` and `color-icon-on-*`: text or icon placed on a bold fill.
- **Variant before property:** `menu-item-danger-text`, not `menu-item-text-danger`.

## 4. The default alias layer

The schema ships the names and a default for each tier-2 and tier-3 name. A default is a reference, never a literal, so the schema stays "given empty". The render order is: alias layer, then the user's CSS.

- **The core (86 names):**
  - the `neutral` and `brand` ramps (22);
  - white, black and the shadow ink (3);
  - the sans and mono families (2);
  - the font-size ramp (12), the space ramp (15) and the radius ramp (9);
  - the 23 root decisions (§3.1).
- **Coverage** is reported per tier as *set by the user*, *inherited* or *missing*. "Missing" exists only for core names.
- **The two editing paths map onto the tiers:**
  - the Preview property panel (per element) writes tier-3 names, so an edit stays with that component;
  - the Tokens screen (system-wide) writes any tier.

## 5. The schema at a glance

The complete list, with every default and every reader, is in `tokens.md`. The groups are:

- **Tier 1:**
  - colour: ramps for `neutral`, `brand`, `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `magenta`, plus constants (`white`, `black`, `shadow`, `transparent`);
  - type: font family, font size, font weight, line height, tracking;
  - shape and effects: space, radius, border width, shadow (incl. `inset`), blur, opacity, scale;
  - motion: duration, easing.
- **Tier 2:**
  - colour: `color-bg-*` (canvas, surfaces, neutral, accent and status fills with hover and pressed, selection, disabled, input, scrim, skeleton, highlight), `color-text-*`, `color-icon-*`, `color-border-*`, `color-overlay-hover`/`-pressed` (state layers) and `color-chart-*`;
  - text roles;
  - space: inline, stack, inset, gutter, page margin, section;
  - size: control `xs`–`lg`, icon, avatar, touch target, track, indicator;
  - shape: radius roles and border-width roles;
  - effects: shadow roles, focus, opacity, blur;
  - motion, z, layout and icon stroke width.
- **Tier 3:** 41 components, from `button`, `input`, `checkbox` … to `appshell`. Each set covers the Radix parts and elements listed in `tokens.md`.

## 6. Rules (the ones marked ✓ are enforced by `check.mjs`)

1. ✓ **Strict aliasing.**
   - A tier-2 default references only tier 1, and a tier-3 default only tier 2. A default never skips or reverses a tier, and never contains a literal colour, px, rem or ms.
   - Types match (a `color` aliases a `color`).
   - A default with no reference is allowed only for a root decision.
2. ✓ **Grammar and vocabulary** as in §3.2.
3. **Responsiveness is a mode, not a name.**
   - A system redefines tier-2 or tier-3 values inside its own `@media`, for example `--space-page-margin` on narrow screens.
   - No name encodes a breakpoint. Breakpoints are system metadata, not CSS variables.
4. **The viewer follows the selected system too, through tier 2 only.** The owner's first rule is "everything is shaped by the selected design system".
   - The viewer's chrome (shell, Tokens screen, Compare chrome, dialogs) reads tier-2 names.
   - The private `--heading-*` sizes become the matching text roles.
   - The chrome keeps private `--app-*` names only for its own layout sizes (for example the rail width), which are not design decisions. A system never writes them, and coverage does not count them.
5. **Accessibility by pairs.**
   - Every `color-text-*` and `color-icon-*` role has a declared background partner. Coverage reports the contrast of the user's values for each pair: 4.5:1 for text, 3:1 for icons and large text.
   - Control boundaries and indicators must reach 3:1. That is why three fills deliberately alias border roles: `switch-track-bg` (→ `color-border-strong`), `scrollbar-thumb-bg` and `scrollbar-thumb-bg-hover` (→ `color-border-strong`, `color-border-input-hover`).
6. ✓ **One disabled language.** No tier-3 name contains `disabled`. Every control's disabled state uses `color-bg-disabled`, `color-text-disabled`, `color-border-disabled`, `color-icon-disabled` and `opacity-disabled`.
7. ✓ **No token for a non-decision.** A ghost button has no rest fill and a bold button has no separate border, so neither has a token.
8. ✓ **Complete preview.** Every name is read by at least one Preview element, and only Foundations specimens read tier 1 (see `preview-token-map.md`).
9. **Dark mode stays retired** (owner decision in #116). Rule 3's mode mechanism is where an appearance mode would live if it ever returns.

## 7. Migration of stored systems

`migration.md` lists all 432 v1 names: 292 move to a v2 name and 140 are removed, each with its reason.

- **Rename on load:** a one-shot migration renames v1 names in every stored system (`systems/*.json` and the localStorage copy). It keeps the old CSS in a `v1Css` field until the next save.
- **Removed names become extras:** they stay in the system's CSS, and Add System's Review step and the Tokens screen list them, so nothing is silently lost.

## 8. Delivery order

At every step the app keeps working. Until the last step, a **compatibility layer** defines every renamed v1 name as an alias of its v2 name, so code that still reads v1 names keeps rendering.

1. **Schema module:** v2 schema module in `src/core`, with the rules of §3 and §6 as tests.
2. **Pure functions:** the v1 → v2 migration function and the default-alias-layer generator.
3. **The app switches to v2 (three independent issues):**
   - rendering: the alias layer plus the v1 compatibility layer, on `:root` and on Compare scopes;
   - stored systems migrate on load;
   - coverage per tier and the Tokens screen's schema view.
4. **Styles move to v2 (three issues):**
   - the viewer chrome reads tier 2;
   - `gallery.css` (shared component classes) reads tier 3;
   - the Foundations section replaces Foundation tokens and Utilities.
5. **Gallery files:** one issue per gallery file applies the verdicts of `elements.md`.
6. **Screens:** `screens.css` and the 8 screen merges, then the kept screens in batches.
7. **Cleanup:** remove the compatibility layer and the v1 schema, and add the full coverage test.
