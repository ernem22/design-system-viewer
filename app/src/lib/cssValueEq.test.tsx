// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { cssValueEq, normalizeCssValue } from "./cssValueEq.ts";
import { DiffTable } from "../compare/DiffTable.tsx";
import type { DesignSystem, TokenGroup } from "../systems/store.ts";

describe("normalizeCssValue", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeCssValue("  0.5rem   ")).toBe("0.5rem");
    expect(normalizeCssValue("0   1px")).toBe("0 1px");
  });

  it("treats a missing leading zero as equal", () => {
    expect(cssValueEq(".5rem", "0.5rem")).toBe(true);
    expect(cssValueEq("-.5rem", "-0.5rem")).toBe(true);
    expect(cssValueEq("0.5rem", "0.5rem")).toBe(true);
  });

  it("does not fold other numeric spellings", () => {
    expect(cssValueEq("0.50rem", "0.5rem")).toBe(false);
    expect(cssValueEq("1rem", "01rem")).toBe(false);
  });

  it("folds hex case and 3-/4-digit shorthand", () => {
    expect(cssValueEq("#fff", "#FFFFFF")).toBe(true);
    expect(cssValueEq("#ffff", "#ffffffff")).toBe(true);
    expect(cssValueEq("#ABC", "#aabbcc")).toBe(true);
    expect(cssValueEq("#AbCd", "#aabbccdd")).toBe(true);
  });

  it("keeps distinct colours distinct", () => {
    expect(cssValueEq("#fff", "#000")).toBe(false);
    expect(cssValueEq("#fff", "white")).toBe(false);
    expect(cssValueEq("#ffffff", "rgb(255, 255, 255)")).toBe(false);
  });

  it("treats a zero length with or without a unit as equal", () => {
    for (const v of ["0", "0px", "0rem", "0em", "+0px", "-0em", "0.0px", "00"]) {
      expect(cssValueEq(v, "0")).toBe(true);
    }
  });

  it("keeps zero times and angles different from plain zero", () => {
    expect(cssValueEq("0", "0ms")).toBe(false);
    expect(cssValueEq("0", "0s")).toBe(false);
    expect(cssValueEq("0", "0deg")).toBe(false);
    expect(cssValueEq("0", "0turn")).toBe(false);
  });

  it("keeps different units and colour spaces apart", () => {
    expect(cssValueEq("0px", "0ms")).toBe(false);
    expect(cssValueEq("1px", "1rem")).toBe(false);
    expect(cssValueEq("red", "blue")).toBe(false);
  });

  it("does not fold case outside hex digits", () => {
    expect(cssValueEq("RED", "red")).toBe(false);
    expect(cssValueEq("Solid", "solid")).toBe(false);
  });
});

// RED test for issue #281: formatting-only differences must count as same.
let root: Root | null = null;
let host: HTMLDivElement | null = null;

function group(label: string, tokens: Record<string, string>): TokenGroup {
  return {
    id: label.toLowerCase(),
    label,
    kind: "raw",
    tokens: Object.entries(tokens).map(([name, value]) => ({ name, value })),
  };
}

function sys(slug: string, groups: TokenGroup[]): DesignSystem {
  return { slug, name: slug, css: "", groups, createdAt: "", updatedAt: "" };
}

async function render(cols: DesignSystem[]): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<DiffTable cols={cols} />);
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

describe("DiffTable formatting-only differences (issue #281)", () => {
  it("counts 0.5rem/.5rem, #ffffff/#FFFFFF and 0px/0 as same", async () => {
    const el = await render([
      sys("a", [group("S", { "--a": "0.5rem", "--b": "#ffffff", "--c": "0px" })]),
      sys("b", [group("S", { "--a": ".5rem", "--b": "#FFFFFF", "--c": "0" })]),
    ]);
    expect(el.querySelector(".cmp-diff-bar")?.textContent).toContain("0 different");
  });

  it("still displays each system's value exactly as authored", async () => {
    const el = await render([
      sys("a", [group("S", { "--a": "0.5rem", "--b": "#ffffff", "--c": "0px" })]),
      sys("b", [group("S", { "--a": ".5rem", "--b": "#FFFFFF", "--c": "0" })]),
    ]);
    // "only differences" hides the now-same rows; show everything to check
    // the cells still carry the authored spellings, not the normalised form.
    await act(async () => {
      (el.querySelector('[role="checkbox"]') as HTMLElement).click();
    });
    const codes = [...el.querySelectorAll("code")].map((c) => c.textContent);
    expect(codes).toEqual(expect.arrayContaining(["0.5rem", ".5rem", "#ffffff", "#FFFFFF", "0px", "0"]));
  });
});
