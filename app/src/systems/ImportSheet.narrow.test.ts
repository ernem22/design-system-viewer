// Narrow-viewport contract. happy-dom has no layout engine, so the invariants
// are read from the stylesheet text, the way shell/shellContract.test.ts does.
// The running-app geometry (single column, no horizontal overflow, sheet inside
// the viewport at 390x844 and 360x740) was measured by hand.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// vitest runs with cwd = app/, so the co-located stylesheet resolves from here.
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const sheetCss = stripComments(
  readFileSync(resolve(process.cwd(), "src/systems/ImportSheet.css"), "utf8"),
);

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

function declarationsFor(css: string, selector: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m !== null; m = re.exec(css)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.includes(selector)) bodies.push(m[2]);
  }
  return bodies;
}

describe("import sheet narrow-viewport contract", () => {
  it("wraps the source line and the footer actions in a max-width: 600px block", () => {
    const narrow = mediaBodies(sheetCss).join("\n");
    expect(narrow, "missing @media (max-width: 600px) in ImportSheet.css").not.toBe("");
    expect(declarationsFor(narrow, ".app-import-sourcebar").join("\n")).toMatch(/row-gap:/);
    expect(declarationsFor(narrow, ".app-import-actions").join("\n")).toMatch(/flex-wrap:\s*wrap\b/);
    expect(declarationsFor(narrow, ".app-import-identityrow").join("\n")).toMatch(
      /flex-wrap:\s*wrap\b/,
    );
  });

  it("lets the sheet size to the viewport without a fixed height", () => {
    const narrow = mediaBodies(sheetCss).join("\n");
    const sheet = declarationsFor(narrow, ".tok-dialog.app-import-sheet").join("\n");
    expect(sheet).toMatch(/height:\s*auto\b/);
    expect(sheet).toMatch(/max-height:\s*90vh\b/);
  });

  it("never uses overflow: hidden in the narrow blocks", () => {
    for (const body of mediaBodies(sheetCss)) {
      expect(body, "narrow block").not.toMatch(/overflow:\s*hidden\b/);
    }
  });

  it("sizes the narrow blocks from tokens, not literal px", () => {
    for (const body of mediaBodies(sheetCss)) {
      expect(body, "narrow block must not contain literal px sizes").not.toMatch(/\d+px/);
    }
  });
});
