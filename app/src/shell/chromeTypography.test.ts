// CSS-level guard for the viewer's own typography (issue #112): the chrome
// must render in the design system it displays, not the platform font. The
// live app resolves these through tokens; happy-dom has no cascade, so the
// invariants are read from the stylesheet text — same approach as
// shellContract.test.ts. A stylesheet-text assertion cannot prove the running
// cascade; it proves the chrome CSS names no platform font and no raw size,
// and that the base rules route through the token layer.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// vitest runs with cwd = app/, so the co-located stylesheets resolve from there.
function readCss(...parts: string[]): string {
  return readFileSync(resolve(process.cwd(), "src", ...parts), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
}

// The old comment in shellContract.test.ts still holds: media queries contain
// braces, so match innermost `selector { body }` pairs and split a grouped
// selector (`button, input { ... }`) into its members. A selector declared
// again inside a media query is collected alongside its base rule.
function declarationsFor(css: string, selector: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m !== null; m = re.exec(css)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.includes(selector)) bodies.push(m[2]);
  }
  return bodies;
}

const indexCss = readCss("index.css");
const shellCss = readCss("shell", "shell.css");
const toolbarCss = readCss("tokens", "TokenToolbar.css");
const tokensCss = readCss("tokens", "tokens.css");

// The chrome's own stylesheets — the token root is allowed to hold the single
// fallback chain, these three are not allowed to name a platform font.
const CHROME_CSS: Array<[string, string]> = [
  ["index.css", indexCss],
  ["shell.css", shellCss],
  ["TokenToolbar.css", toolbarCss],
];

describe("viewer chrome typography (issue #112)", () => {
  it("resolves :root font-family from the token layer, not a platform literal", () => {
    const root = declarationsFor(indexCss, ":root").join("\n");
    expect(root).toMatch(/font-family:\s*var\(--font-sans\)/);
    expect(root).not.toMatch(/\bArial\b|\bHelvetica\b|\bAvenir\b/);
  });

  it("keeps the system's fallback chain on --font-sans", () => {
    const root = declarationsFor(tokensCss, ":root").join("\n");
    const declared = root.match(/--font-sans:\s*([^;]+);/);
    expect(declared).not.toBeNull();
    // A generic family last so a system with no font tokens still renders.
    expect(declared![1]).toMatch(/sans-serif\s*$/);
  });

  it("makes native controls inherit the system stack instead of the UA Arial", () => {
    for (const selector of ["button", "input", "select", "textarea"]) {
      expect(declarationsFor(indexCss, selector).join("\n"), selector).toMatch(
        /font-family:\s*inherit/,
      );
    }
  });

  it("routes the chrome root and its controls through --font-sans", () => {
    expect(declarationsFor(shellCss, ".app-shell").join("\n")).toMatch(
      /font-family:\s*var\(--font-sans\)/,
    );
    expect(declarationsFor(shellCss, ".app-tabs button").join("\n")).toMatch(
      /font-family:\s*var\(--font-sans\)/,
    );
    expect(declarationsFor(toolbarCss, ".tok-btn").join("\n")).toMatch(
      /font-family:\s*var\(--font-sans\)/,
    );
  });

  it("never names a platform font literal in a chrome font-family", () => {
    const offenders: string[] = [];
    for (const [name, css] of CHROME_CSS) {
      for (const m of css.matchAll(/font-family:\s*([^;]+);/g)) {
        if (/\bArial\b|\bHelvetica\b|\bAvenir\b/.test(m[1])) {
          offenders.push(`${name}: font-family: ${m[1].trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("sources every chrome font-size from the token scale", () => {
    const offenders: string[] = [];
    for (const [name, css] of CHROME_CSS) {
      for (const m of css.matchAll(/font-size:\s*([^;]+);/g)) {
        if (!m[1].includes("var(--font-size-")) {
          offenders.push(`${name}: font-size: ${m[1].trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("gives the rail's Accordion <h3> a token size, not the UA default", () => {
    const heading = declarationsFor(shellCss, ".app-rail-group > h3").join("\n");
    expect(heading).toMatch(/font-size:\s*var\(--font-size-/);
    expect(heading).toMatch(/font-family:\s*var\(--font-sans\)/);
  });
});
