// Issue #284: toasts pop with no motion; chrome buttons give no press
// feedback. Reads stylesheet text because happy-dom has no cascade — same
// approach as shellContract.test.ts. The chrome motion must resolve from the
// viewer-private --app-* tokens (tester finding): the inspected system is
// applied inline on document.documentElement and overwrites the shared
// --duration-* / --motion-* / --ease-* names (the default perp-ultra-v2 zeroes
// durations and distances), so chrome rules reading those names freeze at 0ms.
// These assertions fail on bc125fa, where the chrome reads the overridable
// names, and pass once the chrome reads only --app-*.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

function toastsCss(): string {
  return read("./Toasts.css");
}

function indexCss(): string {
  return read("../index.css");
}

function tokensCss(): string {
  return read("../tokens/tokens.css");
}

// Chrome motion must never read a token name an inspected system can
// overwrite inline. Scrub the viewer-private --app-* references first; any
// remaining var(--duration-* / --motion-* / --ease-*) in chrome motion rules
// resolves to the active system (0ms on the default) instead of the viewer.
function assertViewerPrivate(css: string, what: string): void {
  const scrubbed = css.replace(/var\(--app-[a-z-]+\)/g, "");
  expect(
    scrubbed,
    `${what} reads no system-overridable motion token`,
  ).not.toMatch(/var\(--(duration|motion|ease)-/);
}

// Match innermost `selector { body }` pairs — same reader as
// shellContract.test.ts. A grouped selector defines each member.
function declarationsFor(css: string, selector: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m !== null; m = re.exec(css)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.includes(selector)) bodies.push(m[2]);
  }
  return bodies;
}

// Inner text of every `@media (prefers-reduced-motion: reduce)` block, found
// by brace counting so nested rule braces do not cut the block short.
function reducedMotionCss(css: string): string {
  const blocks: string[] = [];
  const re = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/g;
  for (let m = re.exec(css); m !== null; m = re.exec(css)) {
    const open = css.indexOf("{", m.index);
    if (open === -1) continue;
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") {
        depth--;
        if (depth === 0) {
          blocks.push(css.slice(open + 1, i));
          break;
        }
      }
    }
  }
  return blocks.join("\n");
}

describe("issue #284: toast motion", () => {
  it("defines the viewer-private chrome motion tokens as literals", () => {
    const css = tokensCss();
    for (const [name, literal] of [
      ["--app-duration-fast", "100ms"],
      ["--app-duration-normal", "200ms"],
      ["--app-motion-distance-sm", "4px"],
      ["--app-motion-distance-md", "8px"],
      ["--app-motion-scale-active", "0.97"],
      ["--app-ease-out", "cubic-bezier(0, 0, 0.2, 1)"],
    ] as const) {
      const m = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
      expect(m, `${name} is declared in tokens.css`).not.toBeNull();
      // Literals on purpose: aliasing var(--duration-*) would resolve through
      // the inspected system's inline override and reintroduce the freeze.
      expect(m![1].trim(), `${name} is a literal`).toBe(literal);
    }
  });

  it("transitions .app-toast on transform+opacity from viewer-private tokens", () => {
    const bodies = declarationsFor(toastsCss(), ".app-toast").join("\n");
    expect(bodies, ".app-toast declares a transition").toMatch(/transition:/);
    expect(bodies, "enter covers transform").toMatch(/transform/);
    expect(bodies, "enter covers opacity").toMatch(/opacity/);
    expect(bodies, "duration survives the active system").toMatch(
      /var\(--app-duration-/,
    );
    expect(bodies, "easing survives the active system").toMatch(
      /var\(--app-ease-out\)/,
    );
  });

  it("starts the toast enter from translateY(8px) and opacity 0", () => {
    const css = toastsCss();
    expect(css, "@starting-style declares the enter-from state").toMatch(
      /@starting-style/,
    );
    const starting = css.match(/@starting-style\s*\{([\s\S]*)\}/)?.[1] ?? "";
    expect(starting, "enter starts below rest").toMatch(/translateY\(/);
    expect(starting, "enter distance survives the active system").toMatch(
      /var\(--app-motion-/,
    );
    expect(starting, "enter starts transparent").toMatch(/opacity:\s*0/);
  });

  it("exits in at most ~150ms via a leaving state", () => {
    const css = toastsCss();
    expect(css, "leaving state exists").toMatch(/\.app-toast\[data-leaving/);
    const bodies = declarationsFor(
      css,
      '.app-toast[data-leaving="true"]',
    ).join("\n");
    expect(bodies, "exit fades out").toMatch(/opacity:\s*0/);
    expect(bodies, "exit uses the fast token (<=150ms)").toMatch(
      /var\(--app-duration-fast\)/,
    );
  });

  it("reads toast motion from viewer-private tokens only", () => {
    assertViewerPrivate(toastsCss(), "toast motion");
  });

  it("drops toast motion to an opacity fade under reduced motion", () => {
    const reduced = reducedMotionCss(toastsCss());
    expect(reduced.length > 0, "reduced-motion block exists").toBe(true);
    expect(reduced, "toast fades without sliding").toMatch(/opacity/);
    expect(reduced, "no translate on reduced motion").not.toMatch(
      /translateY\(/,
    );
  });
});

describe("issue #284: chrome press feedback", () => {
  const PRESS_CLASSES = [
    ".app-iconbtn",
    ".app-sysbtn",
    ".tok-btn",
    ".cmp-chip",
    ".app-tabs button",
  ];

  it("scales chrome buttons to ~0.97 on :active, never on disabled", () => {
    const css = indexCss();
    for (const cls of PRESS_CLASSES) {
      const hit = css.match(
        new RegExp(
          `${cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\{]*:active[^\\{]*\\{[^\\}]*\\}`,
          "g",
        ),
      );
      expect(hit, `${cls} has an :active rule in index.css`).not.toBeNull();
      const body = hit!.join("\n");
      expect(body, `${cls} :active scales`).toMatch(/scale\(/);
      expect(body, `${cls} :active uses the viewer scale`).toMatch(
        /var\(--app-motion-scale-active\)/,
      );
      expect(body, `${cls} :active never fires on disabled`).toMatch(
        /:not\(\s*:disabled\s*\)|:not\(\s*\[data-disabled/,
      );
    }
  });

  it("drives the press transition from viewer-private tokens", () => {
    const css = indexCss();
    expect(css, "press transition exists").toMatch(/transition:[^;]*transform/);
    expect(css, "press duration survives the active system").toMatch(
      /var\(--app-duration-/,
    );
    expect(css, "press easing survives the active system").toMatch(
      /var\(--app-ease-out\)/,
    );
  });

  it("reads press motion from viewer-private tokens only", () => {
    assertViewerPrivate(indexCss(), "press motion");
  });

  it("removes the press scale under reduced motion", () => {
    const reduced = reducedMotionCss(indexCss());
    expect(reduced.length > 0, "reduced-motion block exists").toBe(true);
    expect(reduced, "press scale is neutralised").toMatch(/transform:\s*none/);
  });
});
