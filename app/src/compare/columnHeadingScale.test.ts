// Issue #117 follow-up (PR #163): the heading scale aliases a type step
// (--heading-label: var(--font-size-sm)), but a Compare column re-scopes every
// --font-size-* inline (CompareColumn.tsx:44, useCompareView.ts:137-142). So
// inside .cmp-col the alias resolves against that system's scale, not :root: in
// gs5 (sm 13px, base 14px) the column head fell to 13px over 14px body copy —
// the same inversion #117 removed, now keyed to the column's system.
// headingScale.test.ts only reads the :root literals, so it cannot see this.
//
// happy-dom has no cascade, so this guard reads the stylesheet text and
// resolves it the way the browser would: take the head's font-size role,
// resolve that role's type-step alias inside a system's column scope, and
// compare with the body copy the column introduces (--font-size-base).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT_PX = 16;

function readFile(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
}

const compareCss = readFile("./compare.css");
const tokensCss = readFile("../tokens/tokens.css");

// Media queries contain braces, so match innermost `selector { body }` pairs
// and split grouped selectors — same reader as headingScale.test.ts.
function declarationsFor(css: string, selector: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m !== null; m = re.exec(css)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.includes(selector)) bodies.push(m[2]);
  }
  return bodies;
}

/** The single declaration of `prop` on `selector`, anchored so `font-size:`
    never matches the `--font-size-*` custom properties in the same body. */
function declaration(css: string, selector: string, prop: string): string {
  const values = declarationsFor(css, selector)
    .map((body) => new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+)`).exec(body)?.[1]?.trim())
    .filter((value): value is string => value !== undefined);
  expect(values, `${selector} must declare exactly one ${prop}`).toHaveLength(1);
  return values[0];
}

/** The :root token map from tokens.css (first declaration wins), overlaid with
    a system's authored tokens — exactly the scope .cmp-col paints inline. */
type Scope = Map<string, string>;

function rootScope(): Scope {
  const scope: Scope = new Map();
  for (const m of tokensCss.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/gi))
    if (!scope.has(m[1])) scope.set(m[1], m[2].trim());
  return scope;
}

function systemScope(systemJson: string): Scope {
  const scope = rootScope();
  const sys = JSON.parse(readFile(systemJson)) as {
    groups: Array<{ tokens: Array<{ name: string; value: string }> }>;
  };
  for (const group of sys.groups)
    for (const token of group.tokens) scope.set(token.name, token.value);
  return scope;
}

/** Resolve a value to px through the scope's custom properties. */
function toPx(value: string, scope: Scope): number {
  const ref = value.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (ref) {
    const next = scope.get(ref[1]);
    expect(next, `${ref[1]} must resolve in the column scope`).toBeDefined();
    return toPx(next as string, scope);
  }
  const rem = value.match(/^([\d.]+)rem$/);
  if (rem) return parseFloat(rem[1]) * ROOT_PX;
  const px = value.match(/^([\d.]+)px$/);
  if (px) return parseFloat(px[1]);
  throw new Error(`cannot read a size from "${value}"`);
}

const headSize = declaration(compareCss, ".cmp-col-head", "font-size");
// The role the head draws at, rebound locally if the surface scopes one
// (a plain custom property), else the global :root alias.
const scopedRole = declarationsFor(compareCss, ".cmp-col-head")
  .map((body) => /(?:^|;)\s*--heading-label:\s*([^;]+)/.exec(body)?.[1]?.trim())
  .filter((value): value is string => value !== undefined)[0];
const roleValue = scopedRole ?? declaration(tokensCss, ":root", "--heading-label");

// Shipped systems whose body step is at or above their sm step — the shapes
// that invert a label-sized head. gs5 is the reviewer's example.
const SYSTEMS = ["gs5", "genspark", "gs3", "ds-new3", "perp2"];

describe("scoped column heading scale (issue #117)", () => {
  it("draws the head from the label role", () => {
    expect(headSize).toBe("var(--heading-label)");
  });

  it("keeps the column head >= the body copy it introduces in every system", () => {
    const inverted = SYSTEMS.map((slug) => {
      const scope = systemScope(`../../../systems/${slug}.json`);
      return { slug, head: toPx(roleValue, scope), body: toPx("var(--font-size-base)", scope) };
    }).filter(({ head, body }) => head < body);
    expect(
      inverted,
      inverted.map(({ slug, head, body }) => `${slug}: ${head}px head over ${body}px copy`).join(", "),
    ).toEqual([]);
  });
});
