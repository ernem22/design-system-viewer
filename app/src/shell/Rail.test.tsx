// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import Rail from "./Rail.tsx";
import type { RailSearch } from "./Rail.tsx";
import type { RailGroups } from "../lib/railTypes.ts";

// The rail redesign: a row is a section scroll target, families collapse, the
// active row is a per-row background (no sliding indicator), the row list is
// one tab stop with roving focus, and search lives in the rail frame. These
// drive Rail inside a stand-in `.app-rail-inner` (what Shell supplies) with a
// fake `.app-main` scroll environment so the scrollspy's landing-line scan has
// geometry to work with.

const GROUPS: RailGroups = [
  ["Components", [
    { id: "alpha", label: "Alpha" },
    { id: "beta", label: "Beta" },
  ]],
  ["Extras", [{ id: "gamma", label: "Gamma" }]],
];

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let wrap: HTMLDivElement | null = null;
const originalRect = HTMLElement.prototype.getBoundingClientRect;

function rect(top: number): DOMRect {
  return {
    top,
    bottom: top + 24,
    left: 0,
    right: 0,
    width: 0,
    height: 24,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as unknown as DOMRect;
}

/** One `.app-main` scroller plus section elements whose rects track its
 *  scrollTop, so the spy's scan sees a real landing line. */
function layout(sections: Record<string, number>): HTMLElement {
  const scroller = document.createElement("div");
  scroller.className = "app-main";
  scroller.getBoundingClientRect = () => rect(0);
  document.body.appendChild(scroller);
  for (const [id, offset] of Object.entries(sections)) {
    const el = document.createElement("section");
    el.id = id;
    el.getBoundingClientRect = () => rect(offset - scroller.scrollTop);
    document.body.appendChild(el);
  }
  return scroller;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

async function renderRail(node: React.ReactNode): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  wrap = document.createElement("div");
  wrap.className = "app-rail-inner";
  host = document.createElement("div");
  wrap.appendChild(host);
  document.body.appendChild(wrap);
  root = createRoot(host);
  await act(async () => {
    root!.render(node);
  });
}

function link(id: string): HTMLAnchorElement | null {
  return host!.querySelector<HTMLAnchorElement>(`a[href="#${id}"]`);
}

/** Scroll the one scroller so the section at `offset` lands on the shared
 *  landing line (offset - 60), then let the spy's one tick run. */
async function scrollTo(scroller: HTMLElement, offset: number): Promise<void> {
  await act(async () => {
    scroller.scrollTop = offset - 60;
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    await nextFrame();
  });
}

function tabStops(): HTMLElement[] {
  return [...host!.querySelectorAll<HTMLElement>("[data-rail-key]")].filter(
    (n) => n.tabIndex === 0,
  );
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
  HTMLElement.prototype.getBoundingClientRect = () => rect(0);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host = null;
  wrap = null;
  HTMLElement.prototype.getBoundingClientRect = originalRect;
  document.body.innerHTML = "";
});

describe("rail grouping and defaults", () => {
  it("opens only the first family on first load; the rest stay closed", async () => {
    await renderRail(<Rail groups={GROUPS} />);
    expect(link("alpha")).toBeTruthy();
    expect(link("beta")).toBeTruthy();
    expect(link("gamma")).toBeNull();
  });

  it("auto-opens the family the spy enters, without re-opening on scroll within it", async () => {
    const scroller = layout({ alpha: 0, gamma: 400 });
    await renderRail(<Rail groups={GROUPS} />);
    expect(link("gamma")).toBeNull();

    await scrollTo(scroller, 400);
    expect(link("gamma")).toBeTruthy();
    expect(link("gamma")!.getAttribute("aria-current")).toBe("location");
    // The cue marks the active family.
    expect(
      host!.querySelector('.app-rail-group[data-active] .app-rail-group-text')?.textContent,
    ).toBe("Extras");
  });

  it("keeps a user-collapsed family shut while scrolling inside it", async () => {
    const scroller = layout({ alpha: 0 });
    await renderRail(<Rail groups={GROUPS} />);
    const header = host!.querySelector<HTMLButtonElement>(".app-rail-group-label")!;
    await act(async () => {
      header.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(link("alpha")).toBeNull();
    await scrollTo(scroller, 0);
    expect(link("alpha")).toBeNull();
  });
});

describe("click and activation agree by construction", () => {
  it("activates the clicked row once its jump lands on the shared line", async () => {
    const scroller = layout({ alpha: 0, beta: 500 });
    await renderRail(<Rail groups={GROUPS} />);
    const beta = link("beta")!;
    expect(beta).toBeTruthy();

    await act(async () => {
      beta.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await scrollTo(scroller, 500);

    // The activated id is exactly the clicked id.
    const current = host!.querySelector<HTMLElement>('a[aria-current="location"]');
    expect(current).toBe(link("beta"));
    expect(link("alpha")!.getAttribute("aria-current")).toBeNull();
  });
});

describe("one tab stop with roving focus", () => {
  it("exposes exactly one row/header tab stop", async () => {
    await renderRail(<Rail groups={GROUPS} />);
    expect(tabStops()).toHaveLength(1);
  });

  it("moves focus with ArrowDown and keeps one tab stop", async () => {
    await renderRail(<Rail groups={GROUPS} />);
    const nav = host!.querySelector<HTMLElement>(".app-rail-nav")!;
    tabStops()[0].focus();
    const before = document.activeElement as HTMLElement;
    await act(async () => {
      nav.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    const after = document.activeElement as HTMLElement;
    expect(after).not.toBe(before);
    expect(after.dataset.railKey).toBeTruthy();
    expect(tabStops()).toEqual([after]);
  });

  it("collapses a focused family with ArrowLeft", async () => {
    await renderRail(<Rail groups={GROUPS} />);
    const nav = host!.querySelector<HTMLElement>(".app-rail-nav")!;
    const header = host!.querySelector<HTMLButtonElement>(".app-rail-group-label")!;
    header.focus();
    await act(async () => {
      nav.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    expect(link("alpha")).toBeNull();
  });
});

describe("search", () => {
  const search: RailSearch = { value: "a", onChange: () => {} };

  it("renders static family labels, not toggles, while searching", async () => {
    await renderRail(<Rail groups={GROUPS} searching search={search} />);
    expect(host!.querySelector(".app-rail-group-label")).toBeNull();
    expect(host!.querySelectorAll(".app-rail-group-static").length).toBeGreaterThan(0);
    // All families are open so every match is visible.
    expect(link("alpha")).toBeTruthy();
    expect(link("gamma")).toBeTruthy();
  });

  it("owns an empty state when nothing matches", async () => {
    await renderRail(<Rail groups={[]} searching search={{ value: "zzz", onChange: () => {} }} />);
    expect(host!.querySelector(".app-rail-empty")?.textContent).toContain("zzz");
  });
});
