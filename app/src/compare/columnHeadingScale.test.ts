// @vitest-environment happy-dom
// Issue #117 follow-up (PR #163): the heading scale aliases a type step
// (--heading-column: var(--font-size-lg)), and a Compare column re-scopes every
// --font-size-* inline (CompareColumn.tsx; useCompareView.ts builds the map).
// But a custom property substitutes where it is DECLARED, not where it is used:
// a --heading-column declared only at :root is computed once against :root's
// --font-size-lg (18px) and every .cmp-col inherits that fixed px, ignoring the
// column's own lg (ds-new2 19px, gs5 16px). headingScale.test.ts reads the
// :root literals only; happy-dom has no cascade, so this guard renders the
// column, reads the role where the component actually declares it, and
// resolves that declaration in its real scope.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import type { CSSProperties } from "react";
import type { Root } from "react-dom/client";
import { CompareColumn } from "./CompareColumn.tsx";
import type { ComparableOption } from "./registry.tsx";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

/** The :root token map from tokens.css (first declaration wins). */
type Scope = Map<string, string>;

function rootScope(): Scope {
  const scope: Scope = new Map();
  for (const m of tokensCss.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/gi))
    if (!scope.has(m[1])) scope.set(m[1], m[2].trim());
  return scope;
}

function readSystem(systemJson: string): {
  groups: Array<{ tokens: Array<{ name: string; value: string }> }>;
} {
  return JSON.parse(readFile(systemJson));
}

/** Only the tokens a system authors — exactly what a .cmp-col paints inline
    (resolveSystemTokens), so a :root-only role is absent from the column. */
function systemInline(systemJson: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const group of readSystem(systemJson).groups)
    for (const token of group.tokens) out[token.name] = token.value;
  return out;
}

/** The scope a column's declarations substitute against: the system's inline
    tokens overlaid on :root. */
function systemScope(systemJson: string): Scope {
  const scope = rootScope();
  for (const [name, value] of Object.entries(systemInline(systemJson))) scope.set(name, value);
  return scope;
}

/** Resolve a value to px through the scope's custom properties. */
function toPx(value: string, scope: Scope): number {
  const ref = value.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (ref) {
    const next = scope.get(ref[1]);
    expect(next, `${ref[1]} must resolve in the scope`).toBeDefined();
    return toPx(next as string, scope);
  }
  const rem = value.match(/^([\d.]+)rem$/);
  if (rem) return parseFloat(rem[1]) * ROOT_PX;
  const px = value.match(/^([\d.]+)px$/);
  if (px) return parseFloat(px[1]);
  throw new Error(`cannot read a size from "${value}"`);
}

const headSize = declaration(compareCss, ".cmp-col-head", "font-size");
const role = headSize.match(/^var\((--heading-[a-z-]+)\)$/)?.[1];
// A role redeclared in compare.css's column scope (the component's inline
// declaration is read from the rendered column below).
const cssScopedRole = role
  ? [...declarationsFor(compareCss, ".cmp-col-head"), ...declarationsFor(compareCss, ".cmp-col")]
      .map((body) => new RegExp(`(?:^|;)\\s*${role}:\\s*([^;]+)`).exec(body)?.[1]?.trim())
      .filter((value): value is string => value !== undefined)[0]
  : undefined;
const rootRoleValue = role ? declaration(tokensCss, ":root", role) : "";

// Shipped systems whose type scale moves the head. ds-new2 lg = 1.1875rem
// (19px); gs5/genspark/gs4 lg = 16px — the reviewer's cases.
const SYSTEMS = ["ds-new2", "gs5", "genspark", "gs4", "ds-new3", "perp2"];
const EXPECTED_HEAD: Record<string, number> = { "ds-new2": 19, gs5: 16 };

let root: Root | null = null;
let host: HTMLDivElement | null = null;

const option: ComparableOption = { id: "probe", label: "Probe", Render: () => null };

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

/** Mount a column exactly as CompareView does — `style` is the system's inline
    token map — and return the `.cmp-col` element. */
async function renderColumn(style: Record<string, string>): Promise<HTMLElement> {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      createElement(CompareColumn, {
        slug: "s",
        name: "s",
        style: style as CSSProperties,
        pct: null,
        option,
      }),
    );
  });
  return host.querySelector(".cmp-col") as HTMLElement;
}

/** The head role's px in a column, resolved in the scope it is declared in:
    inline/compare.css in the .cmp-col scope, otherwise once at :root. */
async function headPx(slug: string): Promise<{ head: number; body: number }> {
  const systemJson = `../../../systems/${slug}.json`;
  const scope = systemScope(systemJson);
  const col = await renderColumn(systemInline(systemJson));
  const inline = col.style.getPropertyValue(role ?? "");
  const value = inline || cssScopedRole || rootRoleValue;
  const declScope = inline || cssScopedRole ? scope : rootScope();
  return { head: toPx(value, declScope), body: toPx("var(--font-size-base)", scope) };
}

describe("scoped column heading scale (issue #117)", () => {
  it("draws the head from a named heading role", () => {
    expect(role, `.cmp-col-head must draw a --heading-* role, got ${headSize}`).toBeDefined();
  });

  it("declares the head role inside the column scope, not only at :root", async () => {
    const col = await renderColumn(systemInline("../../../systems/ds-new2.json"));
    expect(
      col.style.getPropertyValue(role ?? ""),
      "CompareColumn must re-scope --heading-column inline like every other column token",
    ).not.toBe("");
  });

  it("keeps the column head >= the body copy it introduces in every system", async () => {
    const observed: Array<{ slug: string; head: number; body: number }> = [];
    for (const slug of SYSTEMS) observed.push({ slug, ...(await headPx(slug)) });

    for (const [slug, expected] of Object.entries(EXPECTED_HEAD))
      expect(observed.find((o) => o.slug === slug)!.head, `${slug} column head`).toBe(expected);

    const inverted = observed.filter(({ head, body }) => head < body);
    expect(
      inverted,
      inverted.map(({ slug, head, body }) => `${slug}: ${head}px head over ${body}px copy`).join(", "),
    ).toEqual([]);
  });
});
