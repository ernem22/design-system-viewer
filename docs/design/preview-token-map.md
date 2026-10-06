# Preview → token map (schema v2)

Status: **proposal, waiting for owner approval** (2026-10-06). Depends on
[`token-schema-v2.md`](token-schema-v2.md); names below are v2 names without the leading `--`.

Scope: every element the Preview tab renders today (`app/src/gallery/components/*.tsx`, 105 demos in
12 sections, plus 27 screens in `screens/`). Compare renders the same bodies, so this map covers
Compare too.

## 1. Rules every element follows

1. **An element reads tier 3 for what its component owns.** That covers the colours, shape and size of its fills, borders and parts.
2. **Text uses a tier-2 text role.** For example, a button label uses `text-label-md-*`, not `ref-font-size-sm`.
3. **Layout between components uses tier-2 space and layout tokens.** Spacing *inside* a component is that component's tier-3 padding or gap.
4. **Disabled is one system-wide language.** Every control's disabled state reads tier-2 `color-bg-disabled`, `color-text-disabled`, `color-border-disabled`, `color-icon-disabled` and `opacity-disabled`. There are no per-component disabled tokens, so disabled looks the same everywhere.
5. **Focus is one system-wide language.** It uses `color-border-focus`, `focus-ring-width` and `focus-ring-offset`, around the element's own radius.
6. **Only Foundations specimens read tier 1.** Their job is to show the ramps. Every other element reading `--ref-*` is a defect.
7. **No literals and no tokens outside the schema.** v1 demos read `--x`, `--cmp-n` and dynamic names. A demo may still set a *private* layout variable, but must never read an un-schema'd design value.
8. **One component, one look per variant.** A second visual style for the same component, such as "Popover — large (shadow-xl)" or "Badge (solid)", is not shown. The schema cannot express it, so showing it would misrepresent the system.

Verdicts used below:
- **keep**: the token mapping changes, the demo stays.
- **change**: the demo is reshaped.
- **merge → X**: the demo becomes part of X.
- **remove**: the demo leaves the Preview.

## 2. Component sections

### Forms (`forms.tsx`)

| Demo | Reads (tier 3) | Also shows (tier 2) | Verdict |
|---|---|---|---|
| Button — variants | `button-{primary,secondary,ghost,danger}-{bg,bg-hover,bg-pressed,text,border}`, `button-radius`, `button-border-width` | `text-label-md-*`, focus (§1.5) | keep |
| Button — sizes | `button-height-{sm,md,lg}`, `button-padding-x-{sm,md,lg}` | `text-label-{sm,md,lg}-*` | keep |
| Button — icons & loading | `button-gap`, `button-icon-size`, `spinner-*` | `size-icon-*` | keep. Also shows icon-only buttons at each size (the icon button). |
| Input / Textarea | `input-{bg,bg-hover,text,placeholder,border,border-hover,border-focus,radius,padding-x,padding-y,border-width}`, `input-height-md` | `text-body-md-*`, `text-label-sm-*` (label) | keep |
| Input — adornments & counter | `input-icon`, `input-padding-x` | `color-text-tertiary` (counter), `space-inline-sm` | keep |
| Input — inset & success | `input-*` | — | change: keep the inset label and drop the "success" border. v2 has no input success state. Validation is shown by error only (Material, Carbon). |
| Input — themed tokens | — | — | merge → Input / Textarea. It only restated input tokens. |
| Disabled treatment | — | the disabled set (§1.4) | change: one row with every control (button, input, select, checkbox, radio, switch, slider, toggle, tabs) disabled side by side |
| Checkbox | `checkbox-*` | `text-body-md-*`, focus | keep |
| Radio Group | `radio-*` | `text-body-md-*`, focus | keep |
| Switch | `switch-*` | `text-body-md-*`, focus | keep |
| Slider | `slider-*` | focus | keep |
| Select | trigger `input-*` · content `menu-*` | `text-body-md-*` | keep |
| Toggle / Toggle Group | `toggle-*` | `text-label-md-*` | keep |

### Form + validation (`validation.tsx`)

| Demo | Reads | Also shows | Verdict |
|---|---|---|---|
| Radix Form — client validation | `input-*`, `input-border-error` | `color-text-danger`, `color-icon-danger`, `text-label-sm-*`, `text-body-sm-*` | keep |
| Password Toggle Field | `input-*`, `button-ghost-*` (reveal button) | — | keep |
| One-Time Password Field | `input-*`, `input-height-lg` | `space-inline-sm`, `text-title-md-*` (digits) | keep |

### Overlays (`overlays.tsx`)

| Demo | Reads | Also shows | Verdict |
|---|---|---|---|
| Dialog | `modal-{bg,radius,shadow,padding,scrim}`, `modal-width-md` | `text-title-md-*`, `text-body-md-*`, `motion-overlay-enter`, `z-modal` | keep. Also shows the three widths with a width switch. |
| Alert Dialog | `modal-*`, `button-danger-*` | — | keep |
| Popover | `popover-*` | `motion-overlay-enter`, `z-popover` | keep |
| Tooltip | `tooltip-*` | `text-label-sm-*`, `z-tooltip` | keep |
| Dropdown Menu | `menu-*`, `menu-item-*`, `menu-separator` | `text-body-md-*`, `color-icon-secondary`, `z-dropdown` | keep |
| Context Menu | `menu-*` | — | keep. The trigger becomes a focusable button (#127). |
| Hover Card | `popover-*` | `avatar-*` | keep |
| Popover — large (shadow-xl) | — | — | remove (§1.8) |

### Navigation (`navigation.tsx`)

| Demo | Reads | Also shows | Verdict |
|---|---|---|---|
| Menubar | bar `navigation-*` · content `menu-*` | `text-label-md-*` | keep |
| Navigation Menu | `navigation-*`, content `popover-*` | — | keep |
| Tabs | `tabs-*` | `text-label-md-*` | keep |
| Toolbar | `toolbar-*`, `toggle-*`, `separator-*` | — | keep |

### Feedback (`feedback.tsx`)

| Demo | Reads | Also shows | Verdict |
|---|---|---|---|
| Progress | `progress-*` | `text-label-sm-*` | keep |
| Toast | `toast-*`, `button-ghost-*` | `motion-enter`, `motion-exit`, `z-toast` | keep |
| Badge | `badge-{neutral,accent,danger,warning,success,info}-{bg,text}`, `badge-{height,padding-x,radius}` | `text-label-sm-*` | keep. It shows all six tones. |
| Badge (solid) | — | — | remove (§1.8) |
| Kbd | `kbd-*` | `text-code-md-*` | keep |
| State trio — empty / loading / error | — | — | remove. It duplicates Empty state, Skeleton and Callout (Status). |

### Layout (`layout.tsx`)

| Demo | Reads | Also shows | Verdict |
|---|---|---|---|
| Accordion | `accordion-*` | `text-title-sm-*`, `motion-expand` | keep |
| Collapsible | — | — | merge → Accordion (same tokens) |
| Separator | `separator-*` | — | keep |
| Avatar | `avatar-*` | `text-label-*` (initials) | change: one Avatar demo with images, initials, the five sizes (`size-avatar-*`), presence (`avatar-status-size`, `color-bg-success-bold`) and a group (`avatar-group-overlap`, `avatar-ring-*`) |
| Avatar — sizes & presence | — | — | merge → Avatar |
| App shell metrics | `appshell-*` | `space-page-margin` | change: rename it "App shell" and show a real header and sidebar, collapsed and expanded |
| Scroll Area | `scrollbar-*` | — | keep |
| Aspect Ratio (16:9) | — | — | merge → Foundations › Shape (`radius-media`). Aspect ratio is not a token. |

### Data display (`dataDisplay.tsx`)

| Demo | Reads | Also shows | Verdict |
|---|---|---|---|
| Table — interactive | `table-*`, `checkbox-*` | `text-label-sm-*` (header), `text-body-sm-*`, `z-sticky` | keep |
| Multi-select list | `list-item-*`, `checkbox-*` | — | keep |
| Card — tint wash & colored shadow | `card-*` | — | change: one Card demo with `card-padding-{sm,md,lg}`. Tint wash and coloured shadow are not v2 decisions. |
| Data list | `list-*` | `text-body-sm-*`, `color-text-secondary` | keep |
| Stat cards | `card-*` | `text-headline-sm-*`, `text-label-sm-*`, `color-text-{success,danger}` (delta) | keep |
| Stat — hero numbers | — | — | merge → Stat cards (a `display-sm` variant) |
| Type — display sizes | — | — | merge → Foundations › Type roles |
| Neutral ramp | — | — | merge → Foundations › Colour ramps |
| Code | `code-*` | `text-code-md-*` | keep |
| Quote | — | `text-body-lg-*`, `color-border-accent`, `color-text-secondary` | merge → Prose |
| Tag / Chip | `tag-*` | `text-label-sm-*` | keep |
| Timeline | `list-*`, `separator-*` | `color-icon-*`, `text-body-sm-*` | keep |

### Status & loading (`status.tsx`)

| Demo | Reads | Also shows | Verdict |
|---|---|---|---|
| Callout | `alert-{danger,warning,success,info}-*`, `alert-{radius,padding,border-width}` | `text-body-md-*`, `text-title-sm-*` | keep. It shows all four. |
| Banner (dismissible) | `alert-*`, `button-ghost-*` | — | keep |
| Empty state | `button-*` | `text-title-md-*`, `text-body-md-*`, `color-icon-secondary`, `size-icon-xl` | keep |
| Skeleton | `skeleton-*` | `motion-*` (shimmer) | keep |
| Spinner | `spinner-*` | — | keep |
| Motion — instant toggle | — | — | merge → Foundations › Motion |
| Motion — duration scale | — | — | merge → Foundations › Motion |
| File list | `list-*`, `progress-*` | — | keep |
| Blur / outline / bounce | — | — | remove (the tokens are removed in v2) |

### Navigation extras (`navExtras.tsx`)

| Demo | Reads | Also shows | Verdict |
|---|---|---|---|
| Breadcrumb | `breadcrumb-*` | `text-body-sm-*` | keep |
| Prose links | `link-*` | `color-text-link`, `color-text-link-hover`, `color-text-link-visited`, `text-body-md-*` | change: rename it "Prose". It adds a visited link, a `<mark>` (`color-bg-highlight`), a text selection (`::selection` = `color-bg-selected` + `color-text-selected`) and the merged Quote. |
| Pagination | `pagination-*` | — | keep |
| Steps | `steps-*` | `text-label-sm-*` | keep |
| Segmented control | `segmented-*`, `toggle-*` | — | keep |
| Button group | `button-*` | — | keep |
| Footer links | — | — | merge → Prose |

### Product patterns (`patterns.tsx`)

| Demo | Reads | Also shows | Verdict |
|---|---|---|---|
| Calendar / date field | `calendar-*`, `input-*`, `popover-*` | `text-label-sm-*` | keep |
| Combobox — multi-select tags | `input-*`, `menu-*`, `tag-*` | — | keep. It moves to Radix Popover + listbox (#127). |
| Number stepper | `input-*`, `button-secondary-*` | — | keep |
| Rating | `rating-*` | — | keep |
| Copy to clipboard | `code-*`, `button-ghost-*`, `tooltip-*` | — | keep |
| Inline edit | `input-*`, `button-ghost-*` | — | keep |
| Avatar group | — | — | merge → Avatar |
| Keyboard shortcuts | `kbd-*`, `table-*` | — | keep |
| Tree view | `list-item-*`, `tree-indent` | `color-icon-secondary` | keep |
| File dropzone | `dropzone-*` | `color-icon-secondary`, `text-body-sm-*` | keep |
| Chart primitives | — | — | merge → Data viz (screen) |
| Chart theme tokens | — | — | merge → Data viz (screen) |

### Utilities (`utilities.tsx`) — **remove the section**

Accessible Icon, Visually Hidden and Direction Provider render nothing a design-system user can judge,
so they preview no token. They stay as implementation rules (#127) and leave the Preview.

### Foundation tokens (`foundation.tsx`) — **replaced by Foundations specimens (§4)**

| v1 demo | Verdict |
|---|---|
| Gradient, Glow, Breakpoint scale, Responsive tokens, Composition, Modal widths + input heights | remove. Their tokens are removed in v2 or shown by components. |
| Semantic motion | merge → Foundations › Motion |
| Section rhythm + composition, Spacing scale | merge → Foundations › Space |
| Media, Shape — radius ends + medium border | merge → Foundations › Shape |
| Overlay tokens, Inverse surface + secondary accent | merge → Foundations › Surfaces & elevation |
| Accessibility — touch target minimum | merge → Foundations › Size (and Focus & keyboard, §4) |
| Iconography, Control density, Control + icon sizes | merge → Foundations › Size |
| Responsive grid + containers, Text measure | merge → Foundations › Layout |

## 3. Screens (`screens/*.tsx`)

**Rule:** a screen is a *composition test*. It renders gallery components and may read only:
- their tier-3 tokens;
- tier-2 text roles;
- tier-2 space and layout tokens.

Today most screens hand-build their parts: only 9 of 27 import a Radix part, and they carry their own CSS. Each kept screen is rebuilt from the gallery's components, so a token edit lands on screens exactly as it lands on the component.

| Keep (19) | What it proves |
|---|---|
| dashboard | cards, stats, progress, hover card, avatars |
| analytics | table, chart, segmented control |
| settings | tabs, switch, select, radio, slider, separator |
| team | table, avatar, dialog, badge |
| inbox | list, avatar, badge, toolbar |
| chat | input, avatar, popover |
| kanban | card, tag, avatar, dropdown |
| schedule | calendar, popover, tag |
| checkout | input, select, checkbox, separator, button |
| pricing | card, switch, badge, button |
| marketing | display/headline roles, button, `layout-container-*` |
| onboarding | steps, progress, input |
| login | input, checkbox, button, link |
| commandPalette | menu, kbd, input |
| upload | dropzone, progress, list |
| table | table, dropdown, dialog, pagination |
| viz | chart (absorbs Chart primitives and Chart theme tokens) |
| notifications | list, badge, toast, switch |
| emptyState | empty state, button |

| Merge (8) | Into | Why |
|---|---|---|
| signup | login (as an "Auth" screen with both modes) | the same components |
| notFound | emptyState | the same components |
| report | analytics | the same components |
| activity | notifications | timeline/list overlap |
| profile | settings | the same components |
| files | upload | the same components |
| search | commandPalette | the same components |
| billing | checkout | the same components |

## 4. Additions: what v2 needs that the Preview cannot show today

A Foundations section opens the Preview. It is the only place tier 1 is read (§1.6).

| New element | Shows |
|---|---|
| Foundations › Colour ramps | all ten `ref-color-*` families, 50–950, plus white, black and shadow |
| Foundations › Colour roles | every `color-bg-*`, `color-text-*`, `color-icon-*` and `color-border-*` role as a labelled swatch on its partner background, with the contrast ratio of each declared pair (schema §6.2). It also shows the state layer (`color-overlay-hover` and `color-overlay-pressed` over each fill). |
| Foundations › Status colours | for each status: subtle and bold fills (rest, hover, pressed), text, icon, border, on-bold text |
| Foundations › Surfaces & elevation | canvas → surface → raised → overlay, plus sunken and inverse, each with its `shadow-*`, and `color-bg-scrim` with `blur-overlay` |
| Foundations › Type roles | all 16 text roles with their family, size, line height, weight and tracking printed |
| Foundations › Space | `space-inline-*`, `space-stack-*`, `space-inset-*`, `space-section-*`, `space-gutter`, `space-page-margin` as measured boxes, next to the `ref-space-*` ramp |
| Foundations › Size | `size-control-*` (a button, input and select side by side at each size), `size-icon-*`, `size-avatar-*`, `size-touch-target-min` overlay, `icon-stroke-width` |
| Foundations › Shape | every `radius-*` role on its typical element, `border-width-*`, and the `ref-radius-*` ramp |
| Foundations › Motion | every `motion-*` transition, replayable, plus `motion-distance-*` and `motion-scale-*` |
| Foundations › Layer order | a sticky header, an open dropdown, a dialog, a toast and a tooltip open at once. This proves `z-*` is ascending and makes the order visible. |
| Foundations › Layout | `layout-container-*`, `layout-grid-columns` with `space-gutter`, `layout-measure-*` |
| Components › Focus & keyboard | every focusable control in its focus-visible state at once. It is the only way to judge the focus ring. |

After these changes the map covers every v2 name. A test enforces this: it collects every
`var(--…)` read by gallery CSS/TSX, and it fails when a v2 schema name is read nowhere, or when a
non-Foundations element reads `--ref-*`.

## 5. Net change

| | Today | After |
|---|---|---|
| Component sections | 12 sections, 105 demos (incl. 19 Foundation tokens and 3 Utilities) | 10 component sections with 66 demos: the 83 demos of the kept sections − 18 merged/removed + 1 new (Focus & keyboard); Utilities and Foundation tokens leave |
| Foundations specimens | 19 loose demos | 12 specimens |
| Screens | 27 | 19 |
| v2 names shown | — | all 735 (enforced by the test in §4) |

## 6. Issue breakdown (after approval, after schema §10 steps 1–4)

One issue per gallery file, so the issues run in parallel without file conflicts:
- forms, validation, overlays, navigation, feedback, layout, dataDisplay, status, navExtras, patterns;
- one issue for the Foundations section;
- one issue for the coverage test;
- the screens in batches of about five per issue, merged screens first.
