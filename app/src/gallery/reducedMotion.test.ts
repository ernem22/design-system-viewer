/**
 * Pins the prefers-reduced-motion repair for issue #220 at the source-text
 * level. Every `@keyframes` name consumed by an `animation` in the shared
 * animation set must have a `@media (prefers-reduced-motion: reduce)` rule
 * covering its selector, so infinite motion stops and entrance motion drops
 * to an opacity change or none. Reads the stylesheet text because happy-dom
 * has no cascade — same approach as shellContract.test.ts.
 *
 * Vitest runs in the `node` environment, so the stylesheets are read from
 * disk relative to `import.meta.url` (like gallery/contrast.test.ts).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

const galleryCss = read("./gallery.css");
const feedbackCss = read("./components/feedback.css");
const statusCss = read("./components/status.css");
const screensCss = read("./components/screens/screens.css");

const STYLESHEETS: Array<[string, string]> = [
  ["gallery/gallery.css", galleryCss],
  ["gallery/components/feedback.css", feedbackCss],
  ["gallery/components/status.css", statusCss],
  ["gallery/components/screens/screens.css", screensCss],
];

// All @keyframes names defined across the shared set — an `animation` naming
// one of these must have reduced-motion coverage where it is applied.
const KEYFRAMES = new Set<string>();
for (const [, css] of STYLESHEETS) {
  for (const m of css.matchAll(/@keyframes\s+([a-zA-Z0-9-_]+)/g)) {
    KEYFRAMES.add(m[1]);
  }
};

// Media-query wrappers contain braces, so match innermost `selector { body }`
// pairs — same reader as shellContract.test.ts.
function rules(css: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m !== null; m = re.exec(css)) {
    out.push({ selector: m[1].trim(), body: m[2] });
  }
  return out;
}

function isKeyframesFrame(selector: string): boolean {
  const s = selector.trim();
  return (
    s === "from" ||
    s === "to" ||
    /^\d+%/.test(s) ||
    s.startsWith("@keyframes")
  );
}

// Every `animation: <name> ...` whose name is a shared @keyframes, with the
// selector that applies it. `animation-duration` tweaks (e.g.
// `.dsv-bounce-dot--sm`) carry no name, so they contribute no entry — the base
// `.dsv-bounce-dot` rule covers them.
function animationUsages(css: string): Array<{ selector: string; name: string }> {
  const usages: Array<{ selector: string; name: string }> = [];
  for (const { selector, body } of rules(css)) {
    if (selector.includes("@media") || isKeyframesFrame(selector)) continue;
    const m =
      body.match(/\banimation-name\s*:\s*([a-zA-Z0-9-_]+)/) ??
      body.match(/\banimation\s*:\s*([a-zA-Z0-9-_]+)/);
    if (m && KEYFRAMES.has(m[1])) {
      for (const part of selector.split(",")) {
        usages.push({ selector: part.trim(), name: m[1] });
      }
    }
  }
  return usages;
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

function reducedBodies(reduced: string, selector: string): string {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(reduced); m !== null; m = re.exec(reduced)) {
    const members = m[1].split(",").map((s) => s.trim());
    if (members.includes(selector)) bodies.push(m[2]);
  }
  return bodies.join("\n");
}

describe("prefers-reduced-motion in the shared animation set (issue #220)", () => {
  it("defines the shared keyframes this slice owns", () => {
    for (const name of [
      "dsv-spin",
      "dsv-fade",
      "dsv-pop",
      "dsv-scale",
      "dsv-dur-slide",
      "dsv-blink",
      "dsv-pulse",
      "dsv-bounce",
      "dsv-slide-in",
      "dsv-toast-out",
    ]) {
      expect(KEYFRAMES.has(name), `missing @keyframes ${name}`).toBe(true);
    }
  });

  it("ships a prefers-reduced-motion block in each stylesheet of the slice", () => {
    for (const [name, css] of STYLESHEETS) {
      expect(
        reducedMotionCss(css).length > 0,
        `${name} must contain @media (prefers-reduced-motion: reduce)`,
      ).toBe(true);
    }
  });

  it("covers every animated selector with an animation override", () => {
    const offenders: string[] = [];
    for (const [name, css] of STYLESHEETS) {
      const reduced = reducedMotionCss(css);
      for (const { selector, name: keyframe } of animationUsages(css)) {
        const override = reducedBodies(reduced, selector);
        if (!/animation\s*:/.test(override)) {
          offenders.push(`${name}: ${selector} (animation ${keyframe})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
