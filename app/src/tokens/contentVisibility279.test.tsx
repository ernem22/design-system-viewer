// @vitest-environment happy-dom
// Issue #279: long token lists render every row at once (432 names). Each
// `.tok-group` and each diff category must opt into `content-visibility: auto`
// with a `contain-intrinsic-size` estimate, so off-screen groups skip rendering
// while staying in the DOM (find-in-page, #anchor links, scrollspy and the
// single-scroll-container contract keep working). happy-dom has no layout
// engine, so the CSS half is read from the stylesheet text (like
// shell/shellContract.test.ts) and the DOM half is checked structurally: the
// diff renders one <tbody> per category with the category row first, so each
// category is its own containment unit.
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { ReactNode } from "react";
import type { Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DiffTable } from "../compare/DiffTable.tsx";
import type { DesignSystem, TokenGroup } from "../systems/store.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function group(label: string, tokens: Record<string, string>): TokenGroup {
  return {
    id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    label,
    kind: "raw",
    tokens: Object.entries(tokens).map(([name, value]) => ({ name, value })),
  };
}

function system(slug: string, groups: TokenGroup[]): DesignSystem {
  return { slug, name: slug, css: "", groups, createdAt: "", updatedAt: "" };
}

async function renderNode(node: ReactNode): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(node);
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

// vitest runs with cwd = app/, so the co-located stylesheets resolve from there.
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");
const tokenGroupCss = stripComments(
  readFileSync(resolve(process.cwd(), "src", "tokens", "TokenGroup.css"), "utf8"),
);
const compareCss = stripComments(
  readFileSync(resolve(process.cwd(), "src", "compare", "compare.css"), "utf8"),
);

/** Declaration bodies for rules whose selector list contains `selector`. */
function bodiesFor(css: string, selector: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m !== null; m = re.exec(css)) {
    if (m[1].split(",").some((s) => s.trim() === selector)) bodies.push(m[2]);
  }
  return bodies;
}

describe("off-screen group containment (issue #279)", () => {
  it("skips rendering off-screen token groups while keeping them in the DOM", () => {
    const body = bodiesFor(tokenGroupCss, ".tok-group").join("\n");
    expect(body).toMatch(/content-visibility\s*:\s*auto/);
    expect(body).toMatch(/contain-intrinsic-size\s*:\s*auto\s+\S+/);
  });

  it("renders one tbody per diff category, with the category row first", async () => {
    const el = await renderNode(
      <DiffTable
        cols={[
          system("a", [group("Color", { "--x": "#fff" }), group("Space", { "--s": "1px" })]),
          system("b", [group("Color", { "--x": "#000" }), group("Space", { "--s": "2px" })]),
        ]}
      />,
    );
    const tbodies = [...el.querySelectorAll(".cmp-diff-table tbody")];
    // Two categories in the fixture, so a single shared tbody fails this.
    expect(tbodies).toHaveLength(2);
    for (const tbody of tbodies) {
      const first = tbody.querySelector("tr");
      expect(first?.classList.contains("cmp-diff-cat")).toBe(true);
    }
  });

  it("skips rendering off-screen diff categories while keeping them in the DOM", () => {
    const body = bodiesFor(compareCss, ".cmp-diff-table tbody").join("\n");
    expect(body).toMatch(/content-visibility\s*:\s*auto/);
    expect(body).toMatch(/contain-intrinsic-size\s*:\s*auto\s+\S+/);
  });
});
