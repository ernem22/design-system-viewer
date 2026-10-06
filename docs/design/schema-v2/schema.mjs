// Token schema v2: the single source for the proposal in ../token-schema-v2.md.
// Every name, its DTCG $type, its default alias, and the root decisions are defined here.
// check.mjs validates the rules and generates tokens.md and elements.md from this file,
// so no count or usage in the docs is typed by hand.
//
// A default is either:
// - a string: a CSS expression whose var() names are all one tier lower (an alias);
// - null: a ROOT decision with no lower scale to alias. The user must fill it, so it is part
//   of the required core.

const STEPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
export const FAMILIES = ["neutral", "brand", "red", "orange", "yellow", "green", "teal", "blue", "purple", "magenta"];
export const STATUS = { danger: "red", warning: "orange", success: "green", info: "blue" };

const v = (n) => `var(--${n})`;
const tokens = []; // { name, tier, group, type, def, core }
const add = (tier, group, type, name, def = null, core = false) => tokens.push({ name, tier, group, type, def, core });

// ---------------------------------------------------------------- tier 1 (reference)
for (const f of FAMILIES)
  for (const s of STEPS) add(1, "Colour ramps", "color", `ref-color-${f}-${s}`, null, f === "neutral" || f === "brand");
for (const c of ["white", "black", "shadow", "transparent"]) add(1, "Colour constants", "color", `ref-color-${c}`, null, c !== "transparent");
for (const x of ["sans", "serif", "mono"]) add(1, "Font family", "fontFamily", `ref-font-family-${x}`, null, x !== "serif");
for (const x of ["2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl"]) add(1, "Font size", "dimension", `ref-font-size-${x}`, null, true);
for (const x of ["light", "regular", "medium", "semibold", "bold"]) add(1, "Font weight", "fontWeight", `ref-font-weight-${x}`);
for (const x of ["tight", "snug", "normal", "relaxed"]) add(1, "Line height", "number", `ref-line-height-${x}`);
for (const x of ["tighter", "tight", "normal", "wide", "wider"]) add(1, "Tracking", "dimension", `ref-tracking-${x}`);
for (const x of ["0", "0-5", "1", "2", "3", "4", "5", "6", "8", "10", "12", "16", "20", "24", "32"]) add(1, "Space", "dimension", `ref-space-${x}`, null, true);
for (const x of ["none", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "full"]) add(1, "Radius", "dimension", `ref-radius-${x}`, null, true);
for (const x of ["0", "1", "2", "4"]) add(1, "Border width", "dimension", `ref-border-width-${x}`);
for (const x of ["xs", "sm", "md", "lg", "xl", "2xl", "inset"]) add(1, "Shadow", "shadow", `ref-shadow-${x}`);
for (const x of ["sm", "md", "lg"]) add(1, "Blur", "dimension", `ref-blur-${x}`);
for (const x of ["10", "25", "50", "75"]) add(1, "Opacity", "number", `ref-opacity-${x}`);
for (const x of ["90", "95", "98"]) add(1, "Scale", "number", `ref-scale-${x}`);
for (const x of ["instant", "fast", "moderate", "slow", "slower"]) add(1, "Duration", "duration", `ref-duration-${x}`);
for (const x of ["linear", "standard", "decelerate", "accelerate", "emphasized", "spring"]) add(1, "Easing", "cubicBezier", `ref-easing-${x}`);

// ---------------------------------------------------------------- tier 2 (system)
const rc = (f, s) => v(`ref-color-${f}-${s}`);
const mix = (n, pct) => `color-mix(in srgb, ${v(n)} ${pct}%, transparent)`;
const BG = [
  ["canvas", rc("neutral", 50)],
  ["surface", v("ref-color-white")], ["surface-raised", v("ref-color-white")], ["surface-overlay", v("ref-color-white")],
  ["surface-sunken", rc("neutral", 100)], ["surface-inverse", rc("neutral", 900)],
  ["neutral-subtle", rc("neutral", 50)], ["neutral-subtle-hover", rc("neutral", 100)], ["neutral-subtle-pressed", rc("neutral", 200)],
  ["neutral", rc("neutral", 100)], ["neutral-hover", rc("neutral", 200)], ["neutral-pressed", rc("neutral", 300)],
  ["neutral-bold", rc("neutral", 800)], ["neutral-bold-hover", rc("neutral", 900)], ["neutral-bold-pressed", rc("neutral", 950)],
  ["accent-subtle", rc("brand", 50)], ["accent-subtle-hover", rc("brand", 100)], ["accent-subtle-pressed", rc("brand", 200)],
  ["accent-bold", rc("brand", 600)], ["accent-bold-hover", rc("brand", 700)], ["accent-bold-pressed", rc("brand", 800)],
  ...Object.entries(STATUS).flatMap(([s, f]) => [
    [`${s}-subtle`, rc(f, 50)], [`${s}-bold`, rc(f, 600)], [`${s}-bold-hover`, rc(f, 700)], [`${s}-bold-pressed`, rc(f, 800)],
  ]),
  ["selection", rc("brand", 50)], ["selection-hover", rc("brand", 100)],
  ["disabled", rc("neutral", 100)],
  ["input", v("ref-color-white")], ["input-hover", rc("neutral", 50)],
  ["scrim", mix("ref-color-shadow", 50)],
  ["skeleton", rc("neutral", 100)],
  ["highlight", rc("yellow", 100)],
];
for (const [n, d] of BG) add(2, "Colour · background", "color", `color-bg-${n}`, d);
const TEXT = [
  ["primary", rc("neutral", 900)], ["secondary", rc("neutral", 600)], ["tertiary", rc("neutral", 500)],
  ["disabled", rc("neutral", 400)], ["placeholder", rc("neutral", 500)], ["inverse", v("ref-color-white")],
  ["on-accent", v("ref-color-white")], ["on-neutral-bold", v("ref-color-white")],
  ["on-danger", v("ref-color-white")], ["on-warning", rc("neutral", 950)], ["on-success", v("ref-color-white")], ["on-info", v("ref-color-white")],
  ["accent", rc("brand", 700)], ["danger", rc("red", 700)], ["warning", rc("orange", 800)], ["success", rc("green", 700)], ["info", rc("blue", 700)],
  ["link", rc("brand", 600)], ["link-hover", rc("brand", 700)], ["link-visited", rc("purple", 700)],
  ["selection", rc("brand", 800)],
];
for (const [n, d] of TEXT) add(2, "Colour · text", "color", `color-text-${n}`, d);
const ICON = [
  ["primary", rc("neutral", 800)], ["secondary", rc("neutral", 500)], ["disabled", rc("neutral", 400)],
  ["inverse", v("ref-color-white")], ["on-accent", v("ref-color-white")], ["accent", rc("brand", 600)],
  ["danger", rc("red", 600)], ["warning", rc("orange", 600)], ["success", rc("green", 600)], ["info", rc("blue", 600)],
];
for (const [n, d] of ICON) add(2, "Colour · icon", "color", `color-icon-${n}`, d);
const BORDER = [
  ["regular", rc("neutral", 200)], ["subtle", rc("neutral", 100)], ["strong", rc("neutral", 400)],
  ["input", rc("neutral", 400)], ["input-hover", rc("neutral", 500)], ["focus", rc("brand", 600)],
  ["selection", rc("brand", 600)], ["disabled", rc("neutral", 200)], ["inverse", rc("neutral", 700)],
  ["accent", rc("brand", 300)], ["danger", rc("red", 600)], ["warning", rc("orange", 500)], ["success", rc("green", 600)], ["info", rc("blue", 600)],
];
for (const [n, d] of BORDER) add(2, "Colour · border", "color", `color-border-${n}`, d);
add(2, "Colour · state layer", "color", "color-overlay-hover", mix("ref-color-shadow", 6));
add(2, "Colour · state layer", "color", "color-overlay-pressed", mix("ref-color-shadow", 12));
const CHART = ["brand", "teal", "orange", "purple", "green", "magenta", "blue", "yellow"];
CHART.forEach((f, i) => add(2, "Colour · data viz", "color", `color-chart-categorical-${i + 1}`, rc(f, 500)));
add(2, "Colour · data viz", "color", "color-chart-grid", rc("neutral", 200));
add(2, "Colour · data viz", "color", "color-chart-axis", rc("neutral", 500));

// text roles: property-first, the same grammar as colour (--text-{property}-{role}-{scale})
export const TEXT_ROLES = {
  // role:        [size,  line-height, weight,     tracking]
  "display-lg": ["7xl", "tight", "bold", "tighter"],
  "display-md": ["6xl", "tight", "bold", "tighter"],
  "display-sm": ["5xl", "tight", "bold", "tight"],
  "headline-lg": ["4xl", "tight", "semibold", "tight"],
  "headline-md": ["3xl", "tight", "semibold", "tight"],
  "headline-sm": ["2xl", "snug", "semibold", "tight"],
  "title-lg": ["xl", "snug", "semibold", "normal"],
  "title-md": ["lg", "snug", "semibold", "normal"],
  "title-sm": ["md", "snug", "semibold", "normal"],
  "body-lg": ["lg", "relaxed", "regular", "normal"],
  "body-md": ["md", "normal", "regular", "normal"],
  "body-sm": ["sm", "normal", "regular", "normal"],
  "label-lg": ["md", "snug", "medium", "normal"],
  "label-md": ["sm", "snug", "medium", "normal"],
  "label-sm": ["xs", "snug", "medium", "wide"],
  "code-md": ["sm", "normal", "regular", "normal"],
};
const FONT_OF = { display: "sans", headline: "sans", title: "sans", body: "sans", label: "sans", code: "mono" };
for (const [g, f] of Object.entries(FONT_OF)) add(2, "Text roles", "fontFamily", `text-font-${g}`, v(`ref-font-family-${f}`));
for (const [role, [size, lh, w, tr]] of Object.entries(TEXT_ROLES)) {
  add(2, "Text roles", "dimension", `text-size-${role}`, v(`ref-font-size-${size}`));
  add(2, "Text roles", "number", `text-line-height-${role}`, v(`ref-line-height-${lh}`));
  add(2, "Text roles", "fontWeight", `text-weight-${role}`, v(`ref-font-weight-${w}`));
  add(2, "Text roles", "dimension", `text-tracking-${role}`, v(`ref-tracking-${tr}`));
}
const sp = (n) => v(`ref-space-${n}`);
const SPACE = [
  ["inline-xs", 1], ["inline-sm", 2], ["inline-md", 3], ["inline-lg", 4],
  ["stack-xs", 1], ["stack-sm", 2], ["stack-md", 4], ["stack-lg", 6], ["stack-xl", 8],
  ["inset-xs", 2], ["inset-sm", 3], ["inset-md", 4], ["inset-lg", 6], ["inset-xl", 8],
  ["gutter", 4], ["page-margin", 6], ["section-sm", 10], ["section-md", 16], ["section-lg", 24],
];
for (const [n, s] of SPACE) add(2, "Space", "dimension", `space-${n}`, sp(s));
const SIZE = [
  ["control-xs", 6], ["control-sm", 8], ["control-md", 10], ["control-lg", 12],
  ["icon-xs", 3], ["icon-sm", 4], ["icon-md", 5], ["icon-lg", 6], ["icon-xl", 8],
  ["avatar-xs", 4], ["avatar-sm", 6], ["avatar-md", 8], ["avatar-lg", 10], ["avatar-xl", 12],
  ["touch-target-min", 12],
  ["track-sm", 1], ["track-md", 2], ["indicator-sm", 2], ["indicator-md", 3],
];
for (const [n, s] of SIZE) add(2, "Size", "dimension", `size-${n}`, sp(s));
const RADIUS = [["control", "md"], ["container", "lg"], ["overlay", "lg"], ["modal", "xl"], ["pill", "full"], ["media", "lg"], ["indicator", "sm"]];
for (const [n, r] of RADIUS) add(2, "Shape", "dimension", `radius-${n}`, v(`ref-radius-${r}`));
for (const [n, w] of [["regular", 1], ["strong", 2], ["divider", 1]]) add(2, "Shape", "dimension", `border-width-${n}`, v(`ref-border-width-${w}`));
for (const [n, s] of [["raised", "sm"], ["overlay", "lg"], ["modal", "2xl"], ["inset", "inset"]]) add(2, "Elevation", "shadow", `shadow-${n}`, v(`ref-shadow-${s}`));
add(2, "Focus", "dimension", "focus-ring-width", v("ref-border-width-2"));
add(2, "Focus", "dimension", "focus-ring-offset", v("ref-space-0-5"));
add(2, "Effects", "number", "opacity-disabled", v("ref-opacity-50"));
add(2, "Effects", "dimension", "blur-overlay", v("ref-blur-sm"));
add(2, "Effects", "dimension", "blur-surface", v("ref-blur-lg"));
const tr = (d, e) => `${v(`ref-duration-${d}`)} ${v(`ref-easing-${e}`)}`;
const MOTION = [
  ["hover", tr("fast", "standard")], ["press", tr("fast", "decelerate")], ["enter", tr("moderate", "emphasized")],
  ["exit", tr("fast", "accelerate")], ["expand", tr("moderate", "standard")], ["overlay-enter", tr("moderate", "decelerate")],
  ["overlay-exit", tr("fast", "accelerate")], ["page", tr("slow", "decelerate")],
];
for (const [n, d] of MOTION) add(2, "Motion", "transition", `motion-${n}`, d);
for (const [n, s] of [["sm", 1], ["md", 2], ["lg", 4]]) add(2, "Motion", "dimension", `motion-distance-${n}`, sp(s));
add(2, "Motion", "number", "motion-scale-press", v("ref-scale-98"));
add(2, "Motion", "number", "motion-scale-enter", v("ref-scale-95"));
for (const n of ["base", "raised", "sticky", "dropdown", "overlay", "modal", "popover", "toast", "tooltip"]) add(2, "Z", "number", `z-${n}`, null, true);
for (const n of ["sm", "md", "lg", "xl"]) add(2, "Layout", "dimension", `layout-container-${n}`, null, true);
for (const n of ["narrow", "regular", "wide"]) add(2, "Layout", "dimension", `layout-measure-${n}`, null, true);
add(2, "Layout", "number", "layout-grid-columns", null, true);
add(2, "Icon", "dimension", "icon-stroke-width", v("ref-border-width-2"));

// ---------------------------------------------------------------- tier 3 (component)
// [component, Radix parts / elements it covers, { suffix: default (tier-2 name) | null (root) }]
export const COMPONENTS = [];
const comp = (name, covers, map) => {
  COMPONENTS.push({ name, covers });
  for (const [suffix, def] of Object.entries(map))
    add(3, name, typeOf(suffix), `${name}-${suffix}`, def === null ? null : v(def), def === null);
};
function typeOf(suffix) {
  // the property is the last segment once scale and state words are stripped
  const SKIP = ["xs", "sm", "md", "lg", "xl", "hover", "pressed", "selected", "checked", "focus", "error", "current", "visited", "done"];
  const prop = suffix.split("-").filter((p) => !SKIP.includes(p)).at(-1);
  if (["bg", "text", "border", "icon", "color", "placeholder"].includes(prop)) return "color";
  if (prop === "shadow") return "shadow";
  return "dimension";
}
const variant = (name, map) => Object.fromEntries(Object.entries(map).map(([k, d]) => [`${name}-${k}`, d]));

comp("button", "Button, icon button, button group", {
  ...variant("primary", { bg: "color-bg-accent-bold", "bg-hover": "color-bg-accent-bold-hover", "bg-pressed": "color-bg-accent-bold-pressed", text: "color-text-on-accent" }),
  ...variant("secondary", { bg: "color-bg-neutral", "bg-hover": "color-bg-neutral-hover", "bg-pressed": "color-bg-neutral-pressed", text: "color-text-primary", border: "color-border-regular" }),
  ...variant("ghost", { "bg-hover": "color-overlay-hover", "bg-pressed": "color-overlay-pressed", text: "color-text-primary" }),
  ...variant("danger", { bg: "color-bg-danger-bold", "bg-hover": "color-bg-danger-bold-hover", "bg-pressed": "color-bg-danger-bold-pressed", text: "color-text-on-danger" }),
  "height-sm": "size-control-sm", "height-md": "size-control-md", "height-lg": "size-control-lg",
  "padding-x-sm": "space-inset-sm", "padding-x-md": "space-inset-md", "padding-x-lg": "space-inset-lg",
  radius: "radius-control", gap: "space-inline-sm", "icon-size": "size-icon-sm", "border-width": "border-width-regular",
});
comp("input", "Text field, textarea, password, OTP, number, select trigger, combobox input", {
  bg: "color-bg-input", "bg-hover": "color-bg-input-hover", text: "color-text-primary", placeholder: "color-text-placeholder",
  border: "color-border-input", "border-hover": "color-border-input-hover", "border-focus": "color-border-focus", "border-error": "color-border-danger",
  icon: "color-icon-secondary", "height-sm": "size-control-sm", "height-md": "size-control-md", "height-lg": "size-control-lg",
  "padding-x": "space-inset-sm", "padding-y": "space-inset-xs", radius: "radius-control", "border-width": "border-width-regular",
});
comp("checkbox", "Checkbox", {
  size: "size-icon-sm", radius: "radius-indicator", bg: "color-bg-input", "bg-checked": "color-bg-accent-bold",
  border: "color-border-input", "border-checked": "color-border-selection", "indicator-color": "color-icon-on-accent",
});
comp("radio", "Radio group", {
  size: "size-icon-sm", "dot-size": "size-indicator-sm", bg: "color-bg-input", "bg-checked": "color-bg-accent-bold",
  border: "color-border-input", "border-checked": "color-border-selection", "dot-color": "color-icon-on-accent",
});
comp("switch", "Switch", {
  "track-width": "size-control-md", "track-height": "size-control-xs", "track-bg": "color-border-strong", "track-bg-checked": "color-bg-accent-bold",
  "thumb-size": "size-icon-sm", "thumb-bg": "color-bg-surface", "thumb-shadow": "shadow-raised",
});
comp("slider", "Slider", {
  "track-height": "size-track-sm", "track-bg": "color-bg-neutral", "range-bg": "color-bg-accent-bold",
  "thumb-size": "size-icon-md", "thumb-bg": "color-bg-surface", "thumb-border": "color-border-selection",
});
comp("toggle", "Toggle, toggle group, segmented-control items, toolbar toggles", {
  "bg-hover": "color-overlay-hover", "bg-checked": "color-bg-selection", text: "color-text-secondary", "text-checked": "color-text-selection",
  radius: "radius-control", height: "size-control-md",
});
comp("segmented", "Segmented control container", { bg: "color-bg-neutral", padding: "space-inset-xs", radius: "radius-control" });
comp("tabs", "Tabs", {
  "list-border": "color-border-subtle", "trigger-text": "color-text-secondary", "trigger-text-selected": "color-text-primary",
  "trigger-height": "size-control-md", "trigger-padding-x": "space-inset-sm", "indicator-color": "color-border-selection",
  "indicator-height": "border-width-strong", gap: "space-inline-md",
});
comp("menu", "Dropdown menu, context menu, menubar content, select content, combobox list, command list", {
  bg: "color-bg-surface-overlay", border: "color-border-subtle", radius: "radius-overlay", shadow: "shadow-overlay", padding: "space-inset-xs",
  "item-height": "size-control-sm", "item-padding-x": "space-inset-sm", "item-radius": "radius-control", "item-bg-hover": "color-bg-neutral-subtle-hover",
  "item-text": "color-text-primary", "item-danger-text": "color-text-danger", "separator-color": "color-border-subtle",
});
comp("popover", "Popover, hover card, navigation-menu content", {
  bg: "color-bg-surface-overlay", border: "color-border-subtle", radius: "radius-overlay", shadow: "shadow-overlay", padding: "space-inset-md", "max-width": "layout-measure-narrow",
});
comp("tooltip", "Tooltip", {
  bg: "color-bg-surface-inverse", text: "color-text-inverse", radius: "radius-control", "padding-x": "space-inset-xs", "padding-y": "space-inline-xs", "max-width": "layout-measure-narrow",
});
comp("modal", "Dialog, alert dialog", {
  bg: "color-bg-surface-overlay", radius: "radius-modal", shadow: "shadow-modal", padding: "space-inset-lg", "scrim-bg": "color-bg-scrim",
  "width-sm": null, "width-md": null, "width-lg": null,
});
comp("toast", "Toast", {
  bg: "color-bg-surface-inverse", text: "color-text-inverse", border: "color-border-inverse", radius: "radius-container", shadow: "shadow-overlay", padding: "space-inset-md", width: null,
});
comp("alert", "Callout, banner", {
  ...Object.fromEntries(Object.keys(STATUS).flatMap((s) => [
    [`${s}-bg`, `color-bg-${s}-subtle`], [`${s}-text`, `color-text-${s}`], [`${s}-border`, `color-border-${s}`], [`${s}-icon`, `color-icon-${s}`],
  ])),
  radius: "radius-container", padding: "space-inset-md", "border-width": "border-width-regular",
});
comp("badge", "Badge", {
  "neutral-bg": "color-bg-neutral", "neutral-text": "color-text-secondary",
  "accent-bg": "color-bg-accent-subtle", "accent-text": "color-text-accent",
  ...Object.fromEntries(Object.keys(STATUS).flatMap((s) => [[`${s}-bg`, `color-bg-${s}-subtle`], [`${s}-text`, `color-text-${s}`]])),
  height: "size-control-xs", "padding-x": "space-inline-sm", radius: "radius-pill",
});
comp("tag", "Tag / chip, combobox selections", {
  bg: "color-bg-neutral", "bg-hover": "color-bg-neutral-hover", text: "color-text-primary", border: "color-border-subtle",
  radius: "radius-pill", height: "size-control-xs", "padding-x": "space-inline-md", "remove-icon-color": "color-icon-secondary",
});
comp("avatar", "Avatar, avatar group", {
  radius: "radius-pill", bg: "color-bg-accent-subtle", text: "color-text-accent", "ring-width": "border-width-strong",
  "ring-color": "color-bg-surface", "group-overlap": "space-inline-sm", "status-size": "size-indicator-md",
});
comp("card", "Card, stat card", {
  bg: "color-bg-surface", border: "color-border-subtle", radius: "radius-container", shadow: "shadow-raised",
  "padding-sm": "space-inset-sm", "padding-md": "space-inset-md", "padding-lg": "space-inset-lg",
});
comp("accordion", "Accordion, collapsible", {
  "trigger-height": "size-control-lg", "trigger-padding-x": "space-inset-sm", "trigger-bg-hover": "color-bg-neutral-subtle-hover",
  border: "color-border-subtle", "content-padding": "space-inset-sm",
});
comp("separator", "Separator", { color: "color-border-subtle", width: "border-width-divider" });
comp("scrollbar", "Scroll area", {
  size: "size-track-md", "thumb-bg": "color-border-strong", "thumb-bg-hover": "color-border-input-hover", "track-bg": "color-bg-neutral-subtle",
});
comp("table", "Table", {
  "header-bg": "color-bg-surface-sunken", "header-text": "color-text-secondary", "row-bg-hover": "color-bg-neutral-subtle-hover",
  "row-bg-selected": "color-bg-selection", border: "color-border-subtle", "cell-padding-x": "space-inset-sm", "cell-height": "size-control-lg",
});
comp("list", "Data list, multi-select list, file list, timeline, tree rows", {
  "item-height": "size-control-md", "item-padding-x": "space-inset-sm", "item-radius": "radius-control",
  "item-bg-hover": "color-bg-neutral-subtle-hover", "item-bg-selected": "color-bg-selection", gap: "space-stack-xs",
});
comp("tree", "Tree view", { indent: "space-inset-md" });
comp("progress", "Progress", { "track-bg": "color-bg-neutral", "fill-bg": "color-bg-accent-bold", height: "size-track-md", radius: "radius-pill" });
comp("skeleton", "Skeleton", { bg: "color-bg-skeleton", "highlight-bg": "color-bg-neutral-subtle", radius: "radius-control" });
comp("spinner", "Spinner", {
  "indicator-color": "color-icon-accent", "track-color": "color-border-subtle", "stroke-width": "border-width-strong",
  "size-sm": "size-icon-sm", "size-md": "size-icon-md", "size-lg": "size-icon-lg",
});
comp("breadcrumb", "Breadcrumb", { text: "color-text-secondary", "text-current": "color-text-primary", "separator-color": "color-icon-secondary", gap: "space-inline-sm" });
comp("pagination", "Pagination", { "item-size": "size-control-sm", "item-radius": "radius-control", "item-bg-current": "color-bg-selection", "item-text-current": "color-text-selection" });
comp("steps", "Steps", {
  "indicator-size": "size-control-sm", "indicator-bg": "color-bg-neutral", "indicator-bg-current": "color-bg-accent-bold",
  "indicator-bg-done": "color-bg-success-bold", "connector-color": "color-border-regular",
});
comp("toolbar", "Toolbar", { bg: "color-bg-surface", border: "color-border-subtle", radius: "radius-container", padding: "space-inset-xs", gap: "space-inline-xs" });
comp("navigation", "Menubar bar, navigation menu bar, top navigation", {
  height: "size-control-lg", "padding-x": "space-inset-xs", gap: "space-inline-xs", "item-height": "size-control-sm", "item-radius": "radius-control",
  "item-bg-hover": "color-bg-neutral-subtle-hover", "item-text": "color-text-secondary", "item-text-current": "color-text-primary", "indicator-color": "color-border-selection",
});
comp("link", "Links in prose and footers", { "underline-offset": "space-inline-xs", "underline-thickness": "border-width-regular" });
comp("kbd", "Kbd", { bg: "color-bg-surface-sunken", border: "color-border-regular", text: "color-text-secondary", radius: "radius-indicator", "padding-x": "space-inline-xs", height: "size-control-xs" });
comp("code", "Inline and block code, copy-to-clipboard", { bg: "color-bg-surface-sunken", text: "color-text-primary", border: "color-border-subtle", radius: "radius-indicator", padding: "space-inline-xs" });
comp("calendar", "Calendar / date field", {
  "cell-size": "size-control-md", "cell-radius": "radius-control", "cell-bg-hover": "color-bg-neutral-subtle-hover",
  "cell-bg-selected": "color-bg-accent-bold", "cell-text-selected": "color-text-on-accent", "today-border": "color-border-accent",
});
comp("rating", "Rating", { "fill-color": "color-icon-warning", "empty-color": "color-border-regular", size: "size-icon-md" });
comp("dropzone", "File dropzone (hover = a file dragged over)", { bg: "color-bg-surface-sunken", "bg-hover": "color-bg-accent-subtle", border: "color-border-regular", "border-hover": "color-border-selection", radius: "radius-container" });
comp("chart", "Charts (Data viz)", { "tooltip-bg": "color-bg-surface-inverse", "tooltip-text": "color-text-inverse", "bar-radius": "radius-indicator", "line-width": "border-width-strong" });
comp("appshell", "Application shell (header, sidebar)", {
  "header-height": "size-control-lg", "header-bg": "color-bg-surface", "sidebar-width": null, "sidebar-width-collapsed": null,
  "sidebar-bg": "color-bg-canvas", border: "color-border-subtle",
});

export const TOKENS = tokens;
