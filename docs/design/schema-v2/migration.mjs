// v1 -> v2 migration: every v1 name (src/core/schema.js, REFERENCE) either moves to a v2 name or
// is removed with a reason. check.mjs verifies that all v1 names are covered and that every target
// exists in schema.mjs, then writes migration.md.

const R = {}; // v1 name (without --) -> v2 name
const X = {}; // v1 name -> reason it is removed
const to = (a, b) => (R[a] = b);
const rm = (reason, ...names) => names.forEach((n) => (X[n] = reason));

// ---- colour
to("color-bg", "color-bg-canvas");
for (const s of ["", "-raised", "-overlay", "-sunken", "-inverse"]) to(`color-surface${s}`, `color-bg-surface${s}`);
to("color-text", "color-text-primary"); to("color-text-secondary", "color-text-secondary"); to("color-text-muted", "color-text-tertiary");
to("color-text-disabled", "color-text-disabled"); to("color-text-link", "color-text-link"); to("color-text-inverse", "color-text-inverse");
to("color-text-link-hover", "color-text-link-hover"); to("color-text-on-accent", "color-text-on-accent");
to("color-border", "color-border-regular"); to("color-border-subtle", "color-border-subtle"); to("color-border-strong", "color-border-strong");
to("color-divider", "color-border-subtle");
to("color-accent", "color-bg-accent-bold"); to("color-accent-hover", "color-bg-accent-bold-hover"); to("color-accent-active", "color-bg-accent-bold-pressed");
to("color-accent-subtle", "color-bg-accent-subtle"); to("color-accent-muted", "color-bg-accent-subtle-hover");
to("color-accent-border", "color-border-accent"); to("color-accent-text", "color-text-accent"); to("color-on-accent", "color-text-on-accent");
rm("a second brand colour is a tier-1 colour family, not a semantic role (R2)", "color-accent-secondary", "color-accent-secondary-subtle");
to("color-surface-disabled", "color-bg-disabled"); to("color-border-disabled", "color-border-disabled"); to("color-icon-disabled", "color-icon-disabled");
to("color-input-bg", "color-bg-input"); to("color-input-border", "color-border-input"); to("color-input-border-focus", "color-border-focus");
to("color-input-placeholder", "color-text-placeholder"); to("color-input-bg-hover", "color-bg-input-hover"); to("color-input-bg-disabled", "color-bg-disabled");
to("color-input-border-hover", "color-border-input-hover"); to("color-input-border-error", "color-border-danger");
to("color-input-text", "color-text-primary"); to("color-input-icon", "color-icon-secondary");
for (const s of ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"]) to(`color-brand-${s}`, `ref-color-brand-${s}`);
for (const s of ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]) to(`color-neutral-${s}`, `ref-color-neutral-${s}`);
to("color-neutral-1000", "ref-color-black");
for (let i = 1; i <= 8; i++) to(`color-chart-${i}`, `color-chart-categorical-${i}`);
to("color-chart-grid", "color-chart-grid"); to("color-chart-axis", "color-chart-axis"); to("color-chart-tooltip-bg", "chart-tooltip-bg");
to("color-focus-ring", "color-border-focus"); to("color-hover-overlay", "color-overlay-hover"); to("color-pressed-overlay", "color-overlay-pressed");
rm("duplicate of color-overlay-pressed (R2)", "color-active-overlay");
to("color-selected", "color-bg-selection"); to("color-selected-subtle", "color-bg-selection-hover");
for (const s of ["success", "warning", "danger", "info"]) {
  to(`color-${s}`, `color-bg-${s}-bold`); to(`color-${s}-subtle`, `color-bg-${s}-subtle`); to(`color-${s}-muted`, `color-bg-${s}-bold-hover`);
  to(`color-${s}-border`, `color-border-${s}`); to(`color-${s}-text`, `color-text-${s}`); to(`color-on-${s}`, `color-text-on-${s}`);
}
to("color-scrim", "color-bg-scrim"); to("color-shadow", "ref-color-shadow");
rm("duplicate of color-overlay-hover (R2)", "color-tint-subtle");

// ---- typography
for (const f of ["sans", "serif", "mono"]) to(`font-${f}`, `ref-font-family-${f}`);
rm("replaced by the text-font-display role (R4)", "font-display");
rm("replaced by the display-* text roles (R4)", "font-size-display-xs", "font-size-display-sm", "font-size-display-md", "font-size-display-lg", "font-size-display-xl");
for (const s of ["xs", "sm", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl"]) to(`font-size-${s}`, `ref-font-size-${s}`);
to("font-size-base", "ref-font-size-md");
for (const w of ["light", "regular", "medium", "semibold", "bold"]) to(`font-weight-${w}`, `ref-font-weight-${w}`);
for (const l of ["tight", "snug", "normal", "relaxed"]) to(`line-height-${l}`, `ref-line-height-${l}`);
rm("an extreme no text role uses", "line-height-none", "line-height-loose");
for (const l of ["tighter", "tight", "normal", "wide", "wider"]) to(`letter-spacing-${l}`, `ref-tracking-${l}`);
to("text-measure-md", "layout-measure-narrow"); to("text-measure-lg", "layout-measure-regular"); to("text-measure-xl", "layout-measure-wide"); to("text-measure-wide", "layout-measure-wide");
rm("an extreme no layout uses", "text-measure-xs", "text-measure-sm");

// ---- space and layout
for (const s of ["0", "0-5", "1", "2", "3", "4", "5", "6", "8", "10", "12", "16", "20", "24", "32"]) to(`space-${s}`, `ref-space-${s}`);
rm("off the 4 px rhythm (only the 2 px half step stays)", "space-px", "space-1-5", "space-2-5", "space-3-5");
rm("not on the v2 space ramp; large layout distances are space-section-* or layout-container-*", "space-7", "space-14", "space-28", "space-40", "space-48", "space-56", "space-64", "space-72", "space-80", "space-96");
to("section-space-sm", "space-section-sm"); to("section-space-md", "space-section-md"); to("section-space-lg", "space-section-lg");
rm("v2 has three section gaps (sm, md, lg)", "section-space-xs", "section-space-xl", "section-space-2xl", "section-space-3xl");
for (const [a, b] of [["sm", "sm"], ["md", "md"], ["lg", "lg"], ["xl", "xl"]]) to(`container-max-width-${a}`, `layout-container-${b}`);
rm("v2 has four container widths (sm, md, lg, xl)", "container-max-width-xs", "container-max-width-2xl");
to("container-padding-md", "space-page-margin");
rm("one page margin, redefined per breakpoint by the system's own @media (§6 rule 3, R5)", "container-padding-sm", "container-padding-lg", "container-padding-xl", "container-padding-2xl", "grid-margin-sm", "grid-margin-md", "grid-margin-lg", "grid-margin-xl");
to("grid-columns", "layout-grid-columns"); to("grid-gutter", "space-gutter");
rm("one value, redefined per breakpoint by the system's own @media (§6 rule 3, R5)", "grid-columns-sm", "grid-columns-md", "grid-columns-lg", "grid-columns-xl", "grid-gutter-sm", "grid-gutter-md", "grid-gutter-lg", "grid-gutter-xl");
rm("art direction for marketing pages, not a product token (R5)", "composition-max-width", "composition-max-width-wide", "composition-max-width-narrow", "composition-gutter",
  "composition-offset-sm", "composition-offset-md", "composition-offset-lg", "composition-overlap-sm", "composition-overlap-md", "composition-overlap-lg",
  "composition-aspect-wide", "composition-aspect-standard", "composition-aspect-square", "composition-aspect-portrait");
to("media-radius", "radius-media");
rm("one media radius (radius-media)", "media-radius-sm", "media-radius-lg", "media-radius-xl");
rm("an aspect ratio is a component prop, not a token", "media-aspect-wide", "media-aspect-video", "media-aspect-standard", "media-aspect-square", "media-aspect-portrait");
rm("the scrim is color-bg-scrim (R2)", "media-overlay", "media-overlay-subtle", "media-overlay-strong");
rm("a mode encoded in a name; the system redefines tier-2 values in its own @media (R5)",
  "mobile-page-padding", "mobile-section-spacing", "mobile-content-gap", "mobile-grid-gap", "desktop-page-padding", "desktop-section-spacing", "desktop-content-gap", "desktop-grid-gap");

// ---- shape and size
for (const r of ["none", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "full"]) to(`radius-${r}`, `ref-radius-${r}`);
to("border-width-none", "ref-border-width-0"); to("border-width-thin", "ref-border-width-1"); to("border-width-thick", "ref-border-width-2");
rm("1.5 px renders unevenly at 1×", "border-width-medium");
for (const s of ["xs", "sm", "md", "lg", "xl"]) { to(`size-icon-${s}`, `size-icon-${s}`); to(`size-avatar-${s}`, `size-avatar-${s}`); }
for (const s of ["sm", "md", "lg"]) to(`size-control-${s}`, `size-control-${s}`);
to("size-control-xs", "size-control-xs");
rm("v2 control sizes are xs (compact parts), sm, md, lg", "size-control-xl");
to("size-header-height", "appshell-header-height"); to("size-sidebar-width", "appshell-sidebar-width"); to("size-sidebar-width-collapsed", "appshell-sidebar-width-collapsed");
rm("one header height, redefined by the system's own @media (R5)", "size-header-height-mobile");
for (const s of ["sm", "md", "lg"]) to(`control-padding-x-${s}`, `button-padding-x-${s}`);
rm("v2 has three control sizes (sm, md, lg)", "control-padding-x-xs", "control-padding-x-xl", "control-padding-y-xs", "control-padding-y-xl");
to("control-padding-y-md", "input-padding-y");
rm("one vertical input padding (input-padding-y); heights come from size-control-*", "control-padding-y-sm", "control-padding-y-lg");
to("control-radius", "radius-control"); to("control-border-width", "border-width-regular"); to("control-icon-gap", "button-gap");
to("icon-stroke-width", "icon-stroke-width");
rm("one icon stroke width", "icon-stroke-width-thin", "icon-stroke-width-medium", "icon-stroke-width-bold");
to("icon-gap-xs", "space-inline-xs"); to("icon-gap-sm", "space-inline-sm"); to("icon-gap-md", "space-inline-md");

// ---- effects
for (const s of ["xs", "sm", "md", "lg", "xl", "2xl"]) to(`shadow-${s}`, `ref-shadow-${s}`);
to("shadow-inner", "ref-shadow-inset");
rm("the focus ring is color-border-focus + focus-ring-width + focus-ring-offset", "shadow-focus", "shadow-outline");
rm("a marketing effect, not a product decision (R5)", "glow-sm", "glow-md", "glow-lg", "glow-xl",
  "gradient-brand", "gradient-brand-subtle", "gradient-surface", "gradient-surface-subtle", "gradient-glow", "gradient-fade", "gradient-hero");
to("blur-sm", "ref-blur-sm"); to("blur-md", "ref-blur-md"); to("blur-lg", "ref-blur-lg");
rm("not on the v2 blur ramp (sm, md, lg)", "blur-xl");
to("opacity-disabled", "opacity-disabled");
rm("state is the state layer (color-overlay-*); the scrim is a colour (R2)", "opacity-hover", "opacity-active", "opacity-selected", "opacity-muted", "opacity-overlay");

// ---- motion
to("duration-instant", "ref-duration-instant"); to("duration-fast", "ref-duration-fast"); to("duration-normal", "ref-duration-moderate");
to("duration-slow", "ref-duration-slow"); to("duration-slower", "ref-duration-slower");
rm("not on the v2 duration ramp", "duration-slowest");
for (const s of ["sm", "md", "lg"]) to(`motion-distance-${s}`, `motion-distance-${s}`);
rm("v2 has three distances (sm, md, lg)", "motion-distance-xs", "motion-distance-xl");
to("motion-scale-active", "motion-scale-press"); to("motion-scale-enter", "motion-scale-enter");
rm("hover scaling is not a product-wide decision; exit: 1 is a no-op", "motion-scale-hover", "motion-scale-exit");
rm("a marketing effect (R5)", "motion-blur-enter", "motion-blur-exit");
to("ease-linear", "ref-easing-linear"); to("ease-in", "ref-easing-accelerate"); to("ease-out", "ref-easing-decelerate");
to("ease-in-out", "ref-easing-standard"); to("ease-emphasized", "ref-easing-emphasized"); to("ease-spring", "ref-easing-spring");
rm("not on the v2 easing set", "ease-bounce", "ease-smooth");
for (const m of ["enter", "exit", "hover", "press", "page"]) to(`motion-${m}`, `motion-${m}`);
to("motion-reveal", "motion-expand"); to("motion-modal", "motion-overlay-enter");
rm("layout animation is not a product-wide decision", "motion-layout");

// ---- z, breakpoints, accessibility
for (const z of ["base", "raised", "sticky", "dropdown", "overlay", "modal", "popover", "toast", "tooltip"]) to(`z-${z}`, `z-${z}`);
rm("var() is invalid inside @media, so a breakpoint cannot be a CSS custom property (R8)",
  "breakpoint-xs", "breakpoint-sm", "breakpoint-md", "breakpoint-lg", "breakpoint-xl", "breakpoint-2xl");
to("focus-ring-width", "focus-ring-width"); to("focus-ring-offset", "focus-ring-offset");
rm("a focus ring follows the radius of the element it surrounds", "focus-ring-radius");
to("touch-target-min", "size-touch-target-min");

// ---- components
for (const s of ["sm", "md", "lg"]) { to(`button-height-${s}`, `button-height-${s}`); to(`button-padding-x-${s}`, `button-padding-x-${s}`); }
rm("v2 has three control sizes (sm, md, lg)", "button-height-xl", "button-padding-x-xl");
to("button-radius", "button-radius"); to("button-icon-size", "button-icon-size"); to("button-gap", "button-gap");
for (const s of ["sm", "md", "lg"]) to(`card-padding-${s}`, `card-padding-${s}`);
rm("v2 has three card paddings (sm, md, lg)", "card-padding-xl");
to("card-radius", "card-radius"); to("card-shadow", "card-shadow");
rm("duplicate of border-width-regular (R2)", "card-border-width");
for (const n of ["height", "padding-x", "gap", "item-height", "item-radius"]) to(`nav-${n}`, `navigation-${n}`);
to("badge-height-md", "badge-height"); to("badge-padding-x", "badge-padding-x"); to("badge-radius", "badge-radius");
rm("one badge size", "badge-height-sm");
rm("a badge holds one label; its icon gap is space-inline-xs", "badge-gap");
for (const s of ["sm", "md", "lg"]) to(`modal-width-${s}`, `modal-width-${s}`);
rm("v2 has three modal widths (sm, md, lg)", "modal-width-xl");
to("modal-padding", "modal-padding"); to("modal-radius", "modal-radius"); to("modal-shadow", "modal-shadow");
for (const n of ["max-width", "padding-x", "padding-y", "radius"]) to(`tooltip-${n}`, `tooltip-${n}`);
for (const n of ["height-sm", "height-md", "height-lg", "padding-x", "padding-y", "radius", "border-width"]) to(`input-${n}`, `input-${n}`);
to("avatar-ring-width", "avatar-ring-width"); to("avatar-ring-color", "avatar-ring-color"); to("avatar-group-overlap", "avatar-group-overlap");
to("divider-width", "separator-width");
rm("separator spacing is the surrounding layout's space-stack-*", "divider-spacing");
rm("the scrim's strength is part of color-bg-scrim", "overlay-opacity");
to("overlay-blur", "blur-overlay"); to("overlay-radius", "radius-overlay");

export const RENAMED = R;
export const REMOVED = X;
