// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { Root } from "react-dom/client";
import { CompareColumn } from "./CompareColumn.tsx";
import { usePortalContainer } from "../gallery/ui.tsx";
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

async function renderColumns(
  opt: ComparableOption,
  slugs: string[],
  style: CSSProperties = {},
): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <>
        {slugs.map((slug) => (
          <CompareColumn key={slug} slug={slug} name={slug} style={style} pct={null} option={opt} />
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

// Issue #31: the column hands Radix portals a container node so their
// contents resolve this column's inline token scope, not document.body/the
// page :root. A ref-held node is null on the first render, so a portal opened
// then escapes the scope until a later render repairs it. This probe locks in
// whatever `usePortalContainer()` returned on its FIRST render and portals
// into exactly that, so it can only pass if the first paint is already in
// scope — and it counts its renders to catch a repair pass.

let capturedContainer: HTMLElement | undefined;
let containerCaptured = false;
let probeRenders = 0;

function FirstRenderPortalProbe() {
  const container = usePortalContainer();
  const [locked] = useState(() => {
    if (!containerCaptured) {
      capturedContainer = container;
      containerCaptured = true;
    }
    return container;
  });
  probeRenders += 1;
  return locked ? createPortal(<span className="cmp-probe-portal">portalled</span>, locked) : null;
}

/** Portals into whatever the live context holds — the "portal opened after
    mount" path (Select/Dialog reachable from a later interaction). */
function LivePortalProbe() {
  const container = usePortalContainer();
  return container ? createPortal(<span className="cmp-live-portal">live</span>, container) : null;
}

describe("CompareColumn portal container scope", () => {
  beforeEach(() => {
    capturedContainer = undefined;
    containerCaptured = false;
    probeRenders = 0;
  });

  it("renders a first-render portal into the column's token scope", async () => {
    const probe: ComparableOption = { id: "probe", label: "Portal probe", Render: FirstRenderPortalProbe };
    const scope = { "--color-accent": "rgb(10, 20, 30)", color: "var(--color-accent)" } as CSSProperties;
    const el = await renderColumns(probe, ["aurora"], scope);
    const column = el.querySelector(".cmp-col") as HTMLElement;

    // Parent commit: the container is undefined on the first render (the
    // Provider is skipped until the ref resolves), so this captured value is
    // undefined and the probe mounts nothing at all.
    expect(capturedContainer).toBeDefined();
    expect(column.contains(capturedContainer as HTMLElement)).toBe(true);
    // No repair render: the provider has a real node from the first commit.
    expect(probeRenders).toBe(1);

    // The portal subtree resolves the same token value as the column itself.
    const portalled = el.querySelector(".cmp-probe-portal") as HTMLElement;
    expect(portalled).not.toBeNull();
    expect(getComputedStyle(portalled).color).toBe("rgb(10, 20, 30)");
    expect(getComputedStyle(column).color).toBe("rgb(10, 20, 30)");
  });

  it("keeps routing a later-rendered portal into the column scope", async () => {
    const probe: ComparableOption = { id: "live", label: "Live probe", Render: LivePortalProbe };
    const el = await renderColumns(probe, ["aurora"]);
    const column = el.querySelector(".cmp-col") as HTMLElement;
    const portalled = el.querySelector(".cmp-live-portal") as HTMLElement;
    expect(portalled).not.toBeNull();
    expect(column.contains(portalled)).toBe(true);
  });
});
