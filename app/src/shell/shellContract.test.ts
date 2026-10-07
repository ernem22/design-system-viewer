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
// A grouped selector (`.app-topbar-left, .app-topbar-right { ... }`) defines
// both members, so split it and match by membership — otherwise the shared
// rule counts for neither. A re-declaration inside a media query is collected
// alongside the base rule.
function declarationsFor(selector: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(shellCss); m !== null; m = re.exec(shellCss)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.includes(selector)) bodies.push(m[2]);
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

// Issue #90: at 390px the fixed shell can be narrower than the topbar's
// content, so the topbar overflowed its own frame and the search input
// covered the tab triggers. The fix is structural — the side tracks shrink
// (minmax(0, 1fr)) and their clusters stretch rather than sizing to content.
// happy-dom has no layout engine, so, like the rules above, the invariant is
// read from the stylesheet text; the running-app overlap was measured by hand
// in the PR body.
describe("topbar narrow-viewport contract (issue #90)", () => {
  it("lets the side tracks shrink below their content", () => {
    const bar = declarationsFor(".app-topbar").join("\n");
    const columns = bar.match(/grid-template-columns:[^;]*/)?.[0] ?? "";
    expect(columns).toContain("minmax(0, 1fr)");
  });

  it("stretches the side clusters instead of shrink-wrapping them", () => {
    // The clusters are grouped with `.app-topbar-left`; match by selector
    // membership (like chromeTypography.test.ts) so the shared rule counts
    // for both, and a re-declared `justify-self: start|end` is caught.
    for (const selector of [".app-topbar-left", ".app-topbar-right"]) {
      const bodies = declarationsFor(selector);
      expect(bodies.some((b) => /justify-self:\s*stretch/.test(b)), selector).toBe(
        true,
      );
      expect(
        bodies.some((b) => /justify-self:\s*(start|end|center)/.test(b)),
        selector,
      ).toBe(false);
    }
  });
});

// Issue #134: the ≤900px block dropped the Preview-only chrome (coverage pill,
// search, edit-reset pill) and the ≤480px block dropped the brand
// and the copy-link action — the only in-app copy-link. `display: none` on a
// control a user needs is not a narrow-viewport fix, so the topbar now keeps
// every control and scrolls inside its own frame instead. Like the rules
// above, the invariants are read from the stylesheet text (happy-dom has no
// layout engine); the before/after geometry was measured in the running app.
describe("topbar keeps its functional controls at narrow widths (#134)", () => {
  it("never hides a functional topbar control with display: none", () => {
    const controls = [
      ".app-pill",
      ".app-topbar-cov",
      ".app-brand",
      ".app-topbar-search",
      '.app-iconbtn[aria-label="Copy link to this view"]',
    ];
    for (const selector of controls) {
      const hidden = declarationsFor(selector).some((body) =>
        /display:\s*none\b/.test(body),
      );
      expect(hidden, `${selector} must not be display: none`).toBe(false);
    }
  });

  it("scrolls the topbar inside its own frame rather than the shell", () => {
    const bar = declarationsFor(".app-topbar").join("\n");
    expect(bar).toMatch(/overflow-x:\s*auto\b/);
    // The shell stays the one non-scrolling frame; only .app-main scrolls.
    expect(declarationsFor(".app-shell").join("\n")).toMatch(/overflow:\s*clip\b/);
  });
});
