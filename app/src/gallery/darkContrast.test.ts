/**
 * Pins the issue #109 dark-variant repairs at the source-text level: each
 * assertion names a pairing the parent commit got wrong, so this suite is RED
 * before the fix and GREEN after it. The live count (and the sweep that
 * produced it) lives in `app/tools/contrast-sweep.js`; the ratios below are
 * the resolved values for the active Aurora dark map.
 *
 * Vitest runs in the `node` environment, so the stylesheets are read from
 * disk relative to this file rather than via Vite's `?raw` (empty in node).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const patternsCss = read("./components/patterns.css");
const galleryCss = read("./gallery.css");
const formsCss = read("./components/forms.css");
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

/** Whitespace-tolerant single-rule lookup (bodies wrap over lines). */
function ruleText(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  if (at === -1) return "";
  const end = css.indexOf("}", at);
  return css.slice(at, end === -1 ? undefined : end);
}

// Aurora's dark variant (systems/aurora.json) — the map the issue measured.
const DARK = {
  text: "#f1f5f9", // --color-text
  selected: "#1e1b4b", // --color-selected / --color-accent-subtle
  textInverse: "#0f172a", // --color-text-inverse
  surfaceInverse: "#f8fafc", // --color-surface-inverse
  surfaceDisabled: "#1e293b", // --color-surface-disabled
  textSecondary: "#cbd5e1", // --color-text-secondary
};

describe("issue #109 dark-variant contrast repairs", () => {
  it("keeps the two named pairs at or above AA in the dark map", () => {
    expect(contrast(DARK.text, DARK.selected)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(DARK.textInverse, DARK.surfaceInverse)).toBeGreaterThanOrEqual(4.5);
    // And the broken pairs the issue measured, for the record.
    expect(contrast("#000000", DARK.selected)).toBeLessThan(4.5);
    expect(contrast("#ffffff", DARK.surfaceInverse)).toBeLessThan(4.5);
  });

  it("gives the calendar day a themed token pair on the base class", () => {
    const rule = ruleText(patternsCss, ".dsv-cal-day");
    expect(rule).toContain("color: var(--color-text)");
    expect(rule).toContain("background: var(--color-surface)");
    expect(contrast(DARK.text, DARK.selected)).toBeGreaterThanOrEqual(4.5);
  });

  it("pairs the inverse panel with the inverse text token, not text-on-accent", () => {
    const panel = foundationTsx.slice(foundationTsx.indexOf("var(--color-surface-inverse)"));
    expect(panel.slice(0, 200)).toContain('color: "var(--color-text-inverse)"');
    expect(panel.slice(0, 200)).not.toContain("var(--color-text-on-accent)");
    expect(ruleText(galleryCss, ".dsv-banner--on-dark")).toContain("var(--color-text-inverse)");
    expect(contrast(DARK.textInverse, DARK.surfaceInverse)).toBeGreaterThanOrEqual(4.5);
  });

  it("scopes the on-dark ghost button to the inverse text token", () => {
    const rule = ruleText(screensCss, ".dsv-banner--on-dark .dsv-btn--on-dark-ghost");
    expect(rule).toContain("var(--color-text-inverse)");
  });

  it("replaces disabled opacity with the disabled-surface token pair", () => {
    const rule = ruleText(galleryCss, ".dsv-btn:disabled, .dsv-btn[data-disabled]");
    expect(rule).toContain("background: var(--color-surface-disabled)");
    expect(rule).toContain("color: var(--color-text-secondary)");
    expect(rule).not.toContain("opacity: 0.5");
    expect(ruleText(formsCss, ".dsv-control-label--disabled")).toContain(
      "var(--color-text-muted)",
    );
    expect(ruleText(formsCss, ".dsv-control-label--disabled")).not.toContain("opacity");
  });

  it("keeps the disabled boxes readable without an opacity veil", () => {
    expect(ruleText(formsCss, ".dsv-disabled-box")).toContain("var(--color-text-secondary)");
    const dim = ruleText(formsCss, ".dsv-disabled-box--dim");
    expect(dim).toContain("var(--color-text-secondary)");
    expect(dim).not.toContain("opacity");
  });

  it("gives the section-rhythm pad labels an accent-aware text token", () => {
    expect(foundationTsx).toContain('color: "var(--color-accent-text)"');
  });
});
