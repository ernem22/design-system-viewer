// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { Root } from "react-dom/client";
import { CompareColumn } from "./CompareColumn.tsx";
import { useCompareView } from "./useCompareView.ts";
import type { DesignSystem } from "../systems/store.ts";
import { usePortalContainer } from "../gallery/ui.tsx";
import { BASIC_OPTIONS, COMPONENT_OPTIONS, SCREEN_OPTIONS } from "./registry.tsx";
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

function galleryOption(id: string): ComparableOption {
  const found = [...COMPONENT_OPTIONS, ...SCREEN_OPTIONS].find((o) => o.id === id);
  if (!found) throw new Error(`no comparable gallery option with id ${id}`);
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

/** Gallery section bodies are React.lazy now (issue #328), so the Suspense
    fallback paints first. Wait, inside act, until every column's body has
    replaced its `.dsv-section-loading` placeholder — otherwise the id queries
    below run against the fallback and see nothing. */
async function waitForLazyBodies(el: HTMLElement): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const loading = el.querySelectorAll(".dsv-section-loading").length;
    const rendered = el.querySelectorAll(".cmp-col-body > :not(.dsv-section-loading)").length;
    if (loading === 0 && rendered >= 2) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error("gallery bodies did not resolve before the deadline");
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  document.documentElement.style.removeProperty("--color-bg");
});

function idsIn(el: Element): string[] {
  return [...el.querySelectorAll("[id]")].map((n) => n.id);
}

describe("CompareColumn id namespacing", () => {
  it("keeps Inputs ids unique across two mounted columns", async () => {
    const el = await renderColumns(option("input"), ["aurora", "chatgpt"]);
    const ids = idsIn(el);
    // 4 controls + hint/error message ids (Field now associates them) per column.
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
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

// Issue #40 follow-up: gallery section Bodies render once per Compare column.
// Their hardcoded form ids (f-email, l-email, …) must be namespaced too, or
// every `<label htmlFor>` in columns 2+ resolves to column 1's control.
describe("CompareColumn gallery section id namespacing", () => {
  it("namespaces Forms ids and resolves each label within its own column", async () => {
    const el = await renderColumns(galleryOption("gallery-forms"), ["aurora", "chatgpt"]);
    await waitForLazyBodies(el);
    const ids = idsIn(el);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["aurora-f-email", "chatgpt-f-email"]));

    const cols = [...el.querySelectorAll(".cmp-col")];
    expect(cols).toHaveLength(2);
    for (const col of cols) {
      const label = col.querySelector("label.dsv-label[for]")!;
      const input = document.getElementById(label.getAttribute("for")!)!;
      expect(col.contains(input)).toBe(true);
      expect(input.tagName).toBe("INPUT");
    }
    expect(cols[0].querySelector("input")!.id).toBe("aurora-f-email");
    expect(cols[1].querySelector("input")!.id).toBe("chatgpt-f-email");
  });

  it("namespaces the Login screen ids per column", async () => {
    const el = await renderColumns(galleryOption("gallery-screen-login"), ["aurora", "chatgpt"]);
    await waitForLazyBodies(el);
    const ids = idsIn(el);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["aurora-l-email", "chatgpt-l-email"]));

    for (const col of el.querySelectorAll(".cmp-col")) {
      const label = col.querySelector("label.dsv-label[for]")!;
      expect(col.contains(document.getElementById(label.getAttribute("for")!))).toBe(true);
    }
  });
});

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

// A compared system that omits a schema token must not read the ACTIVE
// system's value from document.documentElement: the column scopes every
// omitted schema name to `initial` (guaranteed-invalid).
describe("CompareColumn does not inherit the active system's missing tokens", () => {
  it("scopes an omitted schema token to initial instead of the page value", async () => {
    document.documentElement.style.setProperty("--color-bg", "#123456");
    const system: DesignSystem = {
      slug: "partial",
      name: "Partial",
      css: "--color-accent: #ff0000;",
      groups: [
        {
          id: "color",
          label: "Color",
          kind: "color",
          tokens: [{ name: "--color-accent", value: "#ff0000" }],
        },
      ],
      createdAt: "",
      updatedAt: "",
    };

    function Harness() {
      const view = useCompareView([system]);
      return (
        <>
          {view.cols.map((s) => (
            <CompareColumn
              key={s.slug}
              slug={s.slug}
              name={s.name}
              style={view.styleFor.get(s.slug) ?? {}}
              pct={null}
              option={option("button")}
            />
          ))}
        </>
      );
    }

    const { createRoot } = await import("react-dom/client");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(<Harness />);
    });

    const column = host.querySelector(".cmp-col") as HTMLElement;
    expect(column.style.getPropertyValue("--color-bg")).toBe("initial");
    expect(column.style.getPropertyValue("--color-bg")).not.toBe("#123456");
    expect(column.style.getPropertyValue("--color-accent")).toBe("#ff0000");
    expect(getComputedStyle(column).getPropertyValue("--color-bg")).not.toBe("#123456");
  });
});

// The first column is the reference the diff compares against; its head says
// so, and only that column carries the marker.
describe("CompareColumn reference marker", () => {
  it("marks only the reference column", async () => {
    const opt = option("button");
    const { createRoot } = await import("react-dom/client");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(
        <>
          <CompareColumn slug="a" name="A" style={{}} pct={null} option={opt} reference />
          <CompareColumn slug="b" name="B" style={{}} pct={null} option={opt} />
        </>,
      );
    });
    expect(host.querySelectorAll(".cmp-ref-marker")).toHaveLength(1);
    expect(host.querySelector(".cmp-col .cmp-ref-marker")?.textContent).toBe("Reference");
  });
});

// Issue #325: a complete column head carries no badge; an incomplete one
// keeps a warning pill titled with the schema size.
describe("CompareColumn coverage badge below 100% only (#325)", () => {
  it("renders nothing at 100% and a titled 32% below", async () => {
    const opt = option("button");
    const { createRoot } = await import("react-dom/client");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(
        <>
          <CompareColumn slug="full" name="Full" style={{}} pct={100} option={opt} />
          <CompareColumn slug="figma" name="Figma" style={{}} pct={32} option={opt} />
        </>,
      );
    });
    expect(host.textContent).not.toContain("100%");
    const badges = [...host.querySelectorAll(".cmp-cov")];
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe("32%");
    expect(badges[0].getAttribute("title")).toContain("432");
  });
});
