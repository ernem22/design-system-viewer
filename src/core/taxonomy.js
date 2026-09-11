// Ordered token categories. First matching rule wins; unmatched tokens fall
// into "other". `test` runs against the token name without the leading `--`.

/** @typedef {{ id: string, label: string, kind: "color"|"type"|"length"|"shadow"|"motion"|"number"|"raw", test: (name: string) => boolean }} Category */

const has = (...frags) => (name) => frags.some((f) => name.includes(f));
const starts = (...prefixes) => (name) => prefixes.some((p) => name.startsWith(p));

/** @type {Category[]} */
export const CATEGORIES = [
  // — Component tokens first: their prefixes (input-, avatar-, overlay-, …)
  // overlap generic color/size rules below and must win.
  { id: "component-button", label: "Component / Button", kind: "raw", test: starts("button-") },
  { id: "component-card", label: "Component / Card", kind: "raw", test: starts("card-") },
  { id: "component-nav", label: "Component / Navigation", kind: "raw", test: starts("nav-") },
  { id: "component-badge", label: "Component / Badge", kind: "raw", test: starts("badge-") },
  { id: "component-modal", label: "Component / Modal", kind: "raw", test: starts("modal-") },
  { id: "component-tooltip", label: "Component / Tooltip", kind: "raw", test: starts("tooltip-") },
  { id: "component-input", label: "Component / Input", kind: "raw", test: starts("input-") },
  { id: "component-avatar", label: "Component / Avatar", kind: "raw", test: starts("avatar-") },
  { id: "component-divider", label: "Component / Divider", kind: "raw", test: starts("divider-") },
  { id: "component-overlay", label: "Component / Overlay", kind: "raw", test: starts("overlay-") },

  // — Accessibility owns focus-ring-* geometry (not the focus-ring color).
  {
    id: "accessibility",
    label: "Accessibility",
    kind: "raw",
    test: (n) => has("focus-ring-width", "focus-ring-offset", "focus-ring-radius", "touch-target")(n),
  },
  // — Brand primitive scale owns numbered brand tokens (not accent semantics).
  {
    id: "color-brand",
    label: "Brand Scale (primitive)",
    kind: "color",
    test: (n) => n.includes("brand") && /-\d+$/.test(n),
  },
  // — Display sizes own font-size-display-* (not the base font-size group).
  {
    id: "font-display",
    label: "Display Size",
    kind: "type",
    test: (n) => n.includes("font-size-display") || n.includes("display-size"),
  },
  // — Gradient owns gradient-* (names contain "brand", which accent would steal).
  { id: "gradient", label: "Gradient", kind: "raw", test: starts("gradient-") },
  // — Text measure owns text-measure-* ("text" would otherwise pull it into Text).
  { id: "text-measure", label: "Text Measure", kind: "length", test: starts("text-measure", "measure-") },
  // — Motion specifics own motion-distance/scale/blur-* ("blur" would steal motion-blur).
  { id: "motion-distance", label: "Motion Distance", kind: "motion", test: starts("motion-distance") },
  { id: "motion-scale", label: "Motion Scale", kind: "motion", test: starts("motion-scale") },
  { id: "motion-blur", label: "Motion Blur", kind: "motion", test: starts("motion-blur") },
  // — Color: named families first (input / accent / state / chart), so a
  // family's own -border/-text/-on-*/-disabled variants stay with that
  // family instead of being swallowed by the generic surface/text/border/
  // disabled rules below (e.g. --color-success-border must stay Semantic
  // State, not fall into generic Border / Divider).
  {
    id: "color-input",
    label: "Form / Input",
    kind: "color",
    test: has("input"),
  },
  {
    id: "color-accent",
    label: "Accent / Brand",
    kind: "color",
    // --color-text-on-accent is a Text token (schema), not Accent — exclude
    // the "color-text-" prefix so it falls through to color-text below.
    test: (n) => !n.startsWith("color-text-") && has("accent", "brand", "primary", "-brass")(n),
  },
  {
    id: "color-state",
    label: "Semantic State",
    kind: "color",
    test: has("success", "danger", "error", "warning", "info", "positive", "negative", "caution"),
  },
  {
    id: "color-chart",
    label: "Data Visualization",
    kind: "color",
    test: has("chart"),
  },
  {
    id: "color-text",
    label: "Text",
    kind: "color",
    test: (n) => has("text", "-fg", "foreground", "-ink")(n),
  },
  {
    id: "color-disabled",
    label: "Disabled / Inert",
    kind: "color",
    test: (n) => n.includes("-disabled") && n.includes("color"),
  },
  {
    id: "color-surface",
    label: "Surface / Elevation",
    kind: "color",
    test: has("-bg", "background", "surface", "-canvas", "-overlay-color"),
  },
  {
    id: "color-interaction",
    label: "Interaction",
    kind: "color",
    test: (n) => !n.startsWith("opacity-") && has("focus-ring", "hover-overlay", "active-overlay", "pressed-overlay", "-selected")(n),
  },
  {
    id: "color-border",
    label: "Border / Divider",
    kind: "color",
    test: (n) =>
      !/(line-height|leading|border-width|border-radius|stroke-width|shadow|duration|ease)/.test(n) &&
      (has("border", "divider", "outline")(n) ||
        /(-stroke|-line)$/.test(n) ||
        /(^|-)(ring|focus)(-|$)/.test(n)),
  },
  {
    id: "color-alpha",
    label: "Alpha / Overlay",
    kind: "color",
    test: (n) => has("scrim")(n) || /^color-(shadow|tint)/.test(n),
  },
  {
    id: "color-neutral",
    label: "Neutral Scale",
    kind: "color",
    test: has("neutral"),
  },
  {
    id: "color-ramp",
    label: "Color Ramps (primitive)",
    kind: "color",
    test: (n) =>
      /^(gray|grey|neutral|slate|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)[-_]?\d{1,3}$/.test(n) ||
      /(^|-)color-\d+$/.test(n),
  },
  {
    id: "color-misc",
    label: "Other Colors",
    kind: "color",
    test: (n) => has("color", "-tint", "-shade", "shadow-color")(n) && !has("color-scheme")(n),
  },

  // — Typography
  { id: "font-family", label: "Font Family", kind: "raw", test: (n) => has("font-family", "typeface", "font-stack")(n) || /(^|-)font-(sans|serif|mono|body|heading|display|ui)$/.test(n) },
  { id: "font-size", label: "Font Size", kind: "type", test: (n) => has("font-size", "text-size")(n) || /(^|-)text-(xs|sm|base|md|lg|xl|\dxl)$/.test(n) || /(^|-)fs-/.test(n) },
  { id: "font-weight", label: "Font Weight", kind: "number", test: has("font-weight", "-weight", "fw-") },
  { id: "line-height", label: "Line Height", kind: "number", test: has("line-height", "leading", "-lh") },
  { id: "letter-spacing", label: "Letter Spacing", kind: "raw", test: has("letter-spacing", "tracking", "-ls") },

  // — Length scales
  {
    id: "layout",
    label: "Layout / Grid",
    kind: "raw",
    test: has("grid-columns", "grid-gutter", "grid-margin", "container-max-width", "container-padding"),
  },
  { id: "section-spacing", label: "Section Spacing", kind: "length", test: starts("section-space", "section-spacing") },
  // Composition / media / control-geometry / iconography / responsive all use
  // generic length fragments (-width, -radius, icon-, control-, -gap) claimed
  // by the rules below, so they must match first.
  { id: "composition", label: "Composition", kind: "raw", test: starts("composition-") },
  { id: "media", label: "Media", kind: "raw", test: starts("media-") },
  { id: "control-geometry", label: "Control Geometry", kind: "length", test: starts("control-") },
  { id: "iconography", label: "Iconography", kind: "raw", test: starts("icon-") },
  { id: "responsive", label: "Responsive Layout", kind: "raw", test: starts("mobile-", "desktop-") },
  { id: "spacing", label: "Spacing", kind: "length", test: (n) => starts("space", "spacing", "gap", "size-space")(n) || /(^|-)(sp|space)-\d/.test(n) || has("-inset", "-gutter")(n) },
  { id: "radius", label: "Border Radius", kind: "length", test: has("radius", "rounded", "-corner", "-br") },
  { id: "border-width", label: "Border Width", kind: "length", test: has("border-width", "stroke-width", "-bw") },
  { id: "size", label: "Sizes", kind: "length", test: has("size-", "-height", "-width", "icon-", "control-", "container", "measure") },

  // — Effects
  { id: "shadow", label: "Shadow / Elevation", kind: "shadow", test: has("shadow", "elevation", "-depth") },
  { id: "glow", label: "Glow / Light Effects", kind: "shadow", test: starts("glow-") },
  { id: "blur", label: "Blur", kind: "length", test: has("blur", "backdrop") },
  { id: "opacity", label: "Opacity / Alpha", kind: "number", test: has("opacity", "alpha", "-tint-") },

  // — Motion
  { id: "duration", label: "Duration", kind: "motion", test: has("duration", "-speed", "transition-time") },
  { id: "motion", label: "Semantic Motion", kind: "motion", test: starts("motion-") },
  { id: "easing", label: "Easing", kind: "raw", test: has("ease", "easing", "-bezier", "timing-function") },

  // — Layout misc
  { id: "z-index", label: "Z-Index", kind: "number", test: (n) => has("z-index", "layer-", "elevation-z")(n) || /^z-[a-z0-9]/.test(n) || /(^|-)z-\d/.test(n) },
  { id: "breakpoint", label: "Breakpoint", kind: "raw", test: has("breakpoint", "screen-", "-bp-") },
];

/**
 * Bucket parsed tokens into ordered category groups.
 * @param {{name: string, value: string}[]} tokens
 * @returns {{ id: string, label: string, kind: string, tokens: {name:string,value:string}[] }[]}
 */
export function categorize(tokens) {
  const groups = new Map();
  const ensure = (id, label, kind) => {
    if (!groups.has(id)) groups.set(id, { id, label, kind, tokens: [] });
    return groups.get(id);
  };

  for (const token of tokens) {
    const bare = token.name.replace(/^--/, "");
    const hit = CATEGORIES.find((c) => {
      try {
        return c.test(bare);
      } catch {
        return false;
      }
    });
    if (hit) ensure(hit.id, hit.label, hit.kind).tokens.push(token);
    else ensure("other", "Other", "raw").tokens.push(token);
  }

  // Emit in CATEGORIES order, "other" last.
  const ordered = [];
  for (const c of CATEGORIES) if (groups.has(c.id)) ordered.push(groups.get(c.id));
  if (groups.has("other")) ordered.push(groups.get("other"));
  return ordered;
}
