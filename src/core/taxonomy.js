// Ordered token categories. First matching rule wins; unmatched tokens fall
// into "other". `test` runs against the token name without the leading `--`.

/** @typedef {{ id: string, label: string, kind: "color"|"type"|"length"|"shadow"|"motion"|"number"|"raw", test: (name: string) => boolean }} Category */

const has = (...frags) => (name) => frags.some((f) => name.includes(f));
const starts = (...prefixes) => (name) => prefixes.some((p) => name.startsWith(p));

/** @type {Category[]} */
export const CATEGORIES = [
  // — Color: semantic roles first (more specific), then raw ramps.
  {
    id: "color-surface",
    label: "Surface / Elevation",
    kind: "color",
    test: has("-bg", "background", "surface", "-canvas", "-overlay-color"),
  },
  {
    id: "color-text",
    label: "Text",
    kind: "color",
    test: (n) => has("text", "-fg", "foreground", "on-accent", "on-success", "on-danger", "on-warning", "on-info", "-ink")(n),
  },
  {
    id: "color-interaction",
    label: "Interaction",
    kind: "color",
    test: has("focus-ring", "hover-overlay", "active-overlay", "-selected"),
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
    id: "color-accent",
    label: "Accent / Brand",
    kind: "color",
    test: has("accent", "brand", "primary", "-brass"),
  },
  {
    id: "color-state",
    label: "Semantic State",
    kind: "color",
    test: has("success", "danger", "error", "warning", "info", "positive", "negative", "caution"),
  },
  {
    id: "color-alpha",
    label: "Alpha / Overlay",
    kind: "color",
    test: (n) => has("scrim")(n) || /^color-(shadow|tint)/.test(n),
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
  { id: "spacing", label: "Spacing", kind: "length", test: (n) => starts("space", "spacing", "gap", "size-space")(n) || /(^|-)(sp|space)-\d/.test(n) || has("-inset", "-gutter")(n) },
  { id: "radius", label: "Border Radius", kind: "length", test: has("radius", "rounded", "-corner", "-br") },
  { id: "border-width", label: "Border Width", kind: "length", test: has("border-width", "stroke-width", "-bw") },
  { id: "size", label: "Sizes", kind: "length", test: has("size-", "-height", "-width", "icon-", "control-", "container", "measure") },

  // — Effects
  { id: "shadow", label: "Shadow / Elevation", kind: "shadow", test: has("shadow", "elevation", "-depth") },
  { id: "blur", label: "Blur", kind: "length", test: has("blur", "backdrop") },
  { id: "opacity", label: "Opacity / Alpha", kind: "number", test: has("opacity", "alpha", "-tint-") },

  // — Motion
  { id: "duration", label: "Duration", kind: "motion", test: has("duration", "-speed", "transition-time") },
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
