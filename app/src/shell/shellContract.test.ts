// CSS-level guard for the shell layout contract (issue #94). happy-dom has no
// layout engine, so a DOM test cannot observe the shell scrolling; the
// invariant is read from the stylesheet text instead. `overflow: clip` forbids
// scrolling, while `overflow: hidden` only hides the scrollbar and leaves the
// shell programmatically scrollable by a native fragment link.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// vitest runs with cwd = app/, so the co-located stylesheet resolves from there.
const shellCss = readFileSync(
  resolve(process.cwd(), "src/shell/shell.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

// Media-query wrappers contain braces, so match innermost `selector { body }`
// pairs — the selector is the text between the previous `}` and the `{`.
// A selector is matched once per rule, so a media-query re-declaration of
// `.app-shell` is collected alongside its base rule.
function declarationsFor(selector: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(shellCss); m !== null; m = re.exec(shellCss)) {
    if (m[1].trim() === selector) bodies.push(m[2]);
  }
  return bodies;
}

// Per the standard: the shell's layout containers. `.app-props-clip` is the
// props-side twin of `.app-rail-clip`, so it carries the same contract.
const LAYOUT_CONTAINERS = [
  ".app-shell",
  ".app-rail",
  ".app-rail-clip",
  ".app-rail-inner",
  ".app-main",
  ".app-props",
  ".app-props-clip",
];

describe("shell layout contract", () => {
  it("makes .app-shell non-scrollable with overflow: clip", () => {
    const shell = declarationsFor(".app-shell").join("\n");
    expect(shell).toMatch(/overflow:\s*clip\b/);
    expect(shell).not.toMatch(/overflow:\s*hidden\b/);
  });

  it("never uses overflow: hidden on a shell layout container", () => {
    const offenders = LAYOUT_CONTAINERS.filter((selector) =>
      declarationsFor(selector).some((body) =>
        /overflow:\s*hidden\b/.test(body),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("sizes the topbar row from --app-topbar-height, not a literal", () => {
    const rows = declarationsFor(".app-shell")
      .flatMap((body) => body.match(/grid-template-rows:[^;]*/g) ?? [])
      .join(" ");
    expect(rows).toContain("var(--app-topbar-height)");
    expect(rows).not.toMatch(/\d+px/);
  });
});
