// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { DiffTable } from "./DiffTable.tsx";
import type { DesignSystem, TokenGroup } from "../systems/store.ts";

// Issue #24: `isColor` matched ANY single word, so `bold` / `Inter` / `solid`
// rendered a bogus color chip, and `nameCat` let the first system's group
// label win, hiding that the same token lives under another label elsewhere.

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

function rowFor(el: Element, name: string): HTMLTableRowElement {
  const cell = [...el.querySelectorAll(".cmp-diff-name")].find((n) =>
    n.textContent?.includes(name),
  );
  if (!cell) throw new Error(`no diff row for ${name}`);
  return cell.closest("tr")!;
}

describe("DiffTable color chips", () => {
  const realColors = ["#fff", "rgb(1, 2, 3)", "currentColor", "var(--brand)", "rebeccapurple"];

  it.each(realColors)("chips the real color %s", async (color) => {
    // The other column is a non-color, so the row is always a difference and
    // both cells render: exactly one chip means the color cell passed and the
    // `bold` cell was correctly rejected.
    const el = await render([
      sys("a", [group("Color", { "--x": color })]),
      sys("b", [group("Color", { "--x": "bold" })]),
    ]);
    expect(rowFor(el, "--x").querySelectorAll(".cmp-diff-chip")).toHaveLength(1);
  });

  // `linear` is the real `--ease-linear` value in every bundled system: the
  // old `/^[a-z]+$/` chipped it, the parser check does not.
  it.each(["bold", "solid", "Inter", "linear", "700", "1px", "0 1px 2px rgba(0, 0, 0, 0.4)"])(
    "does not chip the non-color %s",
    async (value) => {
      const el = await render([
        sys("a", [group("Misc", { "--x": value })]),
        sys("b", [group("Misc", { "--x": `${value}-other` })]),
      ]);
      expect(rowFor(el, "--x").querySelectorAll(".cmp-diff-chip")).toHaveLength(0);
    },
  );

  it("does not chip CSS-wide keywords the parser accepts", async () => {
    const el = await render([
      sys("a", [group("Misc", { "--x": "inherit" })]),
      sys("b", [group("Misc", { "--x": "initial" })]),
    ]);
    expect(rowFor(el, "--x").querySelectorAll(".cmp-diff-chip")).toHaveLength(0);
  });
});

describe("DiffTable category union", () => {
  it("shows every label a token lives under, grouped by the first", async () => {
    const el = await render([
      sys("a", [group("Typography", { "--font-weight-bold": "700" })]),
      sys("b", [group("Font", { "--font-weight-bold": "bold" })]),
    ]);
    const rows = [...el.querySelectorAll(".cmp-diff-name")].filter((n) =>
      n.textContent?.includes("--font-weight-bold"),
    );
    // First-wins rendered the token once, under Typography, dropping Font.
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Typography");
    expect(rows[0].textContent).toContain("Font");
    expect(el.querySelector(".cmp-diff-cat")?.textContent).toBe("Typography");
  });

  it("leaves a single-category token unlabelled", async () => {
    const el = await render([
      sys("a", [group("Color", { "--x": "#fff" })]),
      sys("b", [group("Color", { "--x": "#000" })]),
    ]);
    expect(rowFor(el, "--x").querySelector(".cmp-diff-name")?.textContent).toBe("--x");
  });
});
