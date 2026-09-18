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
const tokenInspectorCss = read("./tokenInspector.css");
const screensCss = read("./components/screens/screens.css");
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

  it("sets color: inherit on .dsv-cal-day so range/selected days stop rendering black", () => {
    // audit: the button never set color, so .dsv-cal-day.is-range hit
    // rgb(0,0,0) on accent-subtle = 1.64:1
    expect(ruleText(patternsCss, ".dsv-cal-day")).toContain("color: inherit");
    expect(contrast(perp.text, perp.accentSubtle)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(perp.text, perp.selected)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the banner on inverse surfaces readable with the same text-inverse pairing", () => {
    expect(ruleText(galleryCss, ".dsv-banner--on-dark")).toContain("var(--color-text-inverse)");
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
});
