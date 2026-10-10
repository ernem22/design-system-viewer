// @vitest-environment happy-dom
// Issue #222 (audit slice of #127): the compare diff table's column headers
// carry no scope, the category row is a data cell instead of a row-group
// header, token values are spellcheckable, the selection count is not a live
// region, the decorative swatch is exposed to AT, and the sticky header /
// number cells miss scroll-margin and tabular numerals.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DiffTable } from "./DiffTable.tsx";
import { CompareView } from "./CompareView.tsx";
import { CompareColumn } from "./CompareColumn.tsx";
import { useCompareView } from "./useCompareView.ts";
import type { CompareViewModel } from "./useCompareView.ts";
import type { DesignSystem, TokenGroup } from "../systems/store.ts";
import type { ComparableOption } from "./registry.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

let view: CompareViewModel | null = null;

function Harness({ systems }: { systems: DesignSystem[] }) {
  view = useCompareView(systems);
  return <CompareView view={view} />;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  view = null;
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

function cssBodiesFor(css: string, match: (selector: string) => boolean): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m !== null; m = re.exec(css)) {
    if (m[1].split(",").some((s) => match(s.trim()))) bodies.push(m[2]);
  }
  return bodies;
}

// vitest runs with cwd = app/, so the co-located stylesheet resolves from there.
const compareCss = readFileSync(resolve(process.cwd(), "src", "compare", "compare.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("Compare a11y (#222)", () => {
  it("gives every DiffTable column header scope=col", async () => {
    const el = await renderNode([
      <DiffTable
        key="t"
        cols={[
          system("a", [group("Color", { "--x": "#fff" })]),
          system("b", [group("Color", { "--x": "#000" })]),
        ]}
      />,
    ]);
    const headers = [...el.querySelectorAll(".cmp-diff-table thead th")];
    expect(headers.length).toBeGreaterThan(1);
    for (const th of headers) expect(th.getAttribute("scope")).toBe("col");
  });

  it("renders the category row as a row-group header, not a data cell", async () => {
    const el = await renderNode([
      <DiffTable
        key="t"
        cols={[
          system("a", [group("Color", { "--x": "#fff" })]),
          system("b", [group("Color", { "--x": "#000" })]),
        ]}
      />,
    ]);
    const cat = el.querySelector(".cmp-diff-cat")!;
    const header = cat.querySelector("th");
    expect(header).not.toBeNull();
    expect(header!.getAttribute("scope")).toBe("rowgroup");
    expect(cat.querySelector("td")).toBeNull();
  });

  it("marks token values as non-spellcheckable", async () => {
    const el = await renderNode([
      <DiffTable
        key="t"
        cols={[
          system("a", [group("Color", { "--x": "#fff" })]),
          system("b", [group("Color", { "--x": "#000" })]),
        ]}
      />,
    ]);
    const codes = [...el.querySelectorAll(".cmp-diff-cell code")];
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) expect(code.getAttribute("spellcheck")).toBe("false");
  });

  it("announces the selection count through a live region", async () => {
    const el = await renderNode(
      <Harness
        systems={[
          system("a", [group("Color", { "--x": "#fff" })]),
          system("b", [group("Color", { "--x": "#000" })]),
        ]}
      />,
    );
    const hint = el.querySelector(".cmp-hint")!;
    expect(hint.textContent).toContain("selected");
    expect(hint.getAttribute("aria-live")).toBe("polite");
  });

  it("hides the decorative column swatch from assistive tech", async () => {
    const opt: ComparableOption = {
      id: "probe",
      label: "Probe",
      Render: () => <span>probe</span>,
    };
    const el = await renderNode(
      <CompareColumn slug="aurora" name="aurora" style={{} as CSSProperties} pct={null} option={opt} />,
    );
    expect(el.querySelector(".cmp-swatch")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("gives the sticky diff-table header a scroll-margin-top", () => {
    const bodies = cssBodiesFor(compareCss, (s) => s.includes(".cmp-diff-table") && s.includes("th"));
    expect(bodies.some((b) => /scroll-margin-top\s*:/.test(b))).toBe(true);
  });

  it("sets tabular numerals on the diff-table number cells", () => {
    const bodies = cssBodiesFor(compareCss, (s) => s.includes(".cmp-diff"));
    expect(bodies.some((b) => /font-variant-numeric\s*:\s*tabular-nums/.test(b))).toBe(true);
  });
});
