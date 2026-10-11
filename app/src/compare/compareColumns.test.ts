// Compare columns wrap instead of overflowing (issue #322). happy-dom has no
// layout engine, so the invariant is read from the stylesheet text like
// shell/shellContract.test.ts: with 4 systems the fixed
// `repeat(var(--cmp-n), minmax(240px, 1fr))` grid needed 4x240px plus gaps in
// an 882px content column (scrollWidth 1048 / clientWidth 882), cutting the
// fourth column mid-word behind a scrollbar-less `overflow-x: auto`.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// vitest runs with cwd = app/, so the co-located stylesheet resolves from there.
const compareCss = readFileSync(
  resolve(process.cwd(), "src/compare/compare.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

// Same innermost-pair matching as shellContract.test.ts: a re-declaration
// inside a media or container query is collected alongside its base rule.
function declarationsFor(selector: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(compareCss); m !== null; m = re.exec(compareCss)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.includes(selector)) bodies.push(m[2]);
  }
  return bodies;
}

describe("compare columns wrap instead of overflowing (issue #322)", () => {
  it("tracks .cmp-cols with auto-fit/auto-fill, or re-tracks it in a container query", () => {
    const tracks = declarationsFor(".cmp-cols")
      .flatMap((body) => body.match(/grid-template-columns:[^;]*/g) ?? [])
      .join(" ");
    const wraps = /auto-(fit|fill)/.test(tracks);
    // An attributed re-track (e.g. `.cmp-cols[data-count="4"]`) is not a
    // member of `.cmp-cols`, so it is matched in the raw text instead.
    const containerRetracks =
      /@container[^{]+\{[^@]*\.cmp-cols[^{]*\{[^}]*grid-template-columns/.test(
        compareCss,
      );
    expect(wraps || containerRetracks, tracks).toBe(true);
  });

  it("never scrolls .cmp-cols horizontally", () => {
    const scrollers = declarationsFor(".cmp-cols").filter((body) =>
      /overflow-x:\s*(auto|scroll)\b/.test(body),
    );
    expect(scrollers).toEqual([]);
  });

  it("keeps the 240px column minimum", () => {
    const cols = declarationsFor(".cmp-cols").join("\n");
    expect(cols).toMatch(/minmax\([^;]*240px/);
  });

  it("never uses overflow: hidden on a compare layout container", () => {
    const offenders = [".cmp-wrap", ".cmp-cols"].filter((selector) =>
      declarationsFor(selector).some((body) =>
        /overflow:\s*hidden\b/.test(body),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
