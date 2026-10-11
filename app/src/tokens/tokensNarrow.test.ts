// Narrow-viewport contract (issue #311). happy-dom has no layout engine, so
// a DOM test cannot observe the toolbar running past 390px or the row tracks
// shrinking to 54/45/62px; the invariants are read from the stylesheet text
// instead, the way shell/shellContract.test.ts does. The running-app geometry
// (getBoundingClientRect, scrollWidth, no horizontal scroll at 390x844 and
// 360x740, unchanged desktop grid at 1440x900) was measured by hand.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// vitest runs with cwd = app/, so the co-located stylesheets resolve from there.
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const toolbarCss = stripComments(
  readFileSync(resolve(process.cwd(), "src/tokens/TokenToolbar.css"), "utf8"),
);
const rowsCss = stripComments(
  readFileSync(resolve(process.cwd(), "src/tokens/rows.css"), "utf8"),
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

describe("tokens narrow-viewport contract (issue #311)", () => {
  it("wraps the toolbar in a max-width: 600px block", () => {
    const narrow = mediaBodies(toolbarCss).join("\n");
    expect(narrow, "missing @media (max-width: 600px) in TokenToolbar.css").toContain(
      ".tok-toolbar",
    );
    const toolbar = declarationsFor(narrow, ".tok-toolbar").join("\n");
    expect(toolbar).toMatch(/flex-wrap:\s*wrap\b/);
  });

  it("restacks .tok-row into a two-line grid in a max-width: 600px block", () => {
    const narrow = mediaBodies(rowsCss).join("\n");
    expect(narrow, "missing @media (max-width: 600px) in rows.css").toContain(".tok-row");
    const row = declarationsFor(narrow, ".tok-row").join("\n");
    expect(row).toMatch(/grid-template-(columns|areas)\s*:/);
  });

  it("never hides a toolbar control with display: none at narrow widths", () => {
    const narrow = mediaBodies(toolbarCss).join("\n");
    for (const selector of [".tok-search", ".tok-actions", ".tok-btn", ".tok-inline"]) {
      const hidden = declarationsFor(narrow, selector).some((body) =>
        /display:\s*none\b/.test(body),
      );
      expect(hidden, `${selector} must not be display: none`).toBe(false);
    }
  });

  it("never uses overflow: hidden in the narrow blocks", () => {
    for (const [label, css] of [
      ["TokenToolbar.css", toolbarCss],
      ["rows.css", rowsCss],
    ] as const) {
      for (const body of mediaBodies(css)) {
        expect(body, `${label} narrow block`).not.toMatch(/overflow:\s*hidden\b/);
      }
    }
  });
});
