// Canonical token reference — the "complete" corporate design-system set.
// Used only to compute coverage (present / missing / extra). It never blocks
// a save; a system may define any subset and fill gaps later via merge.

const t = (...names) => names;

const STATE_SLOTS = ["", "-subtle", "-muted", "-border", "-text"];
const stateTokens = (role) => [
  ...STATE_SLOTS.map((s) => `--color-${role}${s}`),
  `--color-on-${role}`,
];

/** @type {{ id: string, label: string, tokens: string[] }[]} */
export const REFERENCE = [
  { id: "color-surface", label: "Surface / Elevation", tokens: t(
    "--color-bg", "--color-surface", "--color-surface-raised", "--color-surface-overlay", "--color-surface-sunken",
  ) },
  { id: "color-text", label: "Text", tokens: t(
    "--color-text", "--color-text-secondary", "--color-text-muted", "--color-text-disabled", "--color-text-link", "--color-text-inverse",
  ) },
  { id: "color-border", label: "Border / Divider", tokens: t(
    "--color-border", "--color-border-subtle", "--color-border-strong", "--color-divider",
  ) },
  { id: "color-accent", label: "Accent / Brand", tokens: t(
    "--color-accent", "--color-accent-hover", "--color-accent-active", "--color-accent-subtle",
    "--color-accent-muted", "--color-accent-border", "--color-accent-text", "--color-on-accent",
  ) },
  { id: "color-interaction", label: "Interaction", tokens: t(
    "--color-focus-ring", "--color-hover-overlay", "--color-active-overlay", "--color-selected",
  ) },
  { id: "color-state", label: "Semantic State", tokens: t(
    ...stateTokens("success"), ...stateTokens("warning"), ...stateTokens("danger"), ...stateTokens("info"),
  ) },
  { id: "color-alpha", label: "Alpha / Overlay", tokens: t(
    "--color-scrim", "--color-shadow", "--color-tint-subtle",
  ) },
  { id: "font-family", label: "Font Family", tokens: t("--font-sans", "--font-serif", "--font-mono") },
  { id: "font-size", label: "Font Size", tokens: t(
    "--font-size-xs", "--font-size-sm", "--font-size-base", "--font-size-lg", "--font-size-xl",
    "--font-size-2xl", "--font-size-3xl", "--font-size-4xl", "--font-size-5xl",
  ) },
  { id: "font-weight", label: "Font Weight", tokens: t(
    "--font-weight-regular", "--font-weight-medium", "--font-weight-semibold", "--font-weight-bold",
  ) },
  { id: "line-height", label: "Line Height", tokens: t(
    "--line-height-tight", "--line-height-snug", "--line-height-normal", "--line-height-relaxed",
  ) },
  { id: "letter-spacing", label: "Letter Spacing", tokens: t(
    "--letter-spacing-tight", "--letter-spacing-normal", "--letter-spacing-wide",
  ) },
  { id: "spacing", label: "Spacing", tokens: t(
    "--space-0", "--space-px", "--space-0-5", "--space-1", "--space-2", "--space-3", "--space-4",
    "--space-5", "--space-6", "--space-8", "--space-10", "--space-12", "--space-16", "--space-20", "--space-24",
  ) },
  { id: "radius", label: "Border Radius", tokens: t(
    "--radius-none", "--radius-sm", "--radius-md", "--radius-lg", "--radius-xl", "--radius-2xl", "--radius-full",
  ) },
  { id: "border-width", label: "Border Width", tokens: t(
    "--border-width-none", "--border-width-thin", "--border-width-thick",
  ) },
  { id: "size", label: "Sizes", tokens: t(
    "--size-icon-sm", "--size-icon-md", "--size-icon-lg",
    "--size-control-sm", "--size-control-md", "--size-control-lg",
  ) },
  { id: "shadow", label: "Shadow / Elevation", tokens: t(
    "--shadow-xs", "--shadow-sm", "--shadow-md", "--shadow-lg", "--shadow-xl", "--shadow-2xl",
    "--shadow-inner", "--shadow-focus",
  ) },
  { id: "duration", label: "Duration", tokens: t(
    "--duration-instant", "--duration-fast", "--duration-normal", "--duration-slow", "--duration-slower",
  ) },
  { id: "easing", label: "Easing", tokens: t(
    "--ease-linear", "--ease-in", "--ease-out", "--ease-in-out", "--ease-spring",
  ) },
  { id: "z-index", label: "Z-Index", tokens: t(
    "--z-base", "--z-dropdown", "--z-sticky", "--z-overlay", "--z-modal", "--z-popover", "--z-toast", "--z-tooltip",
  ) },
  { id: "breakpoint", label: "Breakpoint", tokens: t(
    "--breakpoint-sm", "--breakpoint-md", "--breakpoint-lg", "--breakpoint-xl", "--breakpoint-2xl",
  ) },
];

export const REFERENCE_TOKEN_COUNT = REFERENCE.reduce((n, g) => n + g.tokens.length, 0);

const ALL_REFERENCE_NAMES = new Set(REFERENCE.flatMap((g) => g.tokens));

/**
 * Emit a fill-in-the-blanks `:root { … }` skeleton, grouped with comment
 * headers. Pass a subset of names to scaffold only those (e.g. the missing
 * ones); omit for the full reference set. Empty `--x: ;` lines are dropped by
 * the parser, so unfilled tokens never enter a system.
 * @param {string[]} [names]
 */
export function templateCss(names) {
  const want = names ? new Set(names) : null;
  const blocks = [];
  for (const g of REFERENCE) {
    const tokens = want ? g.tokens.filter((n) => want.has(n)) : g.tokens;
    if (!tokens.length) continue;
    blocks.push(`/* ${g.label} */\n` + tokens.map((n) => `${n}: ;`).join("\n"));
  }
  return blocks.join("\n\n") + "\n";
}

/**
 * Compare a system's token names against the reference set.
 * @param {string[]} tokenNames
 */
export function coverage(tokenNames) {
  const have = new Set(tokenNames);
  const groups = REFERENCE.map((g) => {
    const present = g.tokens.filter((name) => have.has(name));
    const missing = g.tokens.filter((name) => !have.has(name));
    return { id: g.id, label: g.label, expected: g.tokens.length, present, missing };
  });
  const extra = [...have].filter((name) => !ALL_REFERENCE_NAMES.has(name)).sort();
  const presentCount = groups.reduce((n, g) => n + g.present.length, 0);
  return {
    groups,
    extra,
    expected: REFERENCE_TOKEN_COUNT,
    present: presentCount,
    missing: REFERENCE_TOKEN_COUNT - presentCount,
    extraCount: extra.length,
  };
}
