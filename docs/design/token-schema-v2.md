# Token schema v2

Status: **proposal, waiting for owner approval** (2026-10-06).
Replaces: the v1 reference in `src/core/schema.js` (54 groups, 432 names).
Companion: [`preview-token-map.md`](preview-token-map.md), which maps every Preview element to the
v2 tokens it must read.

## 1. Why v2

The owner asked whether v1 would pass the review of a corporate design-system team (the bar named
was "a lead designer at Apple accepts it"). v1 was compared, by structure only and not by values,
with Material 3, Adobe Spectrum, IBM Carbon, Atlassian, Shopify Polaris and Apple's HIG / Dynamic
Type. v1's breadth is good: motion, z-index, the state colours, focus and the touch target are all
there. It fails on **structure**. The question a reviewer asks first, "which of these do I use?",
has no answer in v1.

| # | v1 problem (the rejection reason) | Evidence in v1 | v2 answer |
|---|---|---|---|
| R1 | Tiers are not readable from a name. Raw scales, semantic roles and component tokens share one flat namespace. | `--color-brand-500` (raw), `--color-accent` (role) and `--button-radius` (component) look alike. | §3: `--ref-*` = tier 1. Tier 2 starts with a category. Tier 3 starts with a component name. |
| R2 | Several tokens do one job. | Control height: `size-control-*`, `button-height-*`, `input-height-*`. Page padding: `container-padding-*`, `grid-margin-*`, `mobile/desktop-page-padding`, `composition-gutter`. Also `opacity-overlay` = `overlay-opacity`, `color-selected` ≈ `color-accent-subtle`, `color-active-overlay` ≈ `color-pressed-overlay`, `color-on-accent` = `color-text-on-accent`, `media-aspect-*` = `composition-aspect-*`. | §4: exactly one token per decision. Every merge is listed in §9. |
| R3 | The naming grammar is inconsistent. | The state sits after the role (`color-accent-hover`) or after the property (`color-input-border-hover`). Scale suffixes are mixed (`xs…3xl`, `50…1000`, none: `media-radius`, `icon-stroke-width`). | §3.2: one grammar per tier. State is always last, and every tier has one scale vocabulary. |
| R4 | Typography has no roles, only raw scales. | Size, weight, line height and tracking are unrelated ramps. Nothing says what "body" or "caption" is. | §5.2: 16 text roles (display, headline, title, body, label, code), each with size, line height, weight and tracking. This is the Material 3 / Dynamic Type model. |
| R5 | Product-agnostic and app-specific names are mixed. | `size-header-height`, `size-sidebar-width` (an app shell), `mobile-*` / `desktop-*` (a mode encoded in names), `composition-*`, `glow-*`, `gradient-hero` (marketing pages). | §8: app-shell tokens move to tier 3 (`appshell-*`). Responsiveness becomes a mode (§6, rule 3). Marketing effects are removed. |
| R6 | The primitive palette is incomplete. | There are only brand and neutral ramps. Status, chart and secondary-accent colours have no ramp to come from. | §5.1: ten colour families × 11 steps. |
| R7 | Semantic colour has holes. | There are no icon roles (one lone `color-icon-disabled`), hover border only for inputs, and no neutral or secondary fill for secondary buttons. Visited links, highlight / selection and skeleton have no role. | §5.2: a property-first colour role set (bg / text / icon / border) with the same roles and states across properties. |
| R8 | Some tokens cannot work in CSS. | `--breakpoint-*`: `var()` is invalid inside `@media`. | §6, rule 3: breakpoints leave the CSS schema. |
| R9 | The component tier is half-built. | 11 components have tokens and ~25 Radix components have none. | §5.3: every component the Preview renders has a tier-3 set. |

The v1 viewer chrome tokens (`--heading-*` in `app/src/tokens/tokens.css`) were never part of the
schema. They stay app-private (§8.3).

## 2. What v2 must guarantee

1. **One decision, one token.** A designer can always answer "which token?" from the grammar alone.
2. **Frictionless override.** Changing one token moves every element that should move, and nothing else.
   This needs strict aliasing, tier 3 → tier 2 → tier 1 (§4).
3. **A user fills values, never names.** The schema is fixed. A user may set any schema name, and
   cannot add names. Unknown names in an imported source are reported as *extras* and not kept as
   schema tokens.
4. **A small required core.** With the default alias layer (§4), filling the tier-1 core (brand and
   neutral ramps, type, space, radius) yields a complete working system. Every tier-2 or tier-3 name
   can then be overridden one by one.
5. **Machine-readable.** Every group carries a DTCG `$type` (`color`, `dimension`, `fontFamily`,
   `fontWeight`, `number`, `duration`, `cubicBezier`, `shadow`, `transition`), so a future DTCG
   import/export is a mapping, not a redesign.

## 3. Tiers and grammar

### 3.1 Tiers

| Tier | Name starts with | Holds | May reference |
|---|---|---|---|
| 1 Reference | `--ref-` | raw values: ramps and scales | nothing (literals only) |
| 2 System | a category: `color` `text` `space` `size` `radius` `border-width` `shadow` `focus` `opacity` `blur` `motion` `z` `layout` `icon` | design decisions by intent ("the canvas", "body text", "a control's radius") | tier 1 |
| 3 Component | a component name: `button` `input` `menu` … | one component's decisions | tier 2 (tier 1 only for a value tier 2 does not express) |

**Rule:** a component (Preview element, screen, or the user's own product) reads **tier 3 for
anything the component owns, tier 2 for text roles and layout spacing, and never tier 1.**

### 3.2 Grammar

```
tier 1   --ref-{category}-{family?}-{step}            --ref-color-blue-600   --ref-space-4
tier 2   --{category}-{property?}-{role}-{emphasis?}-{state?}
                                                       --color-bg-accent-bold-hover
                                                       --color-text-secondary
                                                       --text-body-md-size
tier 3   --{component}-{variant?}-{part?}-{property}-{scale|state?}
                                                       --button-primary-bg-hover
                                                       --menu-item-bg-hover
                                                       --button-height-md
```

- **State is always last.** The states are `hover`, `pressed`, `selected`, `checked`, `disabled`, `focus`, `error`, `current` and `visited`.
- **Scale and state never appear together.** A scaled token (`-height-md`) has no states.
- **Scale vocabularies:**
  - Colour ramps use `50 100 200 … 900 950`.
  - Spacing uses multiples of 4 px (`--ref-space-4` = 16 px).
  - Everything else uses `xs sm md lg xl 2xl…`.
  - Each group uses exactly one vocabulary.
- **Emphasis words:** `subtle` < (none) < `bold`. Plus `primary`, `secondary`, `tertiary` for text and icon hierarchy only.
- **No synonyms.** The words `active`, `muted`, `on-…` for anything but "text/icon placed on a fill", `main` and `default` are not used, except `border-default` (the unmarked border).

## 4. The default alias layer

The schema ships two things:
- the names;
- a **default alias map**: every tier-2 name → a tier-1 name, and every tier-3 name → a tier-2 name.

The map contains references, never literal values, so the schema stays "given empty".

When a system is rendered, the order is: alias layer → the user's CSS. So:
- a user who sets only `--ref-color-brand-*` gets an accent-coloured primary button, link, focus ring, selected row and chart series 1;
- a user who also sets `--button-primary-bg` changes the primary button only.

Coverage is reported per tier as **set by the user / inherited through an alias / missing**. "Missing" only exists in tier 1, because tiers 2 and 3 always inherit.

The viewer has two editing paths, and they map onto the tiers:
- **Preview property panel (per element):** writes tier-3 names. The edit stays with that element's component.
- **Tokens screen (system-wide):** writes any tier, and usually tiers 1 and 2.

## 5. The v2 schema

Counts: tier 1 = 190, tier 2 = 255, tier 3 = 290, so **735 names** in total (Spectrum ships more than 1,000).
The required core is the five tier-1 groups marked ★, about 60 values.

### 5.1 Tier 1 — Reference (`--ref-`)

| Group | `$type` | Names |
|---|---|---|
| ★ Colour ramps | color | `--ref-color-{family}-{50,100,200,300,400,500,600,700,800,900,950}`. Families: ★`neutral`, ★`brand`, `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `magenta` (110 names). |
| Colour constants | color | `--ref-color-white`, `--ref-color-black`, `--ref-color-shadow` (the shadow ink) |
| ★ Font family | fontFamily | `--ref-font-family-{sans,serif,mono}` |
| ★ Font size | dimension | `--ref-font-size-{2xs,xs,sm,md,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl}` |
| Font weight | fontWeight | `--ref-font-weight-{light,regular,medium,semibold,bold}` |
| Line height | number | `--ref-line-height-{tight,snug,normal,relaxed}` |
| Tracking | dimension | `--ref-tracking-{tighter,tight,normal,wide,wider}` |
| ★ Space | dimension | `--ref-space-{0,0-5,1,2,3,4,5,6,8,10,12,16,20,24,32}` (n × 4 px; `0-5` = 2 px, the only half step) |
| ★ Radius | dimension | `--ref-radius-{none,xs,sm,md,lg,xl,2xl,3xl,full}` |
| Border width | dimension | `--ref-border-width-{0,1,2,4}` |
| Shadow | shadow | `--ref-shadow-{xs,sm,md,lg,xl,2xl}` |
| Blur | dimension | `--ref-blur-{sm,md,lg}` |
| Duration | duration | `--ref-duration-{instant,fast,moderate,slow,slower}` |
| Easing | cubicBezier | `--ref-easing-{linear,standard,decelerate,accelerate,emphasized,spring}` |

### 5.2 Tier 2 — System

The default alias appears after `→`. `{status}` = `danger warning success info`.

**Colour: background** (`--color-bg-*`, 45 names)

| Names | → default |
|---|---|
| `canvas` | neutral-50 |
| `surface` · `surface-raised` · `surface-overlay` · `surface-sunken` · `surface-inverse` | white · white · white · neutral-100 · neutral-900 |
| `neutral-subtle` · `-hover` · `-pressed` | neutral-50 · 100 · 200 |
| `neutral` · `-hover` · `-pressed` | neutral-100 · 200 · 300 |
| `neutral-bold` · `-hover` · `-pressed` | neutral-800 · 900 · 950 |
| `accent-subtle` · `-hover` · `-pressed` | brand-50 · 100 · 200 |
| `accent-bold` · `-hover` · `-pressed` | brand-600 · 700 · 800 |
| `{status}-subtle` · `{status}-bold` · `-bold-hover` · `-bold-pressed` | red / orange / green / blue: 50 · 600 · 700 · 800 |
| `selected` · `selected-hover` | brand-50 · brand-100 |
| `disabled` | neutral-100 |
| `input` · `input-hover` | white · neutral-50 |
| `scrim` | `color-mix(in srgb, var(--ref-color-shadow) 50%, transparent)` |
| `skeleton` | neutral-100 |
| `highlight` | yellow-100 |

**Colour: text** (`--color-text-*`, 21): `primary` `secondary` `tertiary` `disabled` `placeholder` `inverse` ·
`on-accent` `on-neutral-bold` `on-{status}` · `accent` `{status}` · `link` `link-hover` `link-visited` · `selected`

**Colour: icon** (`--color-icon-*`, 10): `primary` `secondary` `disabled` `inverse` `on-accent` `accent` `{status}`

**Colour: border** (`--color-border-*`, 14): `default` `subtle` `strong` `input` `input-hover` `focus`
`selected` `disabled` `inverse` `accent` `{status}`

**Colour: state layer** (2): `--color-overlay-hover`, `--color-overlay-pressed`. These are translucent
inks laid over any fill, the Material 3 state-layer model. They replace v1's `hover-` / `active-` / `pressed-overlay` trio.

**Colour: data viz** (10): `--color-chart-categorical-{1..8}`, `--color-chart-grid`, `--color-chart-axis`

**Text roles** (70). Each role has four names:
`--text-{role}-size`, `--text-{role}-line-height`, `--text-{role}-weight`, `--text-{role}-tracking`.

| Role | Sizes | For |
|---|---|---|
| `display-{lg,md,sm}` | 7xl / 6xl / 5xl | hero numbers, marketing headlines |
| `headline-{lg,md,sm}` | 4xl / 3xl / 2xl | page titles |
| `title-{lg,md,sm}` | xl / lg / md | section, card and dialog titles |
| `body-{lg,md,sm}` | lg / md / sm | running text |
| `label-{lg,md,sm}` | md / sm / xs | buttons, inputs, tabs, badges, table headers |
| `code-md` | sm | inline and block code |

Plus one family per role group: `--text-{display,headline,title,body,label,code}-font`.

**Space** (19)

| Names | For |
|---|---|
| `--space-inline-{xs,sm,md,lg}` | gaps between items on a line (icon ↔ label, chips) |
| `--space-stack-{xs,sm,md,lg,xl}` | vertical rhythm between stacked items |
| `--space-inset-{xs,sm,md,lg,xl}` | padding inside a container |
| `--space-gutter` | grid gutter |
| `--space-page-margin` | page edge padding |
| `--space-section-{sm,md,lg}` | gaps between page sections |

**Size** (14): `--size-control-{sm,md,lg}` · `--size-icon-{xs,sm,md,lg,xl}` · `--size-avatar-{xs,sm,md,lg,xl}` · `--size-touch-target-min`

**Shape** (10):
- `--radius-{control,container,overlay,modal,pill,media,indicator}`
- `--border-width-{default,strong,divider}`

**Elevation** (4): `--shadow-{raised,overlay,modal,inset}`

**Focus** (2): `--focus-ring-width`, `--focus-ring-offset`. The colour is `--color-border-focus`.

**Effects** (3): `--opacity-disabled` · `--blur-{overlay,surface}`

**Motion** (13):
- `--motion-{hover,press,enter,exit,expand,overlay-enter,overlay-exit,page}`, each a `duration easing` transition;
- `--motion-distance-{sm,md,lg}`;
- `--motion-scale-{press,enter}`.

**Z** (9), ascending: `--z-{base,raised,sticky,dropdown,overlay,modal,popover,toast,tooltip}`

**Layout** (8): `--layout-container-{sm,md,lg,xl}` · `--layout-measure-{narrow,default,wide}` · `--layout-grid-columns`

**Icon** (1): `--icon-stroke-width`

### 5.3 Tier 3 — Component

Default aliases follow the obvious tier-2 role. For example:
- `--button-primary-bg` → `--color-bg-accent-bold`;
- `--button-radius` → `--radius-control`;
- `--button-height-md` → `--size-control-md`;
- `--menu-shadow` → `--shadow-overlay`.

The full alias map ships in `schema.js`. `{v}` = variant, `{s}` = `sm md lg`, `{tone}` = `neutral accent danger warning success info`.

| Component (Radix part, if any) | Names |
|---|---|
| **button** (also icon button, button group) | `button-{primary,secondary,ghost,danger}-{bg,bg-hover,bg-pressed,text,border}` · `button-height-{s}` · `button-padding-x-{s}` · `button-radius` · `button-gap` · `button-icon-size` · `button-border-width` (30) |
| **input** (text field, textarea, password, OTP, number, select trigger, combobox) | `input-{bg,bg-hover,bg-disabled,text,placeholder,border,border-hover,border-focus,border-error,icon}` · `input-height-{s}` · `input-padding-x` · `input-padding-y` · `input-radius` · `input-border-width` (17) |
| **checkbox** | `checkbox-{size,radius,bg,bg-checked,border,border-checked,indicator}` (7) |
| **radio** | `radio-{size,dot-size,bg,bg-checked,border,border-checked,dot}` (7) |
| **switch** | `switch-{track-width,track-height,track-bg,track-bg-checked,thumb-size,thumb-bg,thumb-shadow}` (7) |
| **slider** | `slider-{track-height,track-bg,range-bg,thumb-size,thumb-bg,thumb-border}` (6) |
| **toggle** (toggle, toggle group) | `toggle-{bg,bg-hover,bg-checked,text,text-checked,radius,height}` (7) |
| **segmented** | `segmented-{bg,padding,radius}` (3). The items are toggles. |
| **tabs** | `tabs-{list-border,trigger-text,trigger-text-selected,trigger-height,trigger-padding-x,indicator-color,indicator-height,gap}` (8) |
| **menu** (dropdown, context, menubar content, select content, combobox list, command list) | `menu-{bg,border,radius,shadow,padding}` · `menu-item-{height,padding-x,radius,bg-hover,text,text-disabled,text-danger}` · `menu-separator` (13) |
| **popover** (popover, hover card) | `popover-{bg,border,radius,shadow,padding,max-width}` (6) |
| **tooltip** | `tooltip-{bg,text,radius,padding-x,padding-y,max-width}` (6) |
| **modal** (dialog, alert dialog) | `modal-{bg,radius,shadow,padding,scrim}` · `modal-width-{s}` (8) |
| **toast** | `toast-{bg,text,border,radius,shadow,padding,width}` (7) |
| **alert** (callout, banner) | `alert-{danger,warning,success,info}-{bg,text,border,icon}` · `alert-{radius,padding,border-width}` (19) |
| **badge** | `badge-{tone}-{bg,text}` · `badge-{height,padding-x,radius}` (15) |
| **tag** (chip) | `tag-{bg,bg-hover,text,border,radius,height,padding-x,remove-icon}` (8) |
| **avatar** | `avatar-{radius,bg,text,ring-width,ring-color,group-overlap,status-size}` (7) |
| **card** | `card-{bg,border,radius,shadow}` · `card-padding-{s}` (7) |
| **accordion** (accordion, collapsible) | `accordion-{trigger-height,trigger-padding-x,trigger-bg-hover,border,content-padding}` (5) |
| **separator** | `separator-{color,width}` (2) |
| **scrollbar** (scroll area) | `scrollbar-{size,thumb-bg,thumb-bg-hover,track-bg}` (4) |
| **table** | `table-{header-bg,header-text,row-bg-hover,row-bg-selected,border,cell-padding-x,cell-height}` (7) |
| **list** (data list, multi-select list, file list, tree) | `list-item-{height,padding-x,radius,bg-hover,bg-selected}` · `list-gap` · `tree-indent` (7) |
| **progress** | `progress-{track-bg,fill-bg,height,radius}` (4) |
| **skeleton** | `skeleton-{bg,highlight,radius}` (3) |
| **spinner** | `spinner-{color,track,stroke-width}` · `spinner-size-{s}` (6) |
| **breadcrumb** | `breadcrumb-{text,text-current,separator,gap}` (4) |
| **pagination** | `pagination-item-{size,radius,bg-current,text-current}` (4) |
| **steps** | `steps-{indicator-size,indicator-bg,indicator-bg-current,indicator-bg-done,connector}` (5) |
| **toolbar** | `toolbar-{bg,border,radius,padding,gap}` (5) |
| **navigation** (menubar bar, navigation menu, top nav) | `navigation-{height,padding-x,gap,item-height,item-radius,item-bg-hover,item-text,item-text-current,indicator}` (9) |
| **link** | `link-{underline-offset,underline-thickness}` (2). The colours are tier-2 `text-link*`. |
| **kbd** | `kbd-{bg,border,text,radius,padding-x,height}` (6) |
| **code** | `code-{bg,text,border,radius,padding}` (5) |
| **calendar** | `calendar-cell-{size,radius,bg-hover,bg-selected,text-selected}` · `calendar-today-border` (6) |
| **rating** | `rating-{fill,empty,size}` (3) |
| **dropzone** | `dropzone-{bg,bg-active,border,border-active,radius}` (5) |
| **chart** | `chart-tooltip-{bg,text}` · `chart-bar-radius` · `chart-line-width` (4) |
| **appshell** | `appshell-{header-height,header-bg,sidebar-width,sidebar-width-collapsed,sidebar-bg,border}` (6) |

## 6. Rules a reviewer will check

1. **Aliasing is strict.** A tier-2 default is a `var(--ref-…)`. A tier-3 default is a `var(--{tier-2})`. A test fails if any default in the alias map is a literal or skips a tier.
2. **Accessibility is defined by pairs.** Every `on-*` and text/icon role has a declared background partner. Coverage reports the contrast of the user's values for these pairs:
   - text 4.5:1;
   - large text, icons and borders of inputs and focus 3:1.

   v1's contrast check works per token. v2 checks pairs.
3. **Responsiveness is a mode, not a name.** A system may redefine any tier-2 or tier-3 value inside its own `@media` block, for example `--space-page-margin` on narrow screens. No token name encodes a breakpoint. Breakpoints are documented in the system's metadata, not as CSS variables, because `var()` is invalid in `@media`.
4. **No viewer chrome in the schema.** The viewer's own UI uses an `--app-*` namespace (§8.3). Editing a system never repaints the viewer's toolbar.
5. **Dark mode stays retired** (owner decision, #116). v2 adds no mode axis for it. Rule 3's mechanism is where a future appearance mode would live, so this is not a dead end.

## 7. What a reviewer may still question (and the answer)

- **"735 names is a lot."** A user must fill only the ★ core (about 60). Everything else inherits. Spectrum and Atlassian ship more.
- **"Text roles fix sizes, but my product needs another step."** Every role value is editable. Roles fix *meaning*, not values.
- **"Why property-first colour names (`bg/text/icon/border`) and not Material's role-first (`primary`, `on-primary`)?"** Property-first is Atlassian and Polaris practice. It makes the component mapping mechanical: a fill reads `bg-*`, its label reads `text-*`. The `on-*` pairs are kept only where the background is a bold fill.

## 8. Removed, merged and moved

### 8.1 Removed (no v2 name)

| v1 | Why |
|---|---|
| `--breakpoint-*` | cannot work in CSS (R8) |
| `--glow-*`, `--gradient-*`, `--motion-blur-*` | marketing effects, not product decisions (R5). A system may still define them as extras in its own CSS. |
| `--composition-*`, `--media-aspect-*` | aspect ratios and art-direction offsets are component props, not tokens |
| `--mobile-*`, `--desktop-*` | a mode encoded in names (R5, §6 rule 3) |
| `--opacity-{hover,active,selected,muted,overlay}` | state is the state layer (`--color-overlay-*`). The scrim is a colour. |
| `--font-display`, `--font-size-display-*` | replaced by the `display-*` text roles |
| `--line-height-{none,loose}`, `--letter-spacing-*` steps outside v2, `--text-measure-{xs,sm}` | unused extremes |
| `--space-{1-5,2-5,3-5,7,14,28,40,48,56,64,72,80,96}` | off the 4 px rhythm or above what a product spacing scale needs |
| `--border-width-medium` (1.5 px) | renders unevenly at 1× |
| `--motion-scale-exit`, `--motion-scale-hover` | `exit: 1` is a no-op. Hover scaling is not a product-wide decision. |
| `--focus-ring-radius` | a focus ring follows the radius of the element it surrounds |
| `--size-control-{xs,xl}`, `--button-height-xl`, `--card-padding-xl`, `--modal-width-xl`, `--card-border-width` | unused extremes, or a duplicate of `--border-width-default` |
| `--color-accent-secondary`, `--color-accent-secondary-subtle`, `--color-tint-subtle`, `--color-active-overlay`, `--color-selected-subtle` | duplicates (R2). A second brand colour is a tier-1 family. |

### 8.2 Renamed or merged (the migration map)

Mechanical (prefix only): `--color-brand-N` → `--ref-color-brand-N` · `--color-neutral-N` → `--ref-color-neutral-N`
(`1000` → `--ref-color-black`) · `--space-N` → `--ref-space-N` · `--radius-*` → `--ref-radius-*` ·
`--shadow-{xs…2xl}` → `--ref-shadow-*` · `--blur-*` → `--ref-blur-*` · `--font-{sans,serif,mono}` →
`--ref-font-family-*` · `--font-size-*` → `--ref-font-size-*` (`base` → `md`) ·
`--font-weight-*` → `--ref-font-weight-*` · `--letter-spacing-*` → `--ref-tracking-*`.

| v1 | v2 |
|---|---|
| `color-bg` | `color-bg-canvas` |
| `color-surface{,-raised,-overlay,-sunken,-inverse}` | `color-bg-surface{…}` |
| `color-text` · `-secondary` · `-muted` · `-disabled` · `-inverse` | `color-text-primary` · `-secondary` · `-tertiary` · `-disabled` · `-inverse` |
| `color-text-link{,-hover}` | `color-text-link{,-hover}` |
| `color-text-on-accent`, `color-on-accent` | `color-text-on-accent` (merged) |
| `color-border` · `-subtle` · `-strong` · `color-divider` | `color-border-default` · `-subtle` · `-strong` · `-subtle` (merged) |
| `color-accent` · `-hover` · `-active` | `color-bg-accent-bold` · `-hover` · `-pressed` |
| `color-accent-subtle` · `-muted` | `color-bg-accent-subtle` · `-hover` |
| `color-accent-border` · `color-accent-text` | `color-border-accent` · `color-text-accent` |
| `color-surface-disabled` · `color-border-disabled` · `color-icon-disabled` | `color-bg-disabled` · `color-border-disabled` · `color-icon-disabled` |
| `color-input-bg` · `-bg-hover` · `-bg-disabled` | `color-bg-input` · `color-bg-input-hover` · `color-bg-disabled` |
| `color-input-border` · `-border-hover` · `-border-focus` · `-border-error` | `color-border-input` · `-input-hover` · `color-border-focus` · `color-border-danger` |
| `color-input-placeholder` · `-text` · `-icon` | `color-text-placeholder` · `color-text-primary` · `color-icon-secondary` |
| `color-{status}` · `-subtle` · `-muted` · `-border` · `-text` · `color-on-{status}` | `color-bg-{status}-bold` · `-subtle` · `-bold-hover` · `color-border-{status}` · `color-text-{status}` · `color-text-on-{status}` |
| `color-focus-ring` | `color-border-focus` |
| `color-hover-overlay` · `color-pressed-overlay` | `color-overlay-hover` · `color-overlay-pressed` |
| `color-selected` | `color-bg-selected` |
| `color-scrim` · `color-shadow` | `color-bg-scrim` · `ref-color-shadow` |
| `color-chart-{1..8}` · `-grid` · `-axis` · `-tooltip-bg` | `color-chart-categorical-{1..8}` · `-grid` · `-axis` · `chart-tooltip-bg` |
| `line-height-{tight,snug,normal,relaxed}` | `ref-line-height-*` |
| `text-measure-{md,lg,xl,wide}` | `layout-measure-{narrow,default,wide}` (md→narrow, lg→default, xl/wide→wide) |
| `section-space-*` | `space-section-{sm,md,lg}` |
| `container-max-width-*` | `layout-container-{sm,md,lg,xl}` |
| `container-padding-*`, `grid-margin-*` | `space-page-margin` |
| `grid-gutter*` · `grid-columns*` | `space-gutter` · `layout-grid-columns` |
| `media-radius*` · `media-overlay*` | `radius-media` · `color-bg-scrim` |
| `size-icon-*` · `size-control-{sm,md,lg}` · `size-avatar-*` | same names |
| `size-header-height*` · `size-sidebar-width*` | `appshell-header-height` · `appshell-sidebar-width{,-collapsed}` |
| `control-padding-x-*` · `control-padding-y-*` | `button-padding-x-*` · `input-padding-y` |
| `control-radius` · `control-border-width` · `control-icon-gap` | `radius-control` · `border-width-default` · `button-gap` |
| `icon-stroke-width*` · `icon-gap-*` | `icon-stroke-width` · `space-inline-*` |
| `border-width-{none,thin,thick}` | `ref-border-width-{0,1,2}` |
| `shadow-inner` · `shadow-focus` · `shadow-outline` | `shadow-inset` · (focus ring tokens) · (focus ring tokens) |
| `duration-{instant,fast,normal,slow,slower,slowest}` | `ref-duration-{instant,fast,moderate,slow,slower,slower}` |
| `ease-{linear,in,out,in-out,emphasized,spring}` | `ref-easing-{linear,accelerate,decelerate,standard,emphasized,spring}` (`bounce`, `smooth` removed) |
| `motion-{enter,exit,hover,press,reveal,modal,page,layout}` | `motion-{enter,exit,hover,press,expand,overlay-enter,page}` (`layout` removed) |
| `motion-distance-{sm,md,lg}` · `motion-scale-{active,enter}` | same · `motion-scale-{press,enter}` |
| `z-*` | same, ascending order fixed (`raised` moves below `sticky`) |
| `focus-ring-{width,offset}` · `touch-target-min` | same · `size-touch-target-min` |
| `button-*`, `card-*`, `badge-*`, `modal-*`, `tooltip-*`, `input-*`, `avatar-*` | same names (tier 3) |
| `nav-*` · `divider-*` | `navigation-*` · `separator-*` |
| `overlay-{opacity,blur,radius}` | `color-bg-scrim` · `blur-overlay` · `radius-overlay` |

### 8.3 Viewer chrome

`--heading-section`, `--heading-subsection`, `--heading-label`, `--heading-column` and every
shell size become `--app-*`. They live in `app/src/tokens/tokens.css` only, are never written by a
system, and are not counted by coverage.

## 9. Migration of stored systems

- A one-shot migration renames v1 names in every stored system's CSS (`systems/*.json` and the localStorage copy) by §8.2. It runs on load, once per system, and keeps the old CSS in a `v1Css` field until the user saves again.
- Removed names (§8.1) stay in the system's CSS as **extras**. The Review step of Add System and the Tokens screen list them, so nothing is silently lost.
- Coverage switches to per-tier counts (§4).

## 10. Delivery order (for the issue breakdown, after approval)

1. `schema.js` v2: names, `$type`, the default alias map, and tests for strict aliasing and grammar.
2. The alias layer in rendering, the per-tier coverage and the pair-based contrast check.
3. Migration v1 → v2 of stored systems.
4. The viewer chrome moves to `--app-*`.
5. Preview elements move to their tier-3 tokens, one issue per gallery file, in parallel (see `preview-token-map.md`).
6. Preview additions and removals (see `preview-token-map.md` §4).
