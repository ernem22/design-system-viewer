/**
 * Pins the WCAG repair for issue #87's second finding at the source-text
 * level: `.tok-btn-danger` used `--color-danger`, a fill token, on
 * `--color-surface-raised`. Measured live (`?sys=perp-ultra-v2`, Dark
 * unchecked): rgb(182,79,66) on rgb(42,43,39) = 2.84:1, below AA. The fix
 * pairs the danger *text* token with its designed `-subtle` surface — the same
 * pairing #88 used for the gallery's error text. The first assertion names a
 * pairing the parent commit got wrong, so it fails before the fix and passes
 * after it.
 *
 * Issue #87's blocker (the Contrast section reading the dark palette in light
 * mode) is not covered here: #22's merged fix (TokensView feeds the section
 * `view.valueMap`) already closed it, so no assertion about it is RED on this
 * branch's parent.
 *
 * Vitest runs in the `node` environment, where Vite's `?raw` suffix resolves to
 * an empty string — the stylesheets are read from disk instead, relative to
 * `import.meta.url` so the test works from any cwd.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const toolbarCss = read("./TokenToolbar.css");
const tokensCss = read("./tokens.css");

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** `#rgb` / `#rrggbb` / `rgb()` / `rgba()` — the forms the system tokens use. */
function parseColor(value: string): Rgba | null {
  const v = value.trim();
  if (v.startsWith("#")) {
    const h = v.slice(1);
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    if (full.length !== 6) return null;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(/[, ]+/).map(Number);
  if (parts.length < 3) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}

/** Alpha-composite `fg` over opaque `bg`. */
function over(fg: Rgba, bg: Rgba): Rgba {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

function luminance({ r, g, b }: Rgba): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(fg: Rgba, bg: Rgba): number {
  const la = luminance(fg);
  const lb = luminance(bg);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function must(value: string): Rgba {
  const c = parseColor(value);
  if (!c) throw new Error(`unparsable colour: ${value}`);
  return c;
}

/** Whitespace-tolerant rule lookup, same shape as gallery/contrast.test.ts. */
function ruleText(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  if (at === -1) return "";
  const end = css.indexOf("}", at);
  return css.slice(at, end === -1 ? undefined : end);
}

/**
 * Every light-mode system whose `.tok-btn-danger` pairing failed on the parent
 * commit (measured live), worst first. Values are read from `systems/<slug>.json`:
 * `danger` on `surfaceRaised` is the audited (parent) pairing, `dangerText` over
 * `dangerSubtle` on `surfaceRaised` is the repaired one. `before` is the
 * measured parent ratio.
 */
const failing = [
  { slug: "perp-ultra-v2", danger: "#b64f42", surfaceRaised: "#2a2b27", dangerText: "#84372f", dangerSubtle: "#f8e9e5", before: 2.84 },
  { slug: "minimax", danger: "#ef4444", surfaceRaised: "#ffffff", dangerText: "#991b1b", dangerSubtle: "#fef2f2", before: 3.76 },
  { slug: "gemini-new-2", danger: "#dc2626", surfaceRaised: "#e4e4e7", dangerText: "#b91c1c", dangerSubtle: "#fef2f2", before: 3.81 },
  { slug: "perp", danger: "#c8655c", surfaceRaised: "#2b2723", dangerText: "#e18a82", dangerSubtle: "#38201f", before: 3.86 },
  { slug: "perp3", danger: "#d5746c", surfaceRaised: "#22303b", dangerText: "#e99991", dangerSubtle: "#3c2424", before: 4.21 },
  { slug: "untitled", danger: "#EF4444", surfaceRaised: "#1F1F1F", dangerText: "#F87171", dangerSubtle: "rgba(239,68,68,0.10)", before: 4.38 },
  { slug: "ds-new4", danger: "#E5484D", surfaceRaised: "#1B1B1F", dangerText: "#F08A8D", dangerSubtle: "#2A1213", before: 4.39 },
  { slug: "perp-new-1", danger: "#dc2626", surfaceRaised: "#f5f5f5", dangerText: "#991b1b", dangerSubtle: "#fee2e2", before: 4.43 },
  { slug: "perp-new3", danger: "#dc2626", surfaceRaised: "#f5f5f5", dangerText: "#991b1b", dangerSubtle: "#fee2e2", before: 4.43 },
] as const;

describe("issue #87 token-toolbar contrast repair", () => {
  it("pairs .tok-btn-danger with --color-danger-text on --color-danger-subtle", () => {
    const rule = ruleText(toolbarCss, ".tok-btn-danger");
    expect(rule).toContain("var(--color-danger-text)");
    expect(rule).toContain("var(--color-danger-subtle)");
    // The fill token that failed must no longer be the text colour.
    expect(rule).not.toContain("var(--color-danger)");
  });

  it("ships the danger text/-subtle pair in the single token root", () => {
    // The pairing must resolve even for a system that omits these names.
    expect(tokensCss).toMatch(/--color-danger-text\s*:/);
    expect(tokensCss).toMatch(/--color-danger-subtle\s*:/);
  });

  it("clears AA (4.5:1) for every system where the fill token failed", () => {
    for (const s of failing) {
      const surface = must(s.surfaceRaised);
      // Parent pairing: --color-danger on --color-surface-raised, below AA.
      expect(ratio(must(s.danger), surface), `${s.slug} before`).toBeLessThan(4.5);
      // Repaired pairing: --color-danger-text over --color-danger-subtle on it.
      const after = ratio(must(s.dangerText), over(must(s.dangerSubtle), surface));
      expect(after, `${s.slug} after`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
