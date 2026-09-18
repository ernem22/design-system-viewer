// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { CompareColumn } from "./CompareColumn.tsx";
import { BASIC_OPTIONS } from "./registry.tsx";
import type { ComparableOption } from "./registry.tsx";

// Issue #39: the compare-only Basics renderers (Inputs: c-e/c-p/c-n/c-d,
// LoginCard: lc-e/lc-p) hardcoded element ids, so mounting the same renderer
// in 2-4 columns repeated every id and each `<label htmlFor>` resolved to the
// first column's input. These tests mount CompareColumn exactly the way
// CompareView does and assert ids stay unique and label/input pairs stay
// within their own column.

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function option(id: string): ComparableOption {
  const found = BASIC_OPTIONS.find((o) => o.id === id);
  if (!found) throw new Error(`no comparable option with id ${id}`);
  return found;
}

async function renderColumns(opt: ComparableOption, slugs: string[]): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <>
        {slugs.map((slug) => (
          <CompareColumn key={slug} slug={slug} name={slug} style={{}} pct={null} option={opt} />
        ))}
      </>,
    );
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

function idsIn(el: Element): string[] {
  return [...el.querySelectorAll("[id]")].map((n) => n.id);
}

describe("CompareColumn id namespacing", () => {
  it("keeps Inputs ids unique across two mounted columns", async () => {
    const el = await renderColumns(option("input"), ["aurora", "chatgpt"]);
    const ids = idsIn(el);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    expect(ids).toEqual(
      expect.arrayContaining(["aurora-c-e", "aurora-c-p", "aurora-c-n", "aurora-c-d", "chatgpt-c-e"]),
    );
  });

  it("resolves each column's Inputs label to that column's own input", async () => {
    const el = await renderColumns(option("input"), ["aurora", "chatgpt"]);
    for (const col of el.querySelectorAll(".cmp-col")) {
      const input = col.querySelector("input")!;
      const label = col.querySelector("label.dsv-label[for]")!;
      expect(label.getAttribute("for")).toBe(input.id);
      expect(col.contains(document.getElementById(label.getAttribute("for")!))).toBe(true);
    }
  });

  it("namespaces LoginCard ids (lc-e/lc-p) per column", async () => {
    const el = await renderColumns(option("login"), ["aurora", "chatgpt"]);
    const ids = idsIn(el);
    expect(new Set(ids).size).toBe(ids.length);
    const firstCol = el.querySelector(".cmp-col")!;
    const secondCol = [...el.querySelectorAll(".cmp-col")][1];
    expect(firstCol.querySelector("label.dsv-label")!.getAttribute("for")).toBe("aurora-lc-e");
    expect(secondCol.querySelector("label.dsv-label")!.getAttribute("for")).toBe("chatgpt-lc-e");
    expect(secondCol.contains(document.getElementById("chatgpt-lc-e"))).toBe(true);
  });

  it("leaves Preview ids untouched outside a Compare column", async () => {
    const { createRoot } = await import("react-dom/client");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const Render = option("input").Render;
    await act(async () => {
      root!.render(<Render />);
    });
    expect(host.querySelector("input")!.id).toBe("c-e");
  });
});
