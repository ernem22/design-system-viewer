# UI Element Inventory — `app/` surface

Scope: **only `app/src/**`** (React 19 + TS + Vite). `preview/` and `src/viewer/`
are frozen legacy and are ignored. Non-UI code (parsers, store, hooks without
JSX, url/state utilities) is out of scope.

**How to read**

- One row per reviewable element, with a **stable short ID** (`AT-nnn`, `MO-nnn`,
  `OR-nnn`) that later review batches reference.
- `File (:line)` cites the concrete `app/src/...` location where the element is
  defined (or its first/canonical usage when it is a CSS-classed pattern with no
  exported component).
- `Export/name` is the exported symbol, component name, or the CSS class that
  identifies the element.
- Where a thing is a decorative sub-node or an internal part of a parent, it is
  noted **under the parent** rather than given its own ID (per the
  "list it under the parent with a note" rule).
- Glass/JSX primitives that are used directly (Radix primitives styled with
  `dsv-*` classes) are listed at the atom/molecule scale; the demo that composes
  them is at the organism scale.

Kind taxonomy used: **atom** (one indivisible element), **molecule** (small
single-purpose group), **organism** (larger composed block/section).

---

## Atoms

| ID | Element | File (:line) | Export/name | Used where | Notes |
|----|---------|--------------|-------------|------------|-------|
| AT-001 | Icon | `app/src/lib/icons.tsx:184` | `Icon` (glyph set of 33: `chevronDown`, `check`, `search`, `link`, `chevronLeft/Right`, `panelLeft/Right`, `plus`, `minus`, `x`, `dots`, `bold`, `italic`, `underline`, `alignLeft/Center/Right`, `bell`, `trash`, `user`, `settings`, `eye`, `eyeOff`, `star`, `copy`, `edit`, `file`, `sliders`, `help`) | shell + gallery everywhere | One 24×24 stroke SVG; `name`/`size` props. `app-ico` class. |
| AT-002 | Button | `app/src/gallery/ui.tsx:57` | `Button` (variants `solid\|soft\|outline\|ghost\|danger`, sizes `sm\|md\|lg\|xl`) | forms, overlays, screens, compare, navExtras, patterns | `forwardRef`; `.dsv-btn`. |
| AT-003 | Icon action button | `app/src/shell/IconActionButton.tsx:12` | `IconActionButton` (default) | App topbar (copy link, add system) | Stateless `.app-iconbtn`; not a toggle. |
| AT-004 | Icon toggle button | `app/src/shell/IconToggleButton.tsx:16` | `IconToggleButton` (default) | App topbar (rail/props toggles) | Radix `Toggle`; computes `aria-pressed`/`data-state`. |
| AT-005 | Brand mark | `app/src/shell/Brand.tsx:9` | `BrandMark` | topbar brand lockup | 4-rect SVG; `.app-brand-mark`. |
| AT-006 | Token swatch | `app/src/gallery/tokenInspector.tsx:37` | `TokenSwatch` | Preview inspector rows/picker | `.dsv-token-swatch`; renders null for non-colors. |
| AT-007 | Token-count badge trigger | `app/src/gallery/tokenInspector.tsx:546` | `SectionScopeTrigger` / `TokenScopeTrigger` (:534) | Demo headers + gallery section headers | `.dsv-token-drawer-trigger`; opens the scope panel. |
| AT-008 | Ref badge | `app/src/tokens/rows.tsx:7` | `RefBadge` | token rows, schema rows, inspector | `.tok-ref` "→ref" chip; null when not a `var()` ref. |
| AT-009 | Computed value badge | `app/src/gallery/components/varVal.tsx:10` | `VarVal` | foundation, media, spacing demos | `.dsv-code-inline`; reads its own computed value. |
| AT-010 | Skip link | `app/src/shell/Shell.tsx:113` | `.app-skip-link` | shell | "Skip to main content" focus entry. |
| AT-011 | Text input | `app/src/gallery/components/forms.tsx:71` | `.dsv-input` | forms, validation, overlays, screens | Class-based (no exported component). Variants: `--inset`, `--success`, `--themed`. |
| AT-012 | Textarea | `app/src/gallery/components/forms.tsx:77` | `.dsv-textarea` | forms, validation, dialogs | Class-based. |
| AT-013 | Checkbox | `app/src/gallery/components/forms.tsx:135` | `.dsv-check` (+ `Checkbox.Indicator`) | forms, login, checkout, team, compare chip | Radix Checkbox; static span variant `.dsv-check--static` in dataDisplay. |
| AT-014 | Radio | `app/src/gallery/components/forms.tsx:164` | `.dsv-radio` (+ `.dsv-radio-indicator`) | forms, settings | Radix RadioGroup item. |
| AT-015 | Switch | `app/src/gallery/components/forms.tsx:175` | `.dsv-switch` (+ `.dsv-switch-thumb`) | forms, pricing, settings | Radix Switch. |
| AT-016 | Slider | `app/src/gallery/components/forms.tsx:189` | `.dsv-slider` (`-track`/`-range`/`-thumb`) | forms, settings, compare Basics | Radix Slider; single + range. |
| AT-017 | Select trigger | `app/src/gallery/components/forms.tsx:208` | `.dsv-select-trigger` | forms, settings, compare, SystemSwitcher (`app-sysbtn`) | Radix Select trigger. |
| AT-018 | Select item | `app/src/gallery/components/forms.tsx:220` | `.dsv-select-item` (+ `-indicator`) | forms, settings, compare | Radix Select item; check indicator. |
| AT-019 | Toggle | `app/src/gallery/components/forms.tsx:235` | `.dsv-toggle` | forms, navigation toolbar | Radix Toggle. |
| AT-020 | Toggle group | `app/src/gallery/components/forms.tsx:238` | `.dsv-toggle-group` | forms, gallery frame-width switch | Radix ToggleGroup (`single`). |
| AT-021 | Badge | `app/src/gallery/components/feedback.tsx:55` | `.dsv-badge` (+ `--success/warning/danger/info`, `-solid`, `--on-dark`) | feedback, files, team, dashboard, screens | Status pill. |
| AT-022 | Tag / removable chip | `app/src/gallery/components/dataDisplay.tsx:405` | `.dsv-tag` | dataDisplay, profile, kanban, patterns | Removable via inner button. |
| AT-023 | Avatar | `app/src/gallery/components/screens/screenBits.tsx:24` | `Avat` (`.dsv-avatar` + `.dsv-avatar-fallback`) | layout, screens | Deterministic chart-color fill + initials. Sizes `xs…xl`, `--more`. |
| AT-024 | Kbd | `app/src/gallery/components/feedback.tsx:71` | `.dsv-kbd` | feedback, patterns, command palette | Shortcut keycap. |
| AT-025 | Spinner | `app/src/gallery/components/feedback.tsx:85` | `.dsv-spinner` (+ `--sm/--xs`) | feedback, status, files, chat, buttons | Loading indicator. |
| AT-026 | Skeleton | `app/src/gallery/components/status.tsx:134` | `.dsv-skeleton` | status | Placeholder block. |
| AT-027 | Progress bar | `app/src/gallery/components/feedback.tsx:41` | `.dsv-progress` (+ `-indicator`) | feedback, files, dashboard, onboarding, upload | Radix Progress. |
| AT-028 | Separator | `app/src/gallery/components/layout.tsx:92` | `.dsv-sep` | layout, profile, dashboard, settings, checkout | Radix Separator (h/v). |
| AT-029 | Tooltip | `app/src/gallery/components/overlays.tsx:125` | `.dsv-tooltip` (+ `-arrow`) | overlays, navExtras, shell | Radix Tooltip content. |
| AT-030 | Link | `app/src/gallery/components/overlays.tsx:201` | `.dsv-link` | everywhere (inline links) | Text link. |
| AT-031 | Code (block / inline) | `app/src/gallery/components/dataDisplay.tsx:389` | `.dsv-code` / `.dsv-code-inline` | dataDisplay, patterns, tokens | `pre` block + inline `code`. |
| AT-032 | Display type role | `app/src/gallery/components/dataDisplay.tsx:292` | `.dsv-display--6xl/7xl/dxs/dsm/dmd/dlg/dxl` | dataDisplay, report, marketing, 404 | Type-scale specimens. |
| AT-033 | Lede paragraph | `app/src/gallery/components/dataDisplay.tsx:284` | `.dsv-lede` | dataDisplay, 404, marketing | Lead sentence role. |
| AT-034 | Quote | `app/src/gallery/components/dataDisplay.tsx:397` | `.dsv-quote` (+ `cite`) | dataDisplay, report, marketing | Blockquote. |
| AT-035 | Menu item | `app/src/gallery/components/overlays.tsx:144` | `.dsv-menu-item` (+ `--danger`) | overlays, table, command palette | Shared menu row; also `--highlighted`. |
| AT-036 | Menu label / shortcut / separator | `app/src/gallery/components/overlays.tsx:143`, `:145`, `:162` | `.dsv-menu-label` / `.dsv-menu-shortcut` / `.dsv-menu-sep` | overlays, command palette | Menu ornaments. |
| AT-037 | Context-menu checkbox item | `app/src/gallery/components/overlays.tsx:185` | `.dsv-menu-check` (+ indicator) | overlays | Radix ContextMenu.CheckboxItem. |
| AT-038 | Dialog close (icon button) | `app/src/gallery/components/overlays.tsx:58` | `.dsv-dialog-close` | overlays, token/sys dialogs | Overlay corner close. |
| AT-039 | Popover arrow | `app/src/gallery/components/overlays.tsx:110` | `.dsv-pop-arrow` | overlays, hover card | Radix arrow. |
| AT-040 | Screen link | `app/src/gallery/components/screens/screenBits.tsx:51` | `ScreenLink` | login, signup, upload, empty | Inline `dsv-link` variant. |
| AT-041 | Nav / menubar trigger | `app/src/gallery/components/navigation.tsx:28` | `.dsv-nav-trigger` | navigation | Menubar + NavigationMenu trigger. |
| AT-042 | Tab trigger | `app/src/gallery/components/navigation.tsx:82` | `.dsv-tabs-trigger` | navigation, settings, compare | Radix Tabs.Trigger. |
| AT-043 | Rail link row | `app/src/shell/Rail.tsx:234` | `.app-rail-link` | Preview/Tokens/Compare rails, PreviewSystems | Roving-focus, `aria-current="location"`. |
| AT-044 | Rail item count | `app/src/shell/Rail.tsx:246` | `.app-rail-item-count` | rails | Count badge on a rail row. |
| AT-045 | Avatar presence dot | `app/src/gallery/components/layout.tsx:123` | `.dsv-avatar-presence-dot` | layout | `data-tone` status dot. |
| AT-046 | Chart bar | `app/src/gallery/components/patterns.tsx:346` | `.dsv-chart-bar` (+ `--hot`) | patterns | Bar primitive. |
| AT-047 | Chart tip | `app/src/gallery/components/patterns.tsx:389` | `.dsv-chart-tip` | patterns, viz | Tooltip-style value label. |
| AT-048 | Input adornment | `app/src/gallery/components/forms.tsx:86` | `.dsv-adorn` (`--prefix`/`--suffix`) | forms, search, table toolbar | Icon/currency affix. |
| AT-049 | Input counter | `app/src/gallery/components/forms.tsx:101` | `.dsv-counter` | forms | `18/30` suffix. |
| AT-050 | Control label | `app/src/gallery/components/forms.tsx:134` | `.dsv-control-label` (+ `--disabled`) | forms, login, pricing, settings | Checkbox/switch label wrapper. |
| AT-051 | Field hint / error | `app/src/gallery/ui.tsx:85` | `.dsv-hint` (+ `--err`) | forms, compare Basics, many screens | Help/error text under a Field. |
| AT-052 | Disabled treatment box | `app/src/gallery/components/forms.tsx:119` | `.dsv-disabled-box` (+ `--dim`) | forms | Disabled-state specimen. |
| AT-053 | Stroke sample | `app/src/gallery/components/foundation.tsx:252` | `.dsv-stroke-sample` (+ `--thin/base/medium/bold`) | foundation | Icon stroke-width specimen. |
| AT-054 | Step dot / connector bar | `app/src/gallery/components/navExtras.tsx:75` | `.dsv-step .dot` / `.bar` | navExtras, onboarding, signup | Child parts of `dsv-steps` (noted under MO-016). |
| AT-055 | Ramp chip | `app/src/tokens/rows.tsx:268` | `.tok-ramp-chip` | Tokens color ramps | Swatch cell inside a ramp. |
| AT-056 | Swatch chip (grid) | `app/src/tokens/rows.tsx:128` | `.tok-chip` | Tokens color grid | Color swatch; `--val` custom prop. |
| AT-057 | Avatar "more" chip | `app/src/gallery/components/patterns.tsx:401` | `.dsv-avatar-more` | patterns, team | `+N` overflow chip. |
| AT-058 | Pulse dot | `app/src/gallery/components/screens/marketing.tsx:23` | `.dsv-pulse-dot` | marketing | Live pulse indicator. |

---

## Molecules

| ID | Element | File (:line) | Export/name | Used where | Notes |
|----|---------|--------------|-------------|------------|-------|
| MO-001 | Field (label + control + hint/error) | `app/src/gallery/ui.tsx:75` | `Field` | forms, overlays, dialogs, compare, screens | `.dsv-field`; wraps any input + `dsv-label` + `dsv-hint`. |
| MO-002 | Form field row | `app/src/gallery/components/validation.tsx:36` | `Form.Field` row (`.dsv-form-row`, `.dsv-form-message`) | validation | Radix Form label + messages + control. |
| MO-003 | Radix Form card | `app/src/gallery/components/validation.tsx:28` | `.dsv-form-card` | validation | Submit + reset specimen. |
| MO-004 | Password toggle field | `app/src/gallery/components/validation.tsx:76` | `.dsv-pwd` | validation | Input + eye toggle (Radix PasswordToggleField). |
| MO-005 | One-time password field | `app/src/gallery/components/validation.tsx:12` | `OtpDemo` (`.dsv-otp`) | validation | 6-digit group + hidden input. |
| MO-006 | Adorned input wrap | `app/src/gallery/components/forms.tsx:85` | `.dsv-input-wrap` (`--prefix`/`--suffix`) | forms, search, table toolbar, combobox | Input + adorn/counter. |
| MO-007 | Avatar presence item | `app/src/gallery/components/layout.tsx:118` | `.dsv-avatar-presence-item` | layout | Avatar + presence dot + label. |
| MO-008 | Avatar group | `app/src/gallery/components/patterns.tsx:397` | `.dsv-avatar-group` | patterns, team | Overlapping avatars + `+N`. |
| MO-009 | Stat card | `app/src/gallery/components/dataDisplay.tsx:241` | `.dsv-stat` | dataDisplay, dashboard | Key/value/delta + sparkline. |
| MO-010 | Stat hero numbers | `app/src/gallery/components/dataDisplay.tsx:267` | inline display group | dataDisplay | 4xl/3xl display + lede. |
| MO-011 | Data list | `app/src/gallery/components/dataDisplay.tsx:217` | `.dsv-datalist` | dataDisplay, billing, analytics, profile, checkout | `dl` key/value grid. |
| MO-012 | Timeline | `app/src/gallery/components/dataDisplay.tsx:423` | `.dsv-timeline` | dataDisplay, profile, activity | Node + body + when list. |
| MO-013 | Empty state | `app/src/gallery/components/status.tsx:117` | `.dsv-empty` | status, feedback, screens/empty | Glyph + title + body + CTA. |
| MO-014 | Callout | `app/src/gallery/components/status.tsx:68` | `.dsv-callout` (+ `--info/success/warning/danger`) | status, feedback, compare Badges | Icon + message (+ link). |
| MO-015 | Banner | `app/src/gallery/components/status.tsx:102` | `.dsv-banner` (+ `--on-dark`) | status, marketing | Icon + text + dismiss. |
| MO-016 | Steps | `app/src/gallery/components/navExtras.tsx:67` | `.dsv-steps` | navExtras, onboarding, signup | Dot+label+bar; `--done/--active/--center`. |
| MO-017 | Breadcrumb | `app/src/gallery/components/navExtras.tsx:20` | `.dsv-breadcrumb` | navExtras, empty | Links + chevrons + current. |
| MO-018 | Pagination | `app/src/gallery/components/navExtras.tsx:47` | `.dsv-pagination` | navExtras, search | Prev/page/next buttons. |
| MO-019 | Segmented control | `app/src/gallery/components/navExtras.tsx:84` | `.dsv-segmented` | navExtras, analytics, activity, search | `aria-pressed` button group. |
| MO-020 | Button group | `app/src/gallery/components/navExtras.tsx:100` | `.dsv-btn-group` | navExtras | Joined buttons. |
| MO-021 | Number stepper | `app/src/gallery/components/patterns.tsx:166` | `.dsv-stepper` | patterns | −/input/+. |
| MO-022 | Rating | `app/src/gallery/components/patterns.tsx:187` | `.dsv-rating` | patterns | Star buttons. |
| MO-023 | Copy-to-clipboard | `app/src/gallery/components/patterns.tsx:204` | `CopyDemo` | patterns | Inline code + copy button. |
| MO-024 | Inline edit | `app/src/gallery/components/patterns.tsx:223` | `InlineEditDemo` | patterns | Read/edit toggle. |
| MO-025 | File dropzone | `app/src/gallery/components/patterns.tsx:310` | `.dsv-dropzone` (+ `.dsv-well`) | patterns | idle/over/done states. |
| MO-026 | Chart theme block | `app/src/gallery/components/patterns.tsx:366` | `.dsv-chart-grid` / `.dsv-chart-axis` | patterns | Grid + axis + tip. |
| MO-027 | Collapsible | `app/src/gallery/components/layout.tsx:74` | `.dsv-collapsible` | layout | Radix Collapsible. |
| MO-028 | Aspect-ratio demo | `app/src/gallery/components/layout.tsx:219` | `.dsv-aspect` (+ `.dsv-illus`) | layout, marketing | 16:9 box + illustration. |
| MO-029 | Toolbar | `app/src/gallery/components/navigation.tsx:105` | `.dsv-toolbar` | navigation, utilities | Toggle group + separator + button. |
| MO-030 | Keyboard-shortcut table | `app/src/gallery/components/patterns.tsx:440` | `.dsv-kbd-table` | patterns | Label + kbd list. |
| MO-031 | Token row | `app/src/tokens/rows.tsx:52` | `TokenRow` | Tokens gallery groups | Name/value/demo columns; click=copy, dblclick=edit. |
| MO-032 | Type token row | `app/src/tokens/rows.tsx:390` | `TypeTokenRow` | Tokens font-size groups | Value cell + measured specimen. |
| MO-033 | Color ramp cell | `app/src/tokens/rows.tsx:255` | `.tok-ramp-cell` | Tokens color scales | Step/value/contrast cell. |
| MO-034 | Token row list | `app/src/tokens/rows.tsx:88` | `TokenRows` | all row renderers | `.tok-rows` listbox wrapper. |
| MO-035 | Color swatch cell | `app/src/tokens/rows.tsx:113` | `.tok-swatch` | Tokens color grid | Swatch + name + value. |
| MO-036 | Shadow stage toggle | `app/src/tokens/rows.tsx:317` | `.tok-shadowtoggle` | Tokens shadow group | Page/Light ground switch. |
| MO-037 | Coverage block | `app/src/tokens/TokensProps.tsx:148` | `.tok-props-block` + ring | Tokens right rail | SVG coverage ring + present/missing/extra. |
| MO-038 | Health block | `app/src/tokens/TokensProps.tsx:115` | `.tok-health` | Tokens right rail | Contrast/warnings/fonts/kinds summary. |
| MO-039 | Token inspector | `app/src/tokens/TokensProps.tsx:189` | `.tok-inspector` | Tokens right rail | Name/value/meta + copy + edit form. |
| MO-040 | Value warnings block | `app/src/tokens/TokensProps.tsx:232` | `.tok-props-block` + `.tok-warn-list` | Tokens right rail | Lint list. |
| MO-041 | CSS preview summary | `app/src/tokens/CssPreview.tsx:36` | `CssPreview` | TokenDialog, AddSystemDialog | Pasted count/coverage/lint details. |
| MO-042 | CSS source bar | `app/src/tokens/CssSourceBar.tsx:33` | `CssSourceBar` | TokenDialog | Upload .css + URL fetch row. |
| MO-043 | Token edit form | `app/src/tokens/InlineEditor.tsx:16` | `TokenEditForm` | Tokens inspector | Save/Cancel form. |
| MO-044 | Token edit control (popover) | `app/src/tokens/InlineEditor.tsx:100` | `TokenEditControl` | SchemaView rows | Update/Add popover. |
| MO-045 | Merge dialog actions row | `app/src/tokens/TokenDialog.tsx:91` | `.tok-dialog-row` | TokenDialog | Fill-template / copy-template. |
| MO-046 | Swap picker | `app/src/gallery/tokenInspector.tsx:54` | `SwapPicker` | Preview inspector | Kind-scoped token search list. |
| MO-047 | Value editor | `app/src/gallery/tokenInspector.tsx:122` | `ValueEditor` | Preview inspector | Color + text value edit. |
| MO-048 | Inspector token row | `app/src/gallery/tokenInspector.tsx:178` | `TokenRow` (inspector) | Preview scope panel | Swatch/name/swap/edit/undo. |
| MO-049 | Scope panel head | `app/src/gallery/tokenInspector.tsx:270` | `ScopePanelHead` | ScopePanel | Title + count + close. |
| MO-050 | Rail group | `app/src/shell/RailGroup.tsx:40` | `RailGroup` | Rail, CompareRail, PreviewSystems | Label + chevron + count header. |
| MO-051 | Section search | `app/src/shell/SectionSearch.tsx:17` | `SectionSearch` | Rail, CompareRail | `.app-rail-search`; Esc clears. |
| MO-052 | Brand lockup | `app/src/shell/Brand.tsx:20` | `Brand` (default) | topbar | Mark + wordmark + HelpDialog trigger. |
| MO-053 | Topbar override pill | `app/src/App.tsx:646` | `.app-pill` (+ `-reset`) | Preview topbar | "N edits / Reset". |
| MO-054 | Phone "More actions" popover | `app/src/shell/Shell.tsx:137` | `.app-topbar-more` | ≤480px topbar | Relocates the action cluster. |
| MO-055 | Compare system chip | `app/src/compare/CompareRail.tsx:113` | `.cmp-chip` | Compare rail | Checkbox + dot + name + pct. |
| MO-056 | Compare mode toggle | `app/src/compare/CompareView.tsx:23` | `.cmp-seg` | Compare toolbar | Component / Token diff. |
| MO-057 | Diff "Show" filter | `app/src/compare/DiffTable.tsx:164` | `.cmp-seg` (3-way) | DiffTable | Different / Missing / All. |
| MO-058 | Diff summary bar | `app/src/compare/DiffTable.tsx:156` | `.cmp-diff-bar` | DiffTable | totals + filter. |
| MO-059 | Import source tools row | `app/src/systems/AddSystemDialog.tsx:553` | `.app-import-tools` | AddSystemDialog step 1 | Upload/Fetch/Fill/More sources. |
| MO-060 | Import stepper | `app/src/systems/AddSystemDialog.tsx:647` | `.app-import-steps` | AddSystemDialog | Source → Review → Save. |
| MO-061 | Import write-mode row | `app/src/systems/AddSystemDialog.tsx:897` | `.app-import-mode` | AddSystemDialog step 3 | New / Merge / Clone. |
| MO-062 | Schema fill controls | `app/src/systems/SchemaFill.tsx:81` | `.app-fill-controls` | SchemaFill | Search + missing-only + group + expand. |
| MO-063 | Schema fill group header | `app/src/systems/SchemaFill.tsx:141` | `.app-fill-head` | SchemaFill | Caret + label + progress + missing. |
| MO-064 | Schema fill row | `app/src/systems/SchemaFill.tsx:164` | `.app-fill-row` | SchemaFill | Dot + name + input + clear. |
| MO-065 | Schema fill extras row | `app/src/systems/SchemaFill.tsx:221` | `.app-fill-extra-row` | SchemaFill | Extra name + rename/remove. |
| MO-066 | Welcome action card | `app/src/shell/Welcome.tsx:14` | `.app-welcome-card` | Welcome | Paste / upload card. |
| MO-067 | Shared-system banner actions | `app/src/shell/SharedSystemBanner.tsx:31` | `.app-shared-banner-actions` | shared link banner | Open / Add / Dismiss. |
| MO-068 | Toast | `app/src/shell/Toasts.tsx:65` | `.app-toast` (+ `-{tone}`) | app toasts | Live/leaving fade. |
| MO-069 | Schema not-used note | `app/src/preview/PreviewNotes.tsx:20` | `.dsv-font-note` | Preview | Extra-token notice. |
| MO-070 | Font-availability note | `app/src/preview/PreviewNotes.tsx:68` | `.dsv-font-note` | Preview | Missing-font notice. |
| MO-071 | Load failure notice | `app/src/preview/PreviewNotes.tsx:92` | `.dsv-err` (+ retry) | Preview | Error + Retry control. |
| MO-072 | Screen separator | `app/src/gallery/components/screens/screenBits.tsx:39` | `ScreenSep` | login | Rule + label + rule. |

---

## Organisms

| ID | Element | File (:line) | Export/name | Used where | Notes |
|----|---------|--------------|-------------|------------|-------|
| OR-001 | App shell frame | `app/src/shell/Shell.tsx:72` | `Shell` (default) | app root | Grid chrome; tabs fill slots. |
| OR-002 | Topbar | `app/src/shell/Shell.tsx:116` | `header.app-topbar` | every tab | Brand + switcher + tabs + actions. |
| OR-003 | View tab strip | `app/src/shell/Shell.tsx:128` | `Tabs.List.app-tabs` | topbar | Tokens / Preview / Compare. |
| OR-004 | Rail frame | `app/src/shell/RailFrame.tsx:15` | `RailFrame` (default) | shell | Clip + scroller + collapse state. |
| OR-005 | Props frame | `app/src/shell/PropsFrame.tsx:16` | `PropsFrame` (default) | shell | Twin of RailFrame. |
| OR-006 | Rail nav | `app/src/shell/Rail.tsx:61` | `Rail` (default) | Tokens/Preview/Compare rails | Groups + roving focus + scrollspy. |
| OR-007 | Help dialog | `app/src/shell/HelpDialog.tsx:79` | `HelpDialog` (default) | topbar brand | "How to use" steps. |
| OR-008 | Toast stack | `app/src/shell/Toasts.tsx:11` | `Toasts` | app root | Exit-fade queue. |
| OR-009 | Welcome (zero-systems) | `app/src/shell/Welcome.tsx:5` | `Welcome` | Tokens/Preview empty | Paste/upload cards. |
| OR-010 | Drag-drop overlay | `app/src/shell/Welcome.tsx:31` | `DropOverlay` | app root on drag | Full-page drop hint. |
| OR-011 | Shared-system banner | `app/src/shell/SharedSystemBanner.tsx:17` | `SharedSystemBanner` | active tab content | `?s=` share offer. |
| OR-012 | Error boundary fallback | `app/src/shell/ErrorBoundary.tsx:38` | `ErrorBoundary` (default) | around Shell | Card + Try again. |
| OR-013 | Add System dialog | `app/src/systems/AddSystemDialog.tsx:122` | `AddSystemDialog` | app root | 3-step import surface. |
| OR-014 | System switcher | `app/src/systems/SystemSwitcher.tsx:20` | `SystemSwitcher` (default) | topbar | Radix Select + coverage pct. |
| OR-015 | System actions menu | `app/src/systems/SystemMenu.tsx:27` | `SystemMenu` | topbar | Rename/Dup/Export/Delete. |
| OR-016 | Rename system dialog | `app/src/systems/SystemMenu.tsx:92` | `.sys-dialog` | SystemMenu | Name-only form. |
| OR-017 | Delete confirm | `app/src/systems/SystemMenu.tsx:133` | `.sys-dialog` (AlertDialog) | SystemMenu | Danger confirm. |
| OR-018 | Schema fill surface | `app/src/systems/SchemaFill.tsx:30` | `SchemaFill` | AddSystemDialog steps 1–2 | 54-group token fill. |
| OR-019 | Demo block | `app/src/gallery/ui.tsx:97` | `Demo` | all gallery sections | Header + token badge + row. |
| OR-020 | Gallery section | `app/src/gallery/ui.tsx:129` | `GallerySection` | Preview tab | Section head + frame toggle + body. |
| OR-021 | Screen device frame | `app/src/gallery/ui.tsx:180` | `.dsv-screen-frame` (`data-frame-width`) | Preview screen sections | Desktop/Tablet/Phone max-width. |
| OR-022 | Token scope panel | `app/src/gallery/tokenInspector.tsx:425` | `ScopePanel` | PreviewProps, PreviewScopeDialog | Inspector body + empty state. |
| OR-023 | Scope panel body | `app/src/gallery/tokenInspector.tsx:323` | `ScopePanelBody` | ScopePanel | Kind-grouped token rows. |
| OR-024 | Tokens view | `app/src/tokens/TokensView.tsx:16` | `TokensView` | Tokens tab content | Warnings + toolbar + gallery/schema. |
| OR-025 | Token toolbar | `app/src/tokens/TokenToolbar.tsx:19` | `TokenToolbar` | Tokens tab | Filter + show-missing + view switch + add. |
| OR-026 | Token group | `app/src/tokens/TokenGroup.tsx:29` | `TokenGroup` | Tokens gallery | Heading + renderer dispatch + missing. |
| OR-027 | Color grid group | `app/src/tokens/rows.tsx:108` | `ColorGrid` | Tokens color groups | Swatch grid. |
| OR-028 | Color ramp group | `app/src/tokens/rows.tsx:208` | `ColorRamp` | Tokens color scales | Gapless ramp + WCAG ratio. |
| OR-029 | Shadow group | `app/src/tokens/rows.tsx:309` | `ShadowRow` | Tokens shadow group | Stage toggle + shadow cards. |
| OR-030 | Schema view | `app/src/tokens/SchemaView.tsx:31` | `SchemaView` | Tokens schema mode | ✓/✗ checklist per reference group. |
| OR-031 | Contrast section | `app/src/tokens/ContrastSection.tsx:26` | `ContrastSection` | Tokens gallery | WCAG AA pair rows. |
| OR-032 | Add tokens dialog | `app/src/tokens/TokenDialog.tsx:21` | `TokenDialog` | TokenToolbar | Merge CSS + live preview. |
| OR-033 | Tokens props panel | `app/src/tokens/TokensProps.tsx:67` | `TokensProps` | Tokens right rail | Coverage + health + inspector + warnings. |
| OR-034 | Compare view | `app/src/compare/CompareView.tsx:17` | `CompareView` | Compare tab content | Mode toggle + columns/diff. |
| OR-035 | Compare rail | `app/src/compare/CompareRail.tsx:27` | `CompareRail` | Compare rail | Systems + option pickers. |
| OR-036 | Compare props | `app/src/compare/CompareProps.tsx:11` | `CompareProps` | Compare right rail | Selected systems + view legend. |
| OR-037 | Compare column | `app/src/compare/CompareColumn.tsx:20` | `CompareColumn` | CompareView | One system scope + header. |
| OR-038 | Diff table | `app/src/compare/DiffTable.tsx:90` | `DiffTable` | CompareView diff mode | Category tables + changed/missing marks. |
| OR-039 | Preview props | `app/src/preview/PreviewProps.tsx:58` | `PreviewProps` | Preview right rail | Docked scope panel adapter. |
| OR-040 | Preview scope dialog | `app/src/preview/PreviewProps.tsx:82` | `PreviewScopeDialog` | Preview content | Mobile overlay inspector. |
| OR-041 | Preview notes / states | `app/src/preview/PreviewNotes.tsx:110` | `PreviewNotes` | Preview content | Loading / error / schema+font notes. |
| OR-042 | Accordion | `app/src/gallery/components/layout.tsx:56` | `.dsv-accordion` | layout | FAQ disclosure. |
| OR-043 | Menubar | `app/src/gallery/components/navigation.tsx:25` | `.dsv-nav` | navigation | File/Edit/View. |
| OR-044 | Navigation menu | `app/src/gallery/components/navigation.tsx:44` | `.dsv-nav` (NavigationMenu) | navigation | Mega nav + viewport. |
| OR-045 | Tabs (component) | `app/src/gallery/components/navigation.tsx:80` | `.dsv-tabs-root` | navigation, settings, compare | Radix Tabs. |
| OR-046 | Scroll area | `app/src/gallery/components/layout.tsx:204` | `.dsv-scroll` | layout | Radix ScrollArea. |
| OR-047 | Calendar / date field | `app/src/gallery/components/patterns.tsx:20` | `.dsv-cal` | patterns | Month grid + selection. |
| OR-048 | Combobox (multi-select tags) | `app/src/gallery/components/patterns.tsx:87` | `ComboboxDemo` | patterns | Tag list + popover listbox. |
| OR-049 | Tree view | `app/src/gallery/components/patterns.tsx:285` | `.dsv-tree` | patterns | Recursive file tree. |
| OR-050 | Chart primitives | `app/src/gallery/components/patterns.tsx:339` | `ChartsDemo` | patterns | Bars + sparkline + donut. |
| OR-051 | Interactive data table | `app/src/gallery/components/dataDisplay.tsx:30` | `InteractiveTableDemo` | dataDisplay | Sort + select + density. |
| OR-052 | Dialog | `app/src/gallery/components/overlays.tsx:28` | `.dsv-modal` | overlays, screens | Radix Dialog + fields + actions. |
| OR-053 | Alert dialog | `app/src/gallery/components/overlays.tsx:68` | `.dsv-modal` (AlertDialog) | overlays | Destructive confirm. |
| OR-054 | Popover | `app/src/gallery/components/overlays.tsx:95` | `.dsv-pop` | overlays | Pointed content panel. |
| OR-055 | Dropdown menu | `app/src/gallery/components/overlays.tsx:135` | `.dsv-menu` | overlays, table | Items + submenu + separator. |
| OR-056 | Context menu | `app/src/gallery/components/overlays.tsx:172` | `.dsv-menu` (ContextMenu) | overlays | Right-click menu. |
| OR-057 | Hover card | `app/src/gallery/components/overlays.tsx:199` | `.dsv-pop` + `.dsv-hovercard` | overlays, dashboard | Profile preview on hover. |
| OR-058 | Metal/mega popover | `app/src/gallery/components/overlays.tsx:223` | `.dsv-pop--lg` | overlays | Multi-column menu. |
| OR-059 | Radix toast (demo) | `app/src/gallery/components/feedback.tsx:8` | `ToastDemo` | feedback | Provider + root + viewport. |

---

## Screens (gallery)

Each `screen-*` entry in `COMPONENT_ENTRIES` renders as one whole-page
`GallerySection` body (organism-level composite). All are listed in
`app/src/gallery/components/index.ts`; each body is the file cited.

| Entry id | Element | File (:line) | Export/name | Notes |
|----------|---------|--------------|-------------|-------|
| `screen-viz` | Data viz | `app/src/gallery/components/screens/viz.tsx:7` | `VizBody` | Bar chart + legend + axis. |
| `screen-files` | Files | `app/src/gallery/components/screens/files.tsx:12` | `FilesBody` | Storage meter + file rows w/ badges/spinners. |
| `screen-activity` | Activity log | `app/src/gallery/components/screens/activity.tsx:24` | `ActivityBody` | Segmented filter + tinted timeline. |
| `screen-404` | 404 / error | `app/src/gallery/components/screens/notFound.tsx:4` | `NotFoundBody` | Display number + recovery actions. |
| `screen-marketing` | Marketing hero | `app/src/gallery/components/screens/marketing.tsx:15` | `MarketingBody` | Hero + feature grid + logos + quote + CTA. |
| `screen-onboarding` | Onboarding wizard | `app/src/gallery/components/screens/onboarding.tsx:9` | `OnboardingBody` | Steps + progress + back/next + Field. |
| `screen-inbox` | Inbox | `app/src/gallery/components/screens/inbox.tsx:12` | `InboxBody` | List + reading pane + toolbar. |
| `screen-schedule` | Calendar / schedule | `app/src/gallery/components/screens/schedule.tsx:25` | `ScheduleBody` | Sub-nav + week grid + event badges. |
| `screen-billing` | Billing / invoice | `app/src/gallery/components/screens/billing.tsx:20` | `BillingBody` | Line-item table + totals + print. |
| `screen-search` | Search results | `app/src/gallery/components/screens/search.tsx:12` | `SearchBody` | Query bar + facets + results + pagination. |
| `screen-team` | Team management | `app/src/gallery/components/screens/team.tsx:13` | `TeamBody` | Avatar group + role table + invite dialog. |
| `screen-report` | Report / print | `app/src/gallery/components/screens/report.tsx:3` | `ReportBody` | Serif document layout. |
| `screen-login` | Login | `app/src/gallery/components/screens/login.tsx:7` | `LoginBody` | Form + checkbox + separator + button variants. |
| `screen-signup` | Signup | `app/src/gallery/components/screens/signup.tsx:8` | `SignupBody` | Step indicator + form. |
| `screen-pricing` | Pricing | `app/src/gallery/components/screens/pricing.tsx:17` | `PricingBody` | Monthly/yearly switch + plan cards. |
| `screen-settings` | Settings | `app/src/gallery/components/screens/settings.tsx:35` | `SettingsBody` | Tabs + switch/select/radio/slider rows. |
| `screen-profile` | Profile | `app/src/gallery/components/screens/profile.tsx:12` | `ProfileBody` | Avatar + data list + tags + timeline. |
| `screen-dashboard` | Dashboard | `app/src/gallery/components/screens/dashboard.tsx:19` | `DashboardBody` | Stat cards + progress + hover cards. |
| `screen-analytics` | Analytics | `app/src/gallery/components/screens/analytics.tsx:19` | `AnalyticsBody` | Bar chart + segmented + data list + table. |
| `screen-table` | Data table | `app/src/gallery/components/screens/table.tsx:22` | `TableBody` | Toolbar + search + new-invoice dialog + row menu. |
| `screen-kanban` | Kanban | `app/src/gallery/components/screens/kanban.tsx:12` | `KanbanBody` | Columns + cards + tags + avatars. |
| `screen-chat` | Chat | `app/src/gallery/components/screens/chat.tsx:6` | `ChatBody` | Header + bubbles + input bar. |
| `screen-notifications` | Notifications | `app/src/gallery/components/screens/notifications.tsx:13` | `NotificationsBody` | Tinted icon rows + timestamps. |
| `screen-checkout` | Checkout | `app/src/gallery/components/screens/checkout.tsx:7` | `CheckoutBody` | Payment form + order summary. |
| `screen-upload` | File upload | `app/src/gallery/components/screens/upload.tsx:12` | `UploadBody` | Dropzone + upload progress rows. |
| `screen-empty` | Empty state | `app/src/gallery/components/screens/emptyState.tsx:5` | `EmptyStateBody` | Breadcrumb + empty state + CTA. |
| `screen-command` | Command palette | `app/src/gallery/components/screens/commandPalette.tsx:9` | `CommandPaletteBody` | Search + grouped list + kbd. |

---

## Counts

| Kind | Count |
|------|-------|
| Atoms | 58 |
| Molecules | 72 |
| Organisms | 59 |
| Screens (gallery `screen-*`) | 27 |
| **Total reviewable elements** | **216** |

Also present but **not** separate elements (folded into their parents):
- Decorative foundation tiles (`.dsv-gradient-tile`, `.dsv-glow-tile`, `.dsv-motion-box`,
  `.dsv-media-tile`, `.dsv-overlay-tile`, `.dsv-illus-*`) — part of OR-020 the
  `foundation`/marketing/`layout` sections.
- `.dsv-shell-metrics` diagram in `layout.tsx` — a metrics specimen, part of OR-042’s
  section body.
- `SelectionSection`-style helper internals (`SwapPicker`/`ValueEditor` state) — listed
  as MO-046/MO-047.
- Pure logic modules with no UI (`systems/store.ts`, `systems/afterSave.ts`,
  `tokens/useTokensView.ts`, `tokens/tokenUtils.ts`, `tokens/useContrastRows.ts`,
  `compare/useCompareView.ts`, `compare/railFilter.ts`, `lib/*.ts`) — out of scope.

---

## Review batching suggestion

Batches of ~8–12 elements grouped by file/tab so a reviewer reads one coherent
slice per batch.

| Batch | Theme / slice | Element IDs |
|-------|---------------|-------------|
| B01 | Shell chrome (frame, topbar, tabs, skip link) | OR-001, OR-002, OR-003, AT-010 |
| B02 | Topbar actions & brand | AT-003, AT-004, AT-005, MO-052, MO-053, MO-054 |
| B03 | System switcher & menu | OR-014, OR-015, OR-016, OR-017, AT-017, AT-018 |
| B04 | Rail frame + rail nav + groups | OR-004, OR-005, OR-006, MO-050, MO-051, AT-043, AT-044 |
| B05 | Gallery primitives (shared) | AT-001, AT-002, MO-001, AT-051, OR-019, OR-020, OR-021, AT-007 |
| B06 | Form atoms | AT-011, AT-012, AT-013, AT-014, AT-015, AT-016, AT-048, AT-049, AT-050, AT-052, MO-006 |
| B07 | Form validation & fields | MO-001, MO-002, MO-003, MO-004, MO-005, AT-011 |
| B08 | Select / toggle / navigation primitives | AT-017, AT-018, AT-019, AT-020, AT-041, AT-042, OR-045, OR-043, OR-044, MO-029 |
| B09 | Overlays (dialog/menu/popover/tooltip) | OR-052, OR-053, OR-054, OR-055, OR-056, OR-057, OR-058, AT-029, AT-035, AT-036, AT-037, AT-038, AT-039 |
| B10 | Feedback & status atoms | AT-021, AT-024, AT-025, AT-026, AT-027, AT-028, MO-014, MO-015, OR-059, MO-068 |
| B11 | Status molecules & empty/drop states | MO-013, MO-014, MO-015, OR-009, OR-010, OR-011, MO-067 |
| B12 | Data display & typography | AT-023, AT-031, AT-032, AT-033, AT-034, MO-009, MO-010, MO-011, MO-012, OR-051 |
| B13 | Navigation extras mix | MO-016, MO-017, MO-018, MO-019, MO-020, AT-054 |
| B14 | Product patterns | MO-021, MO-022, MO-023, MO-024, MO-025, MO-026, MO-030, OR-047, OR-048, OR-049, OR-050 |
| B15 | Layout molecules | AT-045, MO-007, MO-008, MO-027, MO-028, OR-042, OR-046 |
| B16 | Token inspector (Preview) | OR-022, OR-023, MO-046, MO-047, MO-048, MO-049, AT-006, AT-007 |
| B17 | Preview rail/props/notes | OR-039, OR-040, OR-041, MO-069, MO-070, MO-071, OR-014* |
| B18 | Tokens toolbar & dialogs | OR-024, OR-025, OR-032, MO-041, MO-042, MO-045 |
| B19 | Tokens gallery groups & rows | OR-026, OR-027, OR-028, OR-029, MO-031, MO-032, MO-033, MO-034, MO-035, MO-036, AT-008, AT-055, AT-056 |
| B20 | Tokens schema, contrast, props | OR-030, OR-031, OR-033, MO-037, MO-038, MO-039, MO-040, MO-043, MO-044 |
| B21 | Add-system dialog (all steps) | OR-013, MO-059, MO-060, MO-061, MO-062, MO-063, MO-064, MO-065, OR-018, MO-041 |
| B22 | Compare: rail & props | OR-035, OR-036, MO-055 |
| B23 | Compare: columns & diff | OR-034, OR-037, OR-038, MO-056, MO-057, MO-058 |
| B24 | Comparison-registry mini demos (Basics) | `app/src/compare/registry.tsx` Buttons/Inputs/Controls/Sliders/Selects/Cards/Badges/Tabbed/Accord/Progressy/LoginCard (render through AT-002/011/013/014/015/016/017/021/027/028) |
| B25 | Screens — data & product pages | OR/entries `screen-viz`, `screen-dashboard`, `screen-analytics`, `screen-files`, `screen-report`, `screen-activity` |
| B26 | Screens — auth & forms | `screen-login`, `screen-signup`, `screen-onboarding`, `screen-settings`, `screen-checkout`, `screen-profile` |
| B27 | Screens — content lists | `screen-inbox`, `screen-search`, `screen-team`, `screen-notifications`, `screen-chat`, `screen-schedule` |
| B28 | Screens — commerce & misc | `screen-pricing`, `screen-billing`, `screen-table`, `screen-kanban`, `screen-upload`, `screen-empty`, `screen-command`, `screen-marketing`, `screen-404` |
| B29 | Error boundary & toasts (runtime) | OR-012, OR-008, MO-068 |

> `*` `OR-014` (SystemSwitcher) appears in both the system-switcher batch (B03) and
> the Preview batch (B17) by design: it is topbar chrome but Preview context also
> reads it. Reviewers should treat B03 as the authoritative pass.
