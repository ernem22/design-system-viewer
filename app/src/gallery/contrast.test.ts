/**
 * Pins the WCAG repairs for issue #88 at the source-text level. The contrast
 * ratios in the comments are the measured values from the audit's running
 * build (perp-ultra-v2, Preview tab); each assertion names a pairing the
 * parent commit got wrong, so this suite fails before the fix and passes
 * after it.
 *
 * Vitest runs in the `node` environment, where Vite's `?raw` suffix resolves
 * to an empty string — the stylesheets are read from disk instead, relative
 * to `import.meta.url` so the test works from any cwd.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const patternsCss = read("./components/patterns.css");
const galleryCss = read("./gallery.css");
const formsCss = read("./components/forms.css");
const tokenInspectorCss = read("./tokenInspector.css");
const screensCss = read("./components/screens/screens.css");
const foundationCss = read("./components/foundation.css");
const foundationTsx = read("./components/foundation.tsx");

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// Whitespace-tolerant rule lookup: the stylesheets wrap some bodies over
// several lines, so a plain `[^}]*` capture after the selector misses them.
function ruleText(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  if (at === -1) return "";
  const end = css.indexOf("}", at);
  return css.slice(at, end === -1 ? undefined : end);
}

// The audited system's values (systems/perp-ultra-v2.json).
const perp = {
  surfaceInverse: "#f7f5ef",
  textInverse: "#20211f",
  successText: "#46603f",
  dangerText: "#84372f",
  successSubtle: "#edf2e9",
  dangerSubtle: "#f8e9e5",
  accentSubtle: "#542419",
  selected: "#783020",
  text: "#f2efe7",
  bg: "#151715",
  surface: "#20211f",
  surfaceDisabled: "#30312d",
  textMuted: "#aaa9a0",
  textSecondary: "#d2d0c7",
  onWarning: "#fffaf1",
  warning: "#a87532",
  onSuccess: "#fcfaf4",
  success: "#66805e",
  onInfo: "#fcfaf4",
  info: "#657c7c",
  neutral1000: "#0d0e0d",
};

/** color-mix(in srgb, a pct%, b) — `pct` is a's share (b gets pct-100).
 *  Matches the browser's sRGB mix closely enough for a 4.5:1 gate. */
function mix(a: string, b: string, pct: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const out = A.map((v, i) => Math.round(v * (pct / 100) + B[i] * (1 - pct / 100)));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// Gemini 1 (systems/gemini1.json) has a dark hero gradient but a bright
// brand gradient and a light accent. Its --color-text-on-accent is dark, so
// the token has the opposite job on each surface: it is the light-on-dark
// repair for the hero and the dark-on-bright repair for the brand. Neither
// surface can share one token. --color-neutral-50 is the lightest token in
// every system (min relative luminance 0.875 across all 40 maps).
const gemini1 = {
  brandStart: "#ccff00",
  brandEnd: "#00f0ff",
  heroStart: "#14161d",
  heroEnd: "#08090c",
  neutral50: "#f0f2f8",
  textOnAccent: "#0d0e12",
};

describe("issue #88 contrast repairs", () => {
  it("pairs surface-inverse with text-inverse so the inverse panel clears 4.5:1", () => {
    // audit: surface-inverse #f7f5ef + text-on-accent #fffaf1 = 1.05:1
    expect(contrast(perp.textInverse, perp.surfaceInverse)).toBeGreaterThanOrEqual(4.5);
    const panel = foundationTsx.slice(foundationTsx.indexOf("var(--color-surface-inverse)"));
    expect(panel.slice(0, 200)).toContain('color: "var(--color-text-inverse)"');
    expect(panel.slice(0, 200)).not.toContain("var(--color-text-on-accent)");
  });

  it("gives .dsv-stat .d.up/down a -subtle background behind their -text token", () => {
    // audit: .d.down #84372f on surface #20211f = 1.98:1; .d.up = 2.31:1
    expect(contrast(perp.successText, perp.successSubtle)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(perp.dangerText, perp.dangerSubtle)).toBeGreaterThanOrEqual(4.5);
    expect(ruleText(galleryCss, ".dsv-stat .d.up")).toContain("var(--color-success-subtle)");
    expect(ruleText(galleryCss, ".dsv-stat .d.down")).toContain("var(--color-danger-subtle)");
  });

  it("gives .dsv-hint--err a -subtle background behind --color-danger-text", () => {
    // audit: .dsv-hint--err #84372f on surface #20211f = 2.2:1
    expect(contrast(perp.dangerText, perp.dangerSubtle)).toBeGreaterThanOrEqual(4.5);
    const rule = ruleText(galleryCss, ".dsv-hint--err");
    expect(rule).toContain("var(--color-danger-text)");
    expect(rule).toContain("var(--color-danger-subtle)");
  });

  it("gives .dsv-cal-day its own token background + text (no UA buttonface regression)", () => {
    // Regression: `color: inherit` made a plain day inherit the app's light
    // text while its UA buttonface background (#f0f0f0) stayed unthemed ->
    // rgb(242,239,231) on rgb(240,240,240) = 1.01:1. Plain days must get
    // both halves of the pair from the token layer.
    const plain = ruleText(patternsCss, ".dsv-cal-day");
    expect(plain).toContain("color: var(--color-text)");
    expect(plain).toContain("background: var(--color-surface)");
    // The named range case must stay >= 4.5:1 (audit: 11.12:1 now).
    expect(ruleText(patternsCss, ".dsv-cal-day.is-range")).toContain(
      "var(--color-accent-subtle)",
    );
    expect(contrast(perp.text, perp.accentSubtle)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(perp.text, perp.selected)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps disabled buttons and labels readable with disabled-surface tokens", () => {
    // .dsv-btn:disabled used opacity: 0.5, dropping on-accent/accent to
    // 2.40:1 and accent-text/accent-subtle to 3.25:1.
    expect(galleryCss).toContain(".dsv-btn:disabled, .dsv-btn[data-disabled]");
    expect(galleryCss).toContain("background: var(--color-surface-disabled)");
    expect(contrast(perp.textMuted, perp.surfaceDisabled)).toBeGreaterThanOrEqual(4.5);
    // .dsv-control-label--disabled used opacity: 0.48 -> 4.47:1.
    expect(ruleText(formsCss, ".dsv-control-label--disabled")).toContain(
      "var(--color-text-muted)",
    );
    expect(contrast(perp.textMuted, perp.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("darkens the solid badges enough for the existing on-<variant> text", () => {
    // audit: on-warning/warning 3.84:1, on-success/success 4.18:1,
    // on-info/info 4.26:1.
    expect(ruleText(galleryCss, ".dsv-badge--warning-solid")).toContain(
      "var(--color-neutral-1000)",
    );
    expect(ruleText(galleryCss, ".dsv-badge--success-solid")).toContain(
      "var(--color-neutral-1000)",
    );
    expect(ruleText(galleryCss, ".dsv-badge--info-solid")).toContain(
      "var(--color-neutral-1000)",
    );
    expect(contrast(perp.onWarning, mix(perp.warning, perp.neutral1000, 80))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(perp.onSuccess, mix(perp.success, perp.neutral1000, 80))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(perp.onInfo, mix(perp.info, perp.neutral1000, 80))).toBeGreaterThanOrEqual(4.5);
  });

  it("uses the secondary text token for .dsv-muted inside a selected surface", () => {
    // audit: --color-text-muted on --color-selected = 3.97:1.
    expect(galleryCss).toContain(".dsv-list-item.is-selected .dsv-muted");
    expect(contrast(perp.textSecondary, perp.selected)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the banner on inverse surfaces readable with the same text-inverse pairing", () => {
    expect(ruleText(galleryCss, ".dsv-banner--on-dark")).toContain("var(--color-text-inverse)");
    // Ghost buttons on the light banner picked up --color-text-secondary
    // (rgb(210,208,199) on rgb(247,245,239) = 1.42:1).
    expect(galleryCss).toContain(".dsv-banner--on-dark .dsv-btn--ghost");
    expect(contrast(perp.textInverse, perp.surfaceInverse)).toBeGreaterThanOrEqual(4.5);
  });

  it("uses tokens for the inspector swatch ring instead of a raw black literal", () => {
    expect(tokenInspectorCss).not.toMatch(/rgba?\(0,\s*0,\s*0/);
    expect(tokenInspectorCss).toContain("var(--color-shadow)");
  });

  it("leaves no hex or rgb() literals on the hero/on-dark surfaces in screens.css", () => {
    expect(screensCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(screensCss).not.toMatch(/rgb\(255 255 255/);
    expect(screensCss).not.toMatch(/rgb\(0 0 0/);
  });

  it("pairs every gradient surface with the token that is light or dark *there*", () => {
    // The surfaces have opposite needs. Gemini 1's hero gradient is dark
    // (#14161d -> #08090c) so it needs the light token; its brand gradient is
    // bright (#ccff00 -> #00f0ff) so it needs the dark one. Applying
    // --color-neutral-50 to both (3ead660) fixed the hero and regressed the
    // brand to 1.05:1 / 1.26:1, down from 16.42:1 / 13.69:1.
    expect(contrast(gemini1.neutral50, gemini1.brandStart)).toBeLessThan(4.5);
    expect(contrast(gemini1.neutral50, gemini1.brandEnd)).toBeLessThan(4.5);
    expect(contrast(gemini1.textOnAccent, gemini1.brandStart)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(gemini1.textOnAccent, gemini1.brandEnd)).toBeGreaterThanOrEqual(4.5);

    // Regression (57d7a7c): gemini1's on-accent text #0d0e12 on its dark hero
    // gradient #14161d -> #08090c is 1.07:1 / 1.03:1 — dark-on-dark. The
    // lightest token is light on that gradient.
    expect(contrast(gemini1.textOnAccent, gemini1.heroStart)).toBeLessThan(4.5);
    expect(contrast(gemini1.textOnAccent, gemini1.heroEnd)).toBeLessThan(4.5);
    expect(contrast(gemini1.neutral50, gemini1.heroStart)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(gemini1.neutral50, gemini1.heroEnd)).toBeGreaterThanOrEqual(4.5);

    // Bright brand fill -> the token that is dark there. The brand tile must
    // not go back to the light token.
    const brand = ruleText(foundationCss, ".dsv-gradient-tile--brand");
    expect(brand).toContain("var(--color-text-on-accent)");
    expect(brand).not.toContain("var(--color-neutral-50)");

    // Dark gradients / on-dark surfaces -> the token that is light there.
    for (const [css, selector] of [
      [foundationCss, ".dsv-gradient-tile--fade"],
      [foundationCss, ".dsv-gradient-tile--hero"],
      [foundationCss, ".dsv-media-tile"],
      [foundationCss, ".dsv-overlay-tile > span"],
      [screensCss, ".dsv-badge--on-dark"],
      [screensCss, ".dsv-hero-panel"],
      [screensCss, ".dsv-hero-panel .dsv-display"],
      [screensCss, ".dsv-hero-img-cap"],
    ] as const) {
      const rule = ruleText(css, selector);
      expect(rule, selector).toContain("var(--color-neutral-50)");
      expect(rule, selector).not.toContain("var(--color-text-on-accent)");
    }
  });
});
