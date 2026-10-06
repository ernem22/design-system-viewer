// Every Preview element after v2: what it reads, and the verdict for each of today's demos.
// `reads` entries are token names or prefixes ending in "*", which check.mjs expands against
// schema.mjs. A prefix that matches nothing is an error, and so is a name that does not exist.
// The generated elements.md lists every name explicitly.
//
// Verdicts:
// - keep   = the demo stays;
// - change = the demo is reshaped;
// - new    = the demo is added;
// - merge  = the demo becomes part of another (`into`);
// - remove = the demo leaves the Preview.

const role = (r) => {
  const group = r.split("-")[0];
  return [`text-font-${group}`, `text-size-${r}`, `text-line-height-${r}`, `text-weight-${r}`, `text-tracking-${r}`];
};
// the one system-wide disabled and focus languages (rules 1.4 and 1.5 of preview-token-map.md)
const DISABLED = ["color-bg-disabled", "color-text-disabled", "color-border-disabled", "color-icon-disabled", "opacity-disabled"];
const FOCUS = ["color-border-focus", "focus-ring-width", "focus-ring-offset"];

const E = [];
const el = (section, file, title, verdict, reads = [], extra = {}) => E.push({ section, file, title, verdict, reads, ...extra });

// ---------------------------------------------------------------- Foundations (new section)
const F = "Foundations";
const ff = "foundations.tsx (new)";
el(F, ff, "Colour ramps", "new", ["ref-color-*"]);
el(F, ff, "Colour roles", "new", ["color-bg-*", "color-text-*", "color-icon-*", "color-border-*", "color-overlay-*"], {
  note: "every role as a swatch on its declared partner background, with the contrast ratio of the pair; state layers over each fill",
});
el(F, ff, "Status colours", "new", ["color-bg-danger-*", "color-bg-warning-*", "color-bg-success-*", "color-bg-info-*",
  "color-text-danger", "color-text-warning", "color-text-success", "color-text-info",
  "color-text-on-danger", "color-text-on-warning", "color-text-on-success", "color-text-on-info",
  "color-icon-danger", "color-icon-warning", "color-icon-success", "color-icon-info",
  "color-border-danger", "color-border-warning", "color-border-success", "color-border-info"]);
el(F, ff, "Surfaces & elevation", "new", ["color-bg-canvas", "color-bg-surface*", "color-bg-scrim", "shadow-*", "ref-shadow-*", "blur-*", "ref-blur-*"]);
el(F, ff, "Type roles", "new", ["text-*", "ref-font-*", "ref-line-height-*", "ref-tracking-*"]);
el(F, ff, "Space", "new", ["space-*", "ref-space-*"]);
el(F, ff, "Size", "new", ["size-*", "icon-stroke-width"]);
el(F, ff, "Shape", "new", ["radius-*", "border-width-*", "ref-radius-*", "ref-border-width-*"]);
el(F, ff, "Effects", "new", ["opacity-disabled", "ref-opacity-*", "ref-color-transparent"]);
el(F, ff, "Motion", "new", ["motion-*", "ref-duration-*", "ref-easing-*", "ref-scale-*"]);
el(F, ff, "Layer order", "new", ["z-*"], { note: "sticky header + dropdown + dialog + toast + tooltip open at once" });
el(F, ff, "Layout", "new", ["layout-*", "space-gutter", "space-page-margin"]);

// ---------------------------------------------------------------- Forms
const fo = "forms.tsx";
el("Forms", fo, "Button — variants", "keep", ["button-primary-*", "button-secondary-*", "button-ghost-*", "button-danger-*", "button-radius", "button-border-width", "button-height-md", "button-padding-x-md", ...role("label-md"), ...FOCUS]);
el("Forms", fo, "Button — sizes", "keep", ["button-height-*", "button-padding-x-*", "button-primary-bg", "button-primary-text", ...role("label-sm"), ...role("label-md"), ...role("label-lg")]);
el("Forms", fo, "Button — icons & loading", "keep", ["button-gap", "button-icon-size", "button-height-*", "spinner-indicator-color", "spinner-track-color", "spinner-stroke-width", "spinner-size-sm"], { note: "adds icon-only buttons at every size" });
el("Forms", fo, "Input / Textarea", "keep", ["input-bg", "input-bg-hover", "input-text", "input-placeholder", "input-border", "input-border-hover", "input-border-focus", "input-radius", "input-padding-x", "input-padding-y", "input-border-width", "input-height-*", ...role("body-md"), ...role("label-sm"), ...FOCUS]);
el("Forms", fo, "Input — adornments & counter", "keep", ["input-icon", "input-padding-x", "color-text-tertiary", "space-inline-sm"]);
el("Forms", fo, "Input — inset & success", "change", ["input-bg", "input-border", "input-border-focus", "input-padding-y", ...role("label-sm")], { note: "keeps the inset label; drops the success border (v2 has no input success state)" });
el("Forms", fo, "Input — themed tokens", "merge", [], { into: "Input / Textarea" });
el("Forms", fo, "Disabled treatment", "change", [...DISABLED], { note: "one row of every control (button, input, select, checkbox, radio, switch, slider, toggle, tabs) disabled side by side" });
el("Forms", fo, "Checkbox", "keep", ["checkbox-*", ...role("body-md"), ...FOCUS]);
el("Forms", fo, "Radio Group", "keep", ["radio-*", ...role("body-md"), ...FOCUS]);
el("Forms", fo, "Switch", "keep", ["switch-*", ...role("body-md"), ...FOCUS]);
el("Forms", fo, "Slider", "keep", ["slider-*", ...FOCUS]);
el("Forms", fo, "Select", "keep", ["input-bg", "input-border", "input-text", "input-icon", "input-height-md", "input-radius", "menu-*", ...role("body-md")]);
el("Forms", fo, "Toggle / Toggle Group", "keep", ["toggle-*", ...role("label-md"), ...FOCUS]);

// ---------------------------------------------------------------- Form + validation
const va = "validation.tsx";
el("Form + validation", va, "Radix Form — client validation", "keep", ["input-bg", "input-border", "input-border-error", "input-text", "color-text-danger", "color-icon-danger", ...role("label-sm"), ...role("body-sm")]);
el("Form + validation", va, "Password Toggle Field", "keep", ["input-bg", "input-border", "input-text", "input-height-md", "button-ghost-*", "button-icon-size"]);
el("Form + validation", va, "One-Time Password Field (6 digits, paste supported)", "keep", ["input-bg", "input-border", "input-border-focus", "input-height-lg", "input-radius", "space-inline-sm", ...role("title-md")]);

// ---------------------------------------------------------------- Overlays
const ov = "overlays.tsx";
el("Overlays", ov, "Dialog", "keep", ["modal-*", "motion-overlay-enter", "motion-overlay-exit", "z-modal", ...role("title-md"), ...role("body-md")], { note: "adds a width switch for modal-width-sm/md/lg" });
el("Overlays", ov, "Alert Dialog", "keep", ["modal-bg", "modal-radius", "modal-shadow", "modal-padding", "modal-scrim-bg", "modal-width-sm", "button-danger-*", "button-secondary-*"]);
el("Overlays", ov, "Popover", "keep", ["popover-*", "motion-overlay-enter", "z-popover"]);
el("Overlays", ov, "Tooltip", "keep", ["tooltip-*", "z-tooltip", ...role("label-sm")]);
el("Overlays", ov, "Dropdown Menu", "keep", ["menu-*", "color-icon-secondary", "z-dropdown", ...role("body-md")]);
el("Overlays", ov, "Context Menu (right-click)", "keep", ["menu-*"], { note: "the trigger becomes a focusable button (#127)" });
el("Overlays", ov, "Hover Card", "keep", ["popover-*", "avatar-radius", "avatar-bg", "avatar-text"]);
el("Overlays", ov, "Popover — large (shadow-xl)", "remove", [], { note: "a second popover style the schema cannot express" });

// ---------------------------------------------------------------- Navigation
const na = "navigation.tsx";
el("Navigation", na, "Menubar", "keep", ["navigation-*", "menu-*", ...role("label-md")]);
el("Navigation", na, "Navigation Menu", "keep", ["navigation-*", "popover-*", ...role("label-md")]);
el("Navigation", na, "Tabs", "keep", ["tabs-*", ...role("label-md"), ...FOCUS]);
el("Navigation", na, "Toolbar", "keep", ["toolbar-*", "toggle-*", "separator-*"]);

// ---------------------------------------------------------------- Feedback
const fe = "feedback.tsx";
el("Feedback", fe, "Progress", "keep", ["progress-*", ...role("label-sm")]);
el("Feedback", fe, "Toast", "keep", ["toast-*", "button-ghost-*", "motion-enter", "motion-exit", "z-toast", ...role("body-sm")]);
el("Feedback", fe, "Badge", "keep", ["badge-*", ...role("label-sm")], { note: "all six tones" });
el("Feedback", fe, "Badge (solid)", "remove", [], { note: "a second badge style the schema cannot express" });
el("Feedback", fe, "Kbd", "keep", ["kbd-*", ...role("code-md")]);
el("Feedback", fe, "State trio — empty / loading / error", "remove", [], { note: "duplicates Empty state, Skeleton and Callout" });

// ---------------------------------------------------------------- Layout
const la = "layout.tsx";
el("Layout", la, "Accordion", "keep", ["accordion-*", "motion-expand", ...role("title-sm"), ...role("body-md")]);
el("Layout", la, "Collapsible", "merge", [], { into: "Accordion" });
el("Layout", la, "Separator", "keep", ["separator-*"]);
el("Layout", la, "Avatar", "change", ["avatar-*", "size-avatar-*", "color-bg-success-bold", ...role("label-md")], { note: "one demo: images, initials, five sizes, presence, a group" });
el("Layout", la, "Avatar — sizes & presence", "merge", [], { into: "Avatar" });
el("Layout", la, "App shell metrics", "change", ["appshell-*", "space-page-margin"], { note: "renamed App shell; a real header and sidebar, collapsed and expanded" });
el("Layout", la, "Scroll Area", "keep", ["scrollbar-*"]);
el("Layout", la, "Aspect Ratio (16:9)", "merge", [], { into: "Foundations › Shape (radius-media); aspect ratio is not a token" });

// ---------------------------------------------------------------- Utilities (section removed)
const ut = "utilities.tsx";
for (const t of ["Accessible Icon — icon button screen reader label", "Visually Hidden — not visible, but in accessibility tree", "Direction Provider — RTL"])
  el("Utilities", ut, t, "remove", [], { note: "renders nothing a design-system user can judge; stays an implementation rule (#127)" });

// ---------------------------------------------------------------- Foundation tokens (v1 section, replaced)
const fd = "foundation.tsx";
const FOUND = [
  ["Gradient", "remove"], ["Glow", "remove"], ["Semantic motion (hover to play)", "merge", "Foundations › Motion"],
  ["Section rhythm + composition", "merge", "Foundations › Space"], ["Media", "merge", "Foundations › Shape"],
  ["Breakpoint scale", "remove"], ["Overlay tokens", "merge", "Foundations › Surfaces & elevation"],
  ["Accessibility — touch target minimum", "merge", "Foundations › Size"], ["Iconography", "merge", "Foundations › Size"],
  ["Responsive grid + containers", "merge", "Foundations › Layout"], ["Text measure", "merge", "Foundations › Layout"],
  ["Inverse surface + secondary accent", "merge", "Foundations › Surfaces & elevation"], ["Spacing scale", "merge", "Foundations › Space"],
  ["Shape — radius ends + medium border", "merge", "Foundations › Shape"], ["Control density", "merge", "Foundations › Size"],
  ["Modal widths + input heights", "remove"], ["Responsive tokens", "remove"], ["Control + icon sizes", "merge", "Foundations › Size"],
  ["Composition — widths, offsets, aspects", "remove"],
];
for (const [t, vd, into] of FOUND) el("Foundation tokens (v1)", fd, t, vd, [], into ? { into } : { note: "its tokens are removed in v2 or shown by components" });

// ---------------------------------------------------------------- Product patterns
const pa = "patterns.tsx";
el("Product patterns", pa, "Calendar / date field", "keep", ["calendar-*", "input-bg", "input-border", "input-height-md", "popover-*", ...role("label-sm")]);
el("Product patterns", pa, "Combobox — multi-select tags", "keep", ["input-bg", "input-border", "input-border-focus", "menu-*", "tag-*"], { note: "moves to Radix Popover + listbox (#127)" });
el("Product patterns", pa, "Number stepper", "keep", ["input-bg", "input-border", "input-height-md", "button-secondary-*"]);
el("Product patterns", pa, "Rating", "keep", ["rating-*", ...FOCUS]);
el("Product patterns", pa, "Copy to clipboard", "keep", ["code-*", "button-ghost-*", "tooltip-*", ...role("code-md")]);
el("Product patterns", pa, "Inline edit", "keep", ["input-bg", "input-border", "input-border-focus", "button-ghost-*", ...role("body-md")]);
el("Product patterns", pa, "Avatar group", "merge", [], { into: "Avatar" });
el("Product patterns", pa, "Keyboard shortcuts", "keep", ["kbd-*", "table-*", ...role("body-sm")]);
el("Product patterns", pa, "Tree view", "keep", ["list-item-*", "tree-indent", "color-icon-secondary", ...role("body-sm")]);
el("Product patterns", pa, "File dropzone", "keep", ["dropzone-*", "color-icon-secondary", ...role("body-sm"), ...FOCUS]);
el("Product patterns", pa, "Chart primitives", "merge", [], { into: "viz" });
el("Product patterns", pa, "Chart theme tokens", "merge", [], { into: "viz" });

// ---------------------------------------------------------------- Data display
const dd = "dataDisplay.tsx";
el("Data display", dd, "Table — interactive (sort, select, sticky)", "keep", ["table-*", "checkbox-*", "z-sticky", ...role("label-sm"), ...role("body-sm")]);
el("Data display", dd, "Multi-select list (selected)", "keep", ["list-*", "checkbox-*", ...role("body-md")]);
el("Data display", dd, "Card — tint wash & colored shadow", "change", ["card-*", ...role("title-sm"), ...role("body-sm")], { note: "one Card demo with card-padding-sm/md/lg; tint wash and coloured shadow are not v2 decisions" });
el("Data display", dd, "Data list", "keep", ["list-*", "color-text-secondary", ...role("body-sm")]);
el("Data display", dd, "Stat cards", "keep", ["card-*", "color-text-success", "color-text-danger", ...role("headline-sm"), ...role("label-sm"), ...role("display-sm")], { note: "absorbs Stat — hero numbers as a display-sm variant" });
el("Data display", dd, "Stat — hero numbers", "merge", [], { into: "Stat cards" });
el("Data display", dd, "Type — display sizes", "merge", [], { into: "Foundations › Type roles" });
el("Data display", dd, "Neutral ramp", "merge", [], { into: "Foundations › Colour ramps" });
el("Data display", dd, "Code", "keep", ["code-*", ...role("code-md")]);
el("Data display", dd, "Quote", "merge", [], { into: "Prose" });
el("Data display", dd, "Tag / Chip (removable)", "keep", ["tag-*", ...role("label-sm"), ...FOCUS]);
el("Data display", dd, "Timeline", "keep", ["list-gap", "separator-*", "color-icon-accent", "color-icon-secondary", ...role("body-sm"), ...role("label-sm")]);

// ---------------------------------------------------------------- Status & loading
const st = "status.tsx";
el("Status & loading", st, "Callout", "keep", ["alert-*", ...role("title-sm"), ...role("body-md")], { note: "all four statuses" });
el("Status & loading", st, "Banner (dismissible)", "keep", ["alert-*", "button-ghost-*", ...role("body-md")]);
el("Status & loading", st, "Empty state", "keep", ["button-primary-*", "color-icon-secondary", "size-icon-xl", ...role("title-md"), ...role("body-md")]);
el("Status & loading", st, "Skeleton", "keep", ["skeleton-*", "motion-expand"]);
el("Status & loading", st, "Spinner", "keep", ["spinner-*"]);
el("Status & loading", st, "Motion — instant toggle", "merge", [], { into: "Foundations › Motion" });
el("Status & loading", st, "Motion — duration scale", "merge", [], { into: "Foundations › Motion" });
el("Status & loading", st, "File list", "keep", ["list-*", "progress-*", "color-icon-secondary", ...role("body-sm")]);
el("Status & loading", st, "Blur / outline / bounce", "remove", [], { note: "its tokens are removed in v2" });

// ---------------------------------------------------------------- Navigation extras
const ne = "navExtras.tsx";
el("Navigation extras", ne, "Breadcrumb", "keep", ["breadcrumb-*", ...role("body-sm")]);
el("Navigation extras", ne, "Prose links", "change", ["link-*", "color-text-link", "color-text-link-hover", "color-text-link-visited", "color-bg-highlight", "color-bg-selection", "color-text-selection", "color-border-accent", "color-text-secondary", ...role("body-md"), ...role("body-lg"), ...FOCUS], { note: "renamed Prose: visited link, <mark>, ::selection, absorbs Quote and Footer links" });
el("Navigation extras", ne, "Pagination", "keep", ["pagination-*", ...role("label-md"), ...FOCUS]);
el("Navigation extras", ne, "Steps", "keep", ["steps-*", "color-text-on-accent", ...role("label-sm")]);
el("Navigation extras", ne, "Segmented control", "keep", ["segmented-*", "toggle-*", ...role("label-md")]);
el("Navigation extras", ne, "Button group", "keep", ["button-secondary-*", "button-radius", "button-height-md"]);
el("Navigation extras", ne, "Footer links", "merge", [], { into: "Prose" });

// ---------------------------------------------------------------- Components › new
el("Forms", fo, "Focus & keyboard", "new", [...FOCUS, "button-primary-bg", "input-border", "checkbox-border", "switch-track-bg", "tabs-trigger-text", "menu-item-bg-hover"], { note: "every focusable control in its focus-visible state at once" });

// ---------------------------------------------------------------- Screens
// A screen is a composition test. It reads only text roles and space/layout tokens directly;
// everything else comes from the components it renders (`composes`).
const sc = "screens/";
const screen = (t, verdict, composes, reads = [], extra = {}) => el("Screens", `${sc}${t}.tsx`, t, verdict, reads, { composes, ...extra });
const LAY = ["space-page-margin", "space-section-md", "space-stack-md", "space-gutter"];
screen("dashboard", "keep", ["card", "progress", "popover", "avatar", "separator"], [...LAY, ...role("headline-md"), ...role("body-sm")]);
screen("analytics", "keep", ["table", "chart", "segmented", "toggle", "card"], [...LAY, ...role("headline-md")], { note: "absorbs report" });
screen("settings", "keep", ["tabs", "switch", "select", "radio", "slider", "separator", "input", "button"], [...LAY, ...role("title-md"), ...role("body-sm")], { note: "absorbs profile" });
screen("team", "keep", ["table", "avatar", "modal", "badge", "button"], [...LAY, ...role("headline-sm")]);
screen("inbox", "keep", ["list", "avatar", "badge", "toolbar"], [...LAY, ...role("body-sm")]);
screen("chat", "keep", ["input", "avatar", "popover", "button"], [...LAY, ...role("body-md")]);
screen("kanban", "keep", ["card", "tag", "avatar", "menu"], [...LAY, ...role("title-sm")]);
screen("schedule", "keep", ["calendar", "popover", "tag"], [...LAY, ...role("title-md")]);
screen("checkout", "keep", ["input", "select", "checkbox", "separator", "button"], [...LAY, ...role("title-md")], { note: "absorbs billing" });
screen("pricing", "keep", ["card", "switch", "badge", "button"], [...LAY, ...role("headline-lg"), "layout-container-lg"]);
screen("marketing", "keep", ["button", "card"], [...LAY, ...role("display-lg"), ...role("display-md"), ...role("headline-lg"), ...role("body-lg"), "layout-container-xl", "layout-measure-wide", "space-section-lg", "radius-media"]);
screen("onboarding", "keep", ["steps", "progress", "input", "button"], [...LAY, ...role("headline-sm")]);
screen("login", "keep", ["input", "checkbox", "button", "link"], [...LAY, ...role("headline-sm"), "layout-container-sm"], { note: "absorbs signup as an Auth screen with both modes" });
screen("commandPalette", "keep", ["menu", "kbd", "input"], [...LAY], { note: "absorbs search" });
screen("upload", "keep", ["dropzone", "progress", "list"], [...LAY], { note: "absorbs files" });
screen("table", "keep", ["table", "menu", "modal", "pagination", "checkbox"], [...LAY, ...role("headline-sm")]);
screen("viz", "keep", ["chart", "card"], ["chart-*", "color-chart-*", ...role("label-sm")], { note: "absorbs Chart primitives and Chart theme tokens" });
screen("notifications", "keep", ["list", "badge", "toast", "switch"], [...LAY, ...role("body-sm")], { note: "absorbs activity" });
screen("emptyState", "keep", ["button", "card"], [...LAY], { note: "absorbs notFound" });
for (const [t, into] of [["signup", "login"], ["notFound", "emptyState"], ["report", "analytics"], ["activity", "notifications"], ["profile", "settings"], ["files", "upload"], ["search", "commandPalette"], ["billing", "checkout"]])
  screen(t, "merge", [], [], { into });

export const ELEMENTS = E;
