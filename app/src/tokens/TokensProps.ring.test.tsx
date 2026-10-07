// @vitest-environment happy-dom
// Issue #283: the "100%" label overruns the 44px coverage ring's stroke,
// while "32%" fits. happy-dom has no layout engine, so the overrun cannot
// be measured from boxes here; the invariant is read from the stylesheet
// text instead (same approach as shell/shellContract.test.ts), plus a DOM
// marker that selects the three-digit sizing. The running-app geometry
// (100%/32%/0% inside the stroke) was checked by hand in the PR body.
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TokensProps } from "./TokensProps.tsx";
import type { TokensViewModel } from "./useTokensView.ts";

// vitest runs with cwd = app/, so the co-located stylesheet resolves from there.
const ringCss = () =>
  readFileSync(resolve(process.cwd(), "src/tokens/TokensProps.css"), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

function declarationsFor(css: string, selector: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m !== null; m = re.exec(css)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.includes(selector)) bodies.push(m[2]);
  }
  return bodies;
}

function viewFor(present: number, expected: number): TokensViewModel {
  return {
    cov: {
      groups: [],
      extra: [],
      expected,
      present,
      missing: expected - present,
      extraCount: 0,
    },
    selected: null,
    warnings: [],
    copyToken: () => {},
  } as unknown as TokensViewModel;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function renderAt(present: number, expected: number): Promise<HTMLElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const view = viewFor(present, expected);
  await act(async () => {
    root!.render(<TokensProps view={view} />);
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

describe("coverage ring three-digit label (issue #283)", () => {
  it("marks the 100% ring so the label can shrink inside the stroke", async () => {
    const el = await renderAt(432, 432);
    const ring = el.querySelector(".tok-cov-ring") as HTMLElement;
    expect(ring.getAttribute("aria-label")).toBe("100% of schema tokens present");
    const label = ring.querySelector("b") as HTMLElement;
    // The three-digit value needs its own sizing hook; without it the 14px
    // label is wider than the ~34px inner diameter and hits the stroke.
    expect(
      ring.classList.contains("tok-cov-3dig") || label.hasAttribute("data-digits"),
      "100% ring must carry a three-digit sizing hook",
    ).toBe(true);
  });

  it("sizes the three-digit label from the token scale, smaller than the base", () => {
    const css = ringCss();
    const bodies = [
      ...declarationsFor(css, ".tok-cov-ring.tok-cov-3dig b"),
      ...declarationsFor(css, ".tok-cov-3dig b"),
      ...declarationsFor(css, ".tok-cov-ring[data-digits=\"3\"] b"),
    ].join("\n");
    expect(bodies.trim().length > 0, "stylesheet must size the three-digit label").toBe(true);
    // Smaller label for three digits, read from the tokens already used in
    // this file — no new literal size.
    expect(bodies).toContain("var(--font-size-xs)");
    expect(bodies).not.toMatch(/font-size:\s*\d/);
  });

  it("keeps one- and two-digit labels on the default size", async () => {
    for (const [present, expected, name] of [
      [32, 100, "32% of schema tokens present"],
      [0, 100, "0% of schema tokens present"],
    ] as const) {
      const el = await renderAt(present, expected);
      const ring = el.querySelector(".tok-cov-ring") as HTMLElement;
      expect(ring.getAttribute("aria-label")).toBe(name);
      expect(ring.classList.contains("tok-cov-3dig")).toBe(false);
      act(() => root?.unmount());
      root = null;
      host?.remove();
      host = null;
    }
  });

  it("keeps the ring geometry and non-jitter invariants", () => {
    const css = ringCss();
    const ring = declarationsFor(css, ".tok-cov-ring").join("\n");
    expect(ring).toMatch(/width:\s*44px/);
    expect(ring).toMatch(/height:\s*44px/);
    const label = declarationsFor(css, ".tok-cov-ring b").join("\n");
    expect(label).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });
});
