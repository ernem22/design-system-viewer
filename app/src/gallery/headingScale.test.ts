// Issue #117: one heading role was drawn at four sizes across the viewer —
// Tokens group 18px, Preview section 24px, Preview/Compare demo block 14px,
// props 12px — and on Preview the 14px block heading sat over 16px body copy,
// an inverted hierarchy. The fix is a heading scale in the token layer with
// one size per role. happy-dom has no cascade, so (like
// shell/chromeTypography.test.ts) this guard reads the stylesheet text: every
// chrome heading resolves its size from a named role token, the roles are
// strictly ordered, and the smallest role still clears the body/UI text it
// introduces.
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

// Media queries contain braces, so match innermost `selector { body }` pairs
// and split grouped selectors — same reader as shellContract.test.ts.
function declarationsFor(css: string, selector: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m !== null; m = re.exec(css)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.includes(selector)) bodies.push(m[2]);
  }
  return bodies;
}

function fontSizeOf(css: string, selector: string): string {
  const sizes = declarationsFor(css, selector)
    .map((body) => body.match(/font-size:\s*([^;]+)/)?.[1]?.trim())
    .filter((value): value is string => value !== undefined);
  expect(sizes, `${selector} must declare exactly one font-size`).toHaveLength(1);
  return sizes[0];
}

const tokensCss = readCss("tokens", "tokens.css");
const galleryCss = readCss("gallery", "gallery.css");
const compareCss = readCss("compare", "compare.css");
const tokenGroupCss = readCss("tokens", "TokenGroup.css");
const tokensPropsCss = readCss("tokens", "TokensProps.css");
const drawerCss = readCss("gallery", "tokenInspector.css");
const welcomeCss = readCss("shell", "Welcome.css");
const errorCss = readCss("shell", "ErrorBoundary.css");
const screensCss = readCss("gallery", "components", "screens", "screens.css");

const ROOT_PX = 16;

function tokenValue(css: string, name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*([^;]+);`));
  expect(match, `${name} must be declared`).not.toBeNull();
  return match![1].trim();
}

/** Resolve a heading-role token to px through its --font-size-* alias. */
function rolePx(role: string): number {
  const alias = tokenValue(tokensCss, role);
  const step = alias.match(/var\((--font-size-[a-z0-9-]+)\)/);
  expect(step, `${role} must alias a type-scale step`).not.toBeNull();
  const rem = tokenValue(tokensCss, step![1]).match(/([\d.]+)rem/);
  expect(rem, `${step![1]} must be a rem literal`).not.toBeNull();
  return parseFloat(rem![1]) * ROOT_PX;
}

// Every chrome heading and the role it must draw at — the surfaces the issue
// measured (Tokens, Preview, Compare, props) plus the shell's own headings.
const HEADINGS: Array<[selector: string, css: string, role: string]> = [
  [".dsv-section-head h2", galleryCss, "--heading-section"],
  [".tok-group > h2", tokenGroupCss, "--heading-section"],
  [".app-welcome h2", welcomeCss, "--heading-section"],
  [".app-error-title", errorCss, "--heading-section"],
  [".dsv-block-head h3", galleryCss, "--heading-subsection"],
  [".dsv-modal h3", galleryCss, "--heading-subsection"],
  [".dsv-drawer-head h3", drawerCss, "--heading-subsection"],
  [".dsv-empty h4", galleryCss, "--heading-subsection"],
  [".cmp-props-block h3", compareCss, "--heading-label"],
  [".tok-props-block h3", tokensPropsCss, "--heading-label"],
  [".dsv-kanban-col h4", screensCss, "--heading-label"],
  // A Compare column re-scopes --font-size-* inline, so its head names its own
  // role instead of overriding the shared label alias (issue #117 contrast).
  [".cmp-col-head", compareCss, "--heading-column"],
];

// Every heading role the token layer defines; one role must resolve to one
// size, so a surface may never redeclare any of them (that is exactly how
// --heading-label came to mean 18px in Compare and 14px elsewhere).
const HEADING_ROLES = [
  "--heading-section",
  "--heading-subsection",
  "--heading-label",
  "--heading-column",
];

const STYLESHEETS: Array<[name: string, css: string]> = [
  ["tokens/tokens.css", tokensCss],
  ["gallery/gallery.css", galleryCss],
  ["compare/compare.css", compareCss],
  ["tokens/TokenGroup.css", tokenGroupCss],
  ["tokens/TokensProps.css", tokensPropsCss],
  ["gallery/tokenInspector.css", drawerCss],
  ["shell/Welcome.css", welcomeCss],
  ["shell/ErrorBoundary.css", errorCss],
  ["gallery/components/screens/screens.css", screensCss],
];

function declarationCount(css: string, name: string): number {
  return (css.match(new RegExp(`${name}\\s*:`, "g")) ?? []).length;
}

describe("one heading scale by role (issue #117)", () => {
  it("defines section > subsection/column > label as aliases of the type scale", () => {
    const section = rolePx("--heading-section");
    const subsection = rolePx("--heading-subsection");
    const label = rolePx("--heading-label");
    const column = rolePx("--heading-column");
    expect(section).toBe(24);
    expect(subsection).toBe(18);
    expect(label).toBe(14);
    // The column head draws the subsection step: a .cmp-col re-scopes the type
    // scale, so the label step can fall under the column's own base copy.
    expect(column).toBe(18);
    expect(section).toBeGreaterThan(subsection);
    expect(subsection).toBeGreaterThanOrEqual(column);
    expect(column).toBeGreaterThan(label);
  });

  it("declares each heading role once, and no surface redeclares one", () => {
    for (const role of HEADING_ROLES) {
      expect(declarationCount(tokensCss, role), `${role} in tokens.css`).toBe(1);
      for (const [name, css] of STYLESHEETS) {
        if (name === "tokens/tokens.css") continue;
        expect(declarationCount(css, role), `${name} must not redeclare ${role}`).toBe(0);
      }
    }
  });

  it("draws every chrome heading from its role token, not a surface-local size", () => {
    for (const [selector, css, role] of HEADINGS) {
      expect(fontSizeOf(css, selector), selector).toBe(`var(${role})`);
    }
  });

  it("keeps every heading at least as large as the text it introduces", () => {
    // Sub-headings sit over --font-size-base (16px) section/demo copy; panel
    // labels sit over --font-size-sm (14px) list rows. Neither is inverted.
    expect(rolePx("--heading-subsection")).toBeGreaterThanOrEqual(16);
    expect(rolePx("--heading-label")).toBeGreaterThanOrEqual(14);
  });
});
