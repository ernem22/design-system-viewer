// Narrow-viewport contract (issue #326). happy-dom has no layout engine, so
// a DOM test cannot observe the source buttons running past the dialog edge
// at 390px; the invariants are read from the stylesheet text instead, the
// way shell/shellContract.test.ts does. The running-app geometry
// (scrollWidth <= clientWidth, every button inside the dialog at 390x844 and
// 360x740, unchanged one-row tools at 1440x900) was measured by hand.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// vitest runs with cwd = app/, so the co-located stylesheet resolves from here.
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const dialogCss = stripComments(
  readFileSync(resolve(process.cwd(), "src/systems/AddSystemDialog.css"), "utf8"),
);

// Collect the bodies of every `@media (max-width: 600px) { ... }` block,
// balancing braces so nested rule blocks stay inside their media body.
function mediaBodies(css: string): string[] {
  const bodies: string[] = [];
  const head = /@media\s*\(\s*max-width\s*:\s*600px\s*\)\s*\{/g;
  for (let m = head.exec(css); m !== null; m = head.exec(css)) {
    let depth = 1;
    let i = head.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") depth -= 1;
      i += 1;
    }
    bodies.push(css.slice(head.lastIndex, i - 1));
  }
  return bodies;
}

// Match innermost `selector { body }` pairs inside the given CSS text — the
// selector is the text between the previous `}` and the `{`. A grouped
// selector defines both members, so split it and match by membership.
function declarationsFor(css: string, selector: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m !== null; m = re.exec(css)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.includes(selector)) bodies.push(m[2]);
  }
  return bodies;
}

describe("add-system dialog narrow-viewport contract (issue #326)", () => {
  it("wraps .app-import-tools in a max-width: 600px block", () => {
    const narrow = mediaBodies(dialogCss).join("\n");
    expect(narrow, "missing @media (max-width: 600px) in AddSystemDialog.css").toContain(
      ".app-import-tools",
    );
    const tools = declarationsFor(narrow, ".app-import-tools").join("\n");
    expect(tools).toMatch(/flex-wrap:\s*wrap\b/);
  });

  it("keeps the desktop tools on one row outside the narrow block", () => {
    const base = dialogCss.replace(/@media[^{]*\{([^{}]*\{[^{}]*\}[^{}]*)*\}/g, "");
    const tools = declarationsFor(base, ".app-import-tools").join("\n");
    expect(tools).toMatch(/flex-wrap:\s*nowrap\b/);
  });

  it("keeps the close button in the header's first row, at the end", () => {
    const narrow = mediaBodies(dialogCss).join("\n");
    const close = declarationsFor(narrow, ".app-import-close").join("\n");
    expect(close, ".app-import-close must sit at the end of the first row").toMatch(
      /margin-left:\s*auto\b/,
    );
  });

  it("lets the stepper wrap without cutting a label", () => {
    const narrow = mediaBodies(dialogCss).join("\n");
    expect(narrow).toContain(".app-import-steps");
    const steps = declarationsFor(narrow, ".app-import-steps").join("\n");
    expect(steps).toMatch(/flex-wrap:\s*wrap\b/);
  });

  it("never uses overflow: hidden in the narrow blocks", () => {
    for (const body of mediaBodies(dialogCss)) {
      expect(body, "narrow block").not.toMatch(/overflow:\s*hidden\b/);
    }
  });

  it("sizes the narrow blocks from tokens, not literal px", () => {
    for (const body of mediaBodies(dialogCss)) {
      expect(body, "narrow block must not contain literal px sizes").not.toMatch(/\d+px/);
    }
  });
});
