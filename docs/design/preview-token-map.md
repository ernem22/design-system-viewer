# Preview → token map (schema v2)

Status: **proposal, waiting for owner approval** (2026-10-06).
Depends on [`token-schema-v2.md`](token-schema-v2.md).

The complete map is generated:
- [`schema-v2/elements.md`](schema-v2/elements.md) lists every element with the explicit names it reads.
- [`schema-v2/tokens.md`](schema-v2/tokens.md) shows the same map from the token side: who reads each name, and which names alias it.

Both are produced by `node docs/design/schema-v2/check.mjs` from `elements.mjs`. No list in this document is typed by hand.

## 1. Rules every element follows

1. **Tier 3 for what the component owns.** An element reads its component's colours, shape and size from tier 3.
2. **Text uses a tier-2 text role.** For example, a button label reads `text-size-label-md`, `text-weight-label-md` and so on.
3. **Layout between components uses tier-2 space and layout tokens.** Spacing inside a component is its own tier-3 padding or gap.
4. **One disabled language.** Disabled uses the tier-2 disabled set (schema rule 6).
5. **One focus language.** Focus uses `color-border-focus`, `focus-ring-width` and `focus-ring-offset`, around the element's own radius.
6. **Only Foundations specimens read tier 1** ✓. Their job is to show the ramps.
7. **No literals and no names outside the schema.** v1 demos read un-schema'd names such as `--x` and `--cmp-n`. Private layout variables are allowed, but un-schema'd design values are not.
8. **One look per component variant.** A second style the schema cannot express, such as "Popover — large (shadow-xl)" or "Badge (solid)", is not shown, because it would misrepresent the system.

✓ = enforced by `check.mjs`. The check also enforces:
- every schema name is read by at least one element;
- every demo and screen in the app today is listed exactly once;
- every merge points at a live element.

## 2. What changes

Measured from the app today (`app/src/gallery/components`): **105 demos in 12 files and 27 screens**.
Of the screens, 12 import a Radix part; the rest hand-build their parts.

| | Today | After |
|---|---|---|
| Foundations | 19 demos in `foundation.tsx` (v1 token dumps) | 12 specimens, the only readers of tier 1 |
| Component demos | 83 in the 10 component files, plus 3 in `utilities.tsx` | 66: 65 kept or changed, plus the new **Focus & keyboard** |
| Merged or removed demos | — | 40: 19 in Foundation tokens, 3 in Utilities and 18 in the component files. Each has its reason or target in `elements.md`. |
| Screens | 27 | 19. 8 merge into a screen that renders the same components. |
| Schema names shown | — | all 742 ✓ |

### Foundations specimens (new)

| Specimen | Shows |
|---|---|
| Colour ramps | all ten `ref-color-*` families and the constants |
| Colour roles | every bg, text, icon and border role as a swatch on its partner background, with the contrast of each pair, plus the state layers over each fill |
| Status colours | per status: the subtle and bold fills (rest, hover, pressed), text, on-bold text, icon and border |
| Surfaces & elevation | canvas → surface → raised → overlay, plus sunken and inverse, each with its shadow, plus the scrim with its blur |
| Type roles | all 16 roles with their family, size, line height, weight and tracking |
| Space | inline, stack, inset, section, gutter and page margin as measured boxes, next to the `ref-space-*` ramp |
| Size | control `xs`–`lg` (a button, input and select side by side at each size), icon, avatar, track, indicator, the touch-target overlay, icon stroke |
| Shape | every radius role on its typical element, the border-width roles, the radius and border-width ramps |
| Effects | `opacity-disabled` and the opacity ramp |
| Motion | every transition, replayable, plus distance and scale |
| Layer order | a sticky header, a dropdown, a dialog, a toast and a tooltip open at once, which makes the ascending `z-*` order visible |
| Layout | containers, grid columns with the gutter, and text measures |

### Main reshapes of component demos

- **Forms:**
  - "Disabled treatment" becomes one row with every control disabled.
  - "Input — inset & success" drops the success border, because v2 has no input success state.
  - "Input — themed tokens" merges into "Input / Textarea".
- **Avatar:** one demo, absorbing "Avatar — sizes & presence" and "Avatar group".
- **Card:** one demo with three paddings. The tint wash and coloured shadow go.
- **Prose** (was "Prose links"): visited link, `<mark>`, `::selection`, absorbing Quote and Footer links.
- **App shell** (was "App shell metrics"): a real header and sidebar.
- **Removed:**
  - "Popover — large", "Badge (solid)", "State trio" and "Blur / outline / bounce";
  - the Utilities section, which renders nothing a design-system user can judge.

### Screens

A screen is a composition test. It reads only text roles and space and layout tokens directly. Everything else comes from the components it renders (`composes` in `elements.md`), so a token edit reaches a screen exactly as it reaches the component.

Kept (19): dashboard, analytics, settings, team, inbox, chat, kanban, schedule, checkout, pricing, marketing, onboarding, login, commandPalette, upload, table, viz, notifications, emptyState.

Merged (8):
- signup → login
- notFound → emptyState
- report → analytics
- activity → notifications
- profile → settings
- files → upload
- search → commandPalette
- billing → checkout

## 3. Issue breakdown (after schema §8 steps 1–3)

- **First, `gallery.css`.** It holds the shared component classes (`.dsv-btn`, `.dsv-menu` and others, 304 token reads), so it moves to tier 3 in one issue.
- **Then one issue per gallery file**, in parallel. The files are forms, validation, overlays, navigation, feedback, layout, dataDisplay, status, navExtras and patterns.
  - Each applies the verdicts of `elements.md` to its own `.tsx` and `.css` only.
  - None touches `gallery.css`.
- **The Foundations section** is its own issue.
- **Screens:** first `screens.css` and the 8 merges, then the kept screens in batches.
