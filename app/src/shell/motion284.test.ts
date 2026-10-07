// Issue #284 RED: toasts pop with no motion; chrome buttons give no press
// feedback. Reads stylesheet text because happy-dom has no cascade — same
// approach as shellContract.test.ts. Fails on the parent where Toasts.css
// declares no transition (or @starting-style) for .app-toast and index.css
// has no :active rule for .app-iconbtn.
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
  it("transitions .app-toast on transform+opacity from viewer tokens", () => {
    const bodies = declarationsFor(toastsCss(), ".app-toast").join("\n");
    expect(bodies, ".app-toast declares a transition").toMatch(/transition:/);
    expect(bodies, "enter covers transform").toMatch(/transform/);
    expect(bodies, "enter covers opacity").toMatch(/opacity/);
    expect(bodies, "duration comes from viewer tokens").toMatch(
      /var\(--duration-/,
    );
    expect(bodies, "easing is ease-out").toMatch(/var\(--ease-out\)/);
  });

  it("starts the toast enter from translateY(8px) and opacity 0", () => {
    const css = toastsCss();
    expect(css, "@starting-style declares the enter-from state").toMatch(
      /@starting-style/,
    );
    const starting = css.match(/@starting-style\s*\{([\s\S]*)\}/)?.[1] ?? "";
    expect(starting, "enter starts below rest").toMatch(/translateY\(/);
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
      /var\(--duration-fast\)/,
    );
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
      expect(body, `${cls} :active never fires on disabled`).toMatch(
        /:not\(\s*:disabled\s*\)|:not\(\s*\[data-disabled/,
      );
    }
  });

  it("drives the press transition from viewer tokens", () => {
    const css = indexCss();
    expect(css, "press transition exists").toMatch(/transition:[^;]*transform/);
    expect(css, "press duration comes from viewer tokens").toMatch(
      /var\(--duration-/,
    );
    expect(css, "press easing is ease-out").toMatch(/var\(--ease-out\)/);
  });

  it("removes the press scale under reduced motion", () => {
    const reduced = reducedMotionCss(indexCss());
    expect(reduced.length > 0, "reduced-motion block exists").toBe(true);
    expect(reduced, "press scale is neutralised").toMatch(/transform:\s*none/);
  });
});
