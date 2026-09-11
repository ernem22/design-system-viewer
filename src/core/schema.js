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
    "--color-surface-inverse",
  ) },
  { id: "color-text", label: "Text", tokens: t(
    "--color-text", "--color-text-secondary", "--color-text-muted", "--color-text-disabled", "--color-text-link", "--color-text-inverse",
    "--color-text-link-hover", "--color-text-on-accent",
  ) },
  { id: "color-border", label: "Border / Divider", tokens: t(
    "--color-border", "--color-border-subtle", "--color-border-strong", "--color-divider",
  ) },
  { id: "color-accent", label: "Accent / Brand", tokens: t(
    "--color-accent", "--color-accent-hover", "--color-accent-active", "--color-accent-subtle",
    "--color-accent-muted", "--color-accent-border", "--color-accent-text", "--color-on-accent",
    "--color-accent-secondary", "--color-accent-secondary-subtle",
  ) },
  { id: "color-disabled", label: "Disabled / Inert", tokens: t(
    "--color-surface-disabled", "--color-border-disabled", "--color-icon-disabled",
  ) },
  { id: "color-input", label: "Form / Input", tokens: t(
    "--color-input-bg", "--color-input-border", "--color-input-border-focus", "--color-input-placeholder",
    "--color-input-bg-hover", "--color-input-bg-disabled",
    "--color-input-border-hover", "--color-input-border-error",
    "--color-input-text", "--color-input-icon",
  ) },
  { id: "color-brand", label: "Brand Scale (primitive)", tokens: t(
    "--color-brand-50", "--color-brand-100", "--color-brand-200", "--color-brand-300", "--color-brand-400",
    "--color-brand-500", "--color-brand-600", "--color-brand-700", "--color-brand-800", "--color-brand-900",
  ) },
  { id: "color-neutral", label: "Neutral Scale", tokens: t(
    "--color-neutral-50", "--color-neutral-100", "--color-neutral-200", "--color-neutral-300", "--color-neutral-400",
    "--color-neutral-500", "--color-neutral-600", "--color-neutral-700", "--color-neutral-800", "--color-neutral-900",
    "--color-neutral-950", "--color-neutral-1000",
  ) },
  { id: "color-chart", label: "Data Visualization", tokens: t(
    "--color-chart-1", "--color-chart-2", "--color-chart-3", "--color-chart-4",
    "--color-chart-5", "--color-chart-6", "--color-chart-7", "--color-chart-8",
    "--color-chart-grid", "--color-chart-axis", "--color-chart-tooltip-bg",
  ) },
  { id: "color-interaction", label: "Interaction", tokens: t(
    "--color-focus-ring", "--color-hover-overlay", "--color-active-overlay", "--color-selected",
    "--color-selected-subtle", "--color-pressed-overlay",
  ) },
  { id: "color-state", label: "Semantic State", tokens: t(
    ...stateTokens("success"), ...stateTokens("warning"), ...stateTokens("danger"), ...stateTokens("info"),
  ) },
  { id: "color-alpha", label: "Alpha / Overlay", tokens: t(
    "--color-scrim", "--color-shadow", "--color-tint-subtle",
  ) },
  { id: "font-family", label: "Font Family", tokens: t("--font-sans", "--font-serif", "--font-mono", "--font-display") },
  { id: "font-display", label: "Display Size", tokens: t(
    "--font-size-display-xs", "--font-size-display-sm", "--font-size-display-md",
    "--font-size-display-lg", "--font-size-display-xl",
  ) },
  { id: "font-size", label: "Font Size", tokens: t(
    "--font-size-xs", "--font-size-sm", "--font-size-base", "--font-size-lg", "--font-size-xl",
    "--font-size-2xl", "--font-size-3xl", "--font-size-4xl", "--font-size-5xl",
    "--font-size-6xl", "--font-size-7xl",
  ) },
  { id: "font-weight", label: "Font Weight", tokens: t(
    "--font-weight-light", "--font-weight-regular", "--font-weight-medium", "--font-weight-semibold", "--font-weight-bold",
  ) },
  { id: "line-height", label: "Line Height", tokens: t(
    "--line-height-tight", "--line-height-snug", "--line-height-normal", "--line-height-relaxed",
    "--line-height-none", "--line-height-loose",
  ) },
  { id: "letter-spacing", label: "Letter Spacing", tokens: t(
    "--letter-spacing-tight", "--letter-spacing-normal", "--letter-spacing-wide", "--letter-spacing-wider",
    "--letter-spacing-tighter",
  ) },
  { id: "text-measure", label: "Text Measure", tokens: t(
    "--text-measure-xs", "--text-measure-sm", "--text-measure-md",
    "--text-measure-lg", "--text-measure-xl", "--text-measure-wide",
  ) },
  { id: "spacing", label: "Spacing", tokens: t(
    "--space-0", "--space-px", "--space-0-5", "--space-1", "--space-1-5", "--space-2", "--space-2-5", "--space-3", "--space-3-5", "--space-4",
    "--space-5", "--space-6", "--space-7", "--space-8", "--space-10", "--space-12", "--space-14", "--space-16", "--space-20", "--space-24",
    "--space-28", "--space-32", "--space-40", "--space-48", "--space-56", "--space-64", "--space-72", "--space-80", "--space-96",
  ) },
  { id: "section-spacing", label: "Section Spacing", tokens: t(
    "--section-space-xs", "--section-space-sm", "--section-space-md", "--section-space-lg",
    "--section-space-xl", "--section-space-2xl", "--section-space-3xl",
  ) },
  { id: "radius", label: "Border Radius", tokens: t(
    "--radius-none", "--radius-xs", "--radius-sm", "--radius-md", "--radius-lg", "--radius-xl", "--radius-2xl", "--radius-3xl", "--radius-full",
  ) },
  { id: "border-width", label: "Border Width", tokens: t(
    "--border-width-none", "--border-width-thin", "--border-width-medium", "--border-width-thick",
  ) },
  { id: "layout", label: "Layout / Grid", tokens: t(
    "--container-max-width-xs", "--container-max-width-sm", "--container-max-width-md", "--container-max-width-lg",
    "--container-max-width-xl", "--container-max-width-2xl",
    "--container-padding-sm", "--container-padding-md", "--container-padding-lg", "--container-padding-xl", "--container-padding-2xl",
    "--grid-columns", "--grid-columns-sm", "--grid-columns-md", "--grid-columns-lg", "--grid-columns-xl",
    "--grid-gutter", "--grid-gutter-sm", "--grid-gutter-md", "--grid-gutter-lg", "--grid-gutter-xl",
    "--grid-margin-sm", "--grid-margin-md", "--grid-margin-lg", "--grid-margin-xl",
  ) },
  { id: "composition", label: "Composition", tokens: t(
    "--composition-max-width", "--composition-max-width-wide", "--composition-max-width-narrow",
    "--composition-gutter",
    "--composition-offset-sm", "--composition-offset-md", "--composition-offset-lg",
    "--composition-overlap-sm", "--composition-overlap-md", "--composition-overlap-lg",
    "--composition-aspect-wide", "--composition-aspect-standard", "--composition-aspect-square", "--composition-aspect-portrait",
  ) },
  { id: "media", label: "Media", tokens: t(
    "--media-radius", "--media-radius-sm", "--media-radius-lg", "--media-radius-xl",
    "--media-aspect-wide", "--media-aspect-video", "--media-aspect-standard", "--media-aspect-square", "--media-aspect-portrait",
    "--media-overlay", "--media-overlay-subtle", "--media-overlay-strong",
  ) },
  { id: "size", label: "Sizes", tokens: t(
    "--size-icon-xs", "--size-icon-sm", "--size-icon-md", "--size-icon-lg", "--size-icon-xl",
    "--size-control-xs", "--size-control-sm", "--size-control-md", "--size-control-lg", "--size-control-xl",
    "--size-avatar-xs", "--size-avatar-sm", "--size-avatar-md", "--size-avatar-lg", "--size-avatar-xl",
    "--size-header-height", "--size-header-height-mobile",
    "--size-sidebar-width", "--size-sidebar-width-collapsed",
  ) },
  { id: "control-geometry", label: "Control Geometry", tokens: t(
    "--control-padding-x-xs", "--control-padding-x-sm", "--control-padding-x-md", "--control-padding-x-lg", "--control-padding-x-xl",
    "--control-padding-y-xs", "--control-padding-y-sm", "--control-padding-y-md", "--control-padding-y-lg", "--control-padding-y-xl",
    "--control-radius", "--control-border-width", "--control-icon-gap",
  ) },
  { id: "iconography", label: "Iconography", tokens: t(
    "--icon-stroke-width-thin", "--icon-stroke-width", "--icon-stroke-width-medium", "--icon-stroke-width-bold",
    "--icon-gap-xs", "--icon-gap-sm", "--icon-gap-md",
  ) },
  { id: "shadow", label: "Shadow / Elevation", tokens: t(
    "--shadow-xs", "--shadow-sm", "--shadow-md", "--shadow-lg", "--shadow-xl", "--shadow-2xl",
    "--shadow-inner", "--shadow-focus", "--shadow-outline",
  ) },
  { id: "glow", label: "Glow / Light Effects", tokens: t(
    "--glow-sm", "--glow-md", "--glow-lg", "--glow-xl",
  ) },
  { id: "blur", label: "Blur", tokens: t(
    "--blur-sm", "--blur-md", "--blur-lg", "--blur-xl",
  ) },
  { id: "gradient", label: "Gradient", tokens: t(
    "--gradient-brand", "--gradient-brand-subtle", "--gradient-surface", "--gradient-surface-subtle",
    "--gradient-glow", "--gradient-fade", "--gradient-hero",
  ) },
  { id: "opacity", label: "Opacity", tokens: t(
    "--opacity-hover", "--opacity-disabled",
    "--opacity-active", "--opacity-selected", "--opacity-muted", "--opacity-overlay",
  ) },
  { id: "duration", label: "Duration", tokens: t(
    "--duration-instant", "--duration-fast", "--duration-normal", "--duration-slow", "--duration-slower", "--duration-slowest",
  ) },
  { id: "motion-distance", label: "Motion Distance", tokens: t(
    "--motion-distance-xs", "--motion-distance-sm", "--motion-distance-md", "--motion-distance-lg", "--motion-distance-xl",
  ) },
  { id: "motion-scale", label: "Motion Scale", tokens: t(
    "--motion-scale-hover", "--motion-scale-active", "--motion-scale-enter", "--motion-scale-exit",
  ) },
  { id: "motion-blur", label: "Motion Blur", tokens: t(
    "--motion-blur-enter", "--motion-blur-exit",
  ) },
  { id: "easing", label: "Easing", tokens: t(
    "--ease-linear", "--ease-in", "--ease-out", "--ease-in-out", "--ease-spring", "--ease-bounce",
    "--ease-smooth", "--ease-emphasized",
  ) },
  { id: "motion", label: "Semantic Motion", tokens: t(
    "--motion-enter", "--motion-exit", "--motion-hover", "--motion-press",
    "--motion-reveal", "--motion-layout", "--motion-modal", "--motion-page",
  ) },
  { id: "z-index", label: "Z-Index", tokens: t(
    "--z-base", "--z-dropdown", "--z-sticky", "--z-overlay", "--z-modal", "--z-popover", "--z-toast", "--z-tooltip",
    "--z-raised",
  ) },
  { id: "breakpoint", label: "Breakpoint", tokens: t(
    "--breakpoint-xs", "--breakpoint-sm", "--breakpoint-md", "--breakpoint-lg", "--breakpoint-xl", "--breakpoint-2xl",
  ) },
  { id: "accessibility", label: "Accessibility", tokens: t(
    "--focus-ring-width", "--focus-ring-offset", "--focus-ring-radius", "--touch-target-min",
  ) },
  { id: "component-button", label: "Component / Button", tokens: t(
    "--button-height-sm", "--button-height-md", "--button-height-lg", "--button-height-xl",
    "--button-padding-x-sm", "--button-padding-x-md", "--button-padding-x-lg", "--button-padding-x-xl",
    "--button-radius", "--button-icon-size", "--button-gap",
  ) },
  { id: "component-card", label: "Component / Card", tokens: t(
    "--card-padding-sm", "--card-padding-md", "--card-padding-lg", "--card-padding-xl",
    "--card-radius", "--card-border-width", "--card-shadow",
  ) },
  { id: "component-nav", label: "Component / Navigation", tokens: t(
    "--nav-height", "--nav-padding-x", "--nav-gap", "--nav-item-height", "--nav-item-radius",
  ) },
  { id: "component-badge", label: "Component / Badge", tokens: t(
    "--badge-height-sm", "--badge-height-md", "--badge-padding-x", "--badge-radius", "--badge-gap",
  ) },
  { id: "component-modal", label: "Component / Modal", tokens: t(
    "--modal-width-sm", "--modal-width-md", "--modal-width-lg", "--modal-width-xl",
    "--modal-padding", "--modal-radius", "--modal-shadow",
  ) },
  { id: "component-tooltip", label: "Component / Tooltip", tokens: t(
    "--tooltip-max-width", "--tooltip-padding-x", "--tooltip-padding-y", "--tooltip-radius",
  ) },
  { id: "component-input", label: "Component / Input", tokens: t(
    "--input-height-sm", "--input-height-md", "--input-height-lg",
    "--input-padding-x", "--input-padding-y", "--input-radius", "--input-border-width",
  ) },
  { id: "component-avatar", label: "Component / Avatar", tokens: t(
    "--avatar-ring-width", "--avatar-ring-color", "--avatar-group-overlap",
  ) },
  { id: "component-divider", label: "Component / Divider", tokens: t(
    "--divider-width", "--divider-spacing",
  ) },
  { id: "component-overlay", label: "Component / Overlay", tokens: t(
    "--overlay-opacity", "--overlay-blur", "--overlay-radius",
  ) },
  { id: "responsive", label: "Responsive Layout", tokens: t(
    "--mobile-page-padding", "--mobile-section-spacing", "--mobile-content-gap", "--mobile-grid-gap",
    "--desktop-page-padding", "--desktop-section-spacing", "--desktop-content-gap", "--desktop-grid-gap",
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
