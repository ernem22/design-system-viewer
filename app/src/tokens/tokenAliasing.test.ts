// Issue #128: the token root was a flat literal set — semantic roles held
// copies of primitive values (`--color-accent: #4f46e5` duplicated
// `--color-brand-500`), so changing a primitive changed nothing and every
// theme restated its values. The audit asks for an explicit three-tier
// contract: tier 1 primitives are the only raw literals, tier 2 semantic roles
// alias them, tier 3 component tokens alias tier 2 or the shared scales. This
// guard reads the stylesheet text (happy-dom has no cascade, the same approach
// as headingScale.test.ts) and fails on the parent, where these roles are
// literals.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rawTokensCss = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");
const tokensCss = rawTokensCss.replace(/\/\*[\s\S]*?\*\//g, "");

/** The :root token map (first declaration wins), the same reader as
    compare/columnHeadingScale.test.ts. */
function rootTokens(): Map<string, string> {
  const scope = new Map<string, string>();
  for (const m of tokensCss.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/gi))
    if (!scope.has(m[1])) scope.set(m[1], m[2].trim());
  return scope;
}

const tokens = rootTokens();
const value = (name: string): string => {
  const found = tokens.get(name);
  expect(found, `${name} must be declared`).toBeDefined();
  return found as string;
};

const isPrimitive = (name: string): boolean =>
  /^--color-(brand|neutral)-\d+$/.test(name) || name === "--color-white";

/** The set of tier-1 primitive literal values. Every non-primitive literal
    must not repeat one of these. */
function primitiveValues(): Set<string> {
  const primitives = new Set<string>();
  for (const [name, declared] of tokens)
    if (isPrimitive(name)) primitives.add(declared.toLowerCase());
  return primitives;
}

describe("token architecture: primitive → semantic aliasing (issue #128)", () => {
  it("clear the headline claim: the brand/neutral ramps are the only literals", () => {
    // On the parent these two are identical literals, which is the defect.
    expect(value("--color-brand-500")).toBe("#4f46e5");
    expect(value("--color-accent")).toBe("var(--color-brand-500)");
  });

  it("aliases every accent/brand semantic role to its brand primitive", () => {
    const expected: Record<string, string> = {
      "--color-accent": "--color-brand-500",
      "--color-accent-hover": "--color-brand-600",
      "--color-accent-active": "--color-brand-700",
      "--color-accent-subtle": "--color-brand-50",
      "--color-accent-muted": "--color-brand-200",
      "--color-accent-border": "--color-brand-300",
      "--color-accent-text": "--color-brand-600",
      "--color-text-link": "--color-brand-500",
      "--color-text-link-hover": "--color-brand-600",
      "--color-focus-ring": "--color-brand-400",
      "--color-selected": "--color-brand-50",
      "--color-input-border-focus": "--color-brand-300",
      "--color-chart-1": "--color-brand-500",
    };
    for (const [role, primitive] of Object.entries(expected))
      expect(value(role), role).toBe(`var(${primitive})`);
  });

  it("aliases every neutral semantic role to its neutral primitive", () => {
    const expected: Record<string, string> = {
      "--color-text-secondary": "--color-neutral-600",
      "--color-text-muted": "--color-neutral-500",
      "--color-text-disabled": "--color-neutral-400",
      "--color-surface-disabled": "--color-neutral-200",
      "--color-border-disabled": "--color-neutral-300",
      "--color-icon-disabled": "--color-neutral-400",
      "--color-input-placeholder": "--color-neutral-400",
      "--color-input-bg-hover": "--color-neutral-50",
      "--color-input-bg-disabled": "--color-neutral-200",
      "--color-input-icon": "--color-neutral-500",
      "--color-chart-axis": "--color-neutral-400",
    };
    for (const [role, primitive] of Object.entries(expected))
      expect(value(role), role).toBe(`var(${primitive})`);
  });

  it("keeps white in one primitive and aliases every surface/on-colour to it", () => {
    expect(value("--color-white")).toBe("#ffffff");
    for (const role of [
      "--color-surface",
      "--color-text-inverse",
      "--color-on-accent",
      "--color-on-success",
      "--color-on-warning",
      "--color-on-danger",
      "--color-on-info",
    ])
      expect(value(role), role).toBe("var(--color-white)");
    expect(value("--color-surface-raised")).toBe("var(--color-surface)");
    expect(value("--color-surface-overlay")).toBe("var(--color-surface)");
  });

  it("leaves no non-primitive role repeating a primitive literal", () => {
    const primitives = primitiveValues();
    const offenders: string[] = [];
    for (const [name, declared] of tokens) {
      if (isPrimitive(name)) continue;
      if (/^#[0-9a-fA-F]{6}$/.test(declared) && primitives.has(declared.toLowerCase()))
        offenders.push(`${name}: ${declared}`);
    }
    expect(offenders, offenders.join(", ")).toEqual([]);
  });

  it("collapses the duplicate concept tokens onto one source", () => {
    expect(value("--color-text-on-accent")).toBe("var(--color-on-accent)");
    expect(value("--color-input-bg")).toBe("var(--color-surface)");
    expect(value("--color-input-border")).toBe("var(--color-border)");
    expect(value("--color-input-text")).toBe("var(--color-text)");
    expect(value("--overlay-opacity")).toBe("var(--opacity-overlay)");
    expect(value("--avatar-ring-color")).toBe("var(--color-surface)");
  });

  it("aliases the display type scale into the base scale", () => {
    const expected: Record<string, string> = {
      "--font-size-display-xs": "--font-size-4xl",
      "--font-size-display-sm": "--font-size-5xl",
      "--font-size-display-md": "--font-size-6xl",
      "--font-size-display-lg": "--font-size-7xl",
    };
    for (const [role, step] of Object.entries(expected))
      expect(value(role), role).toBe(`var(${step})`);
  });

  it("aliases the composition aspect ratios into the media scale", () => {
    for (const name of ["wide", "standard", "square", "portrait"])
      expect(value(`--composition-aspect-${name}`), name).toBe(`var(--media-aspect-${name})`);
  });

  it("sources every elevation/focus recipe from a shared token", () => {
    expect(value("--shadow-focus")).toContain("var(--color-focus-ring)");
    expect(value("--shadow-outline")).toContain("var(--color-accent)");
    for (const name of ["--shadow-xs", "--shadow-sm", "--shadow-md", "--shadow-lg", "--shadow-xl", "--shadow-2xl", "--shadow-inner"])
      expect(value(name), name).toContain("var(--shadow-color)");
    for (const name of ["--color-scrim", "--color-shadow", "--color-hover-overlay", "--color-active-overlay", "--color-pressed-overlay", "--media-overlay", "--media-overlay-subtle", "--media-overlay-strong"])
      expect(value(name), name).toContain("var(--shadow-color)");
  });
});
