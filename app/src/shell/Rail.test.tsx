// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import Rail from "./Rail.tsx";
import type { RailGroups } from "../lib/railTypes.ts";

// Issue #95 moved the rail frame (`.app-rail-clip`/`.app-rail-inner`) out of
// Rail and into the shell's single RailFrame. Rail is now content only and has
// to find that outer scroller to place its sliding indicator. These mount Rail
// inside a stand-in `.app-rail-inner` (what Shell supplies) and drive it the
// way the real frame does.

const GROUPS: RailGroups = [
  [
    "Basics",
    [
      { id: "alpha", label: "Alpha" },
      { id: "beta", label: "Beta" },
    ],
  ],
];

let root: Root | null = null;
let host: HTMLDivElement | null = null;
const originalRect = HTMLElement.prototype.getBoundingClientRect;
const originalRects = HTMLElement.prototype.getClientRects;

// happy-dom measures every element as a zero rect, so the indicator's
// getClientRects() guard would always drop it. Give it a deterministic box.
function box(): DOMRect {
  return {
    top: 10,
    bottom: 34,
    left: 0,
    right: 0,
    width: 0,
    height: 24,
    x: 0,
    y: 10,
    toJSON: () => ({}),
  } as unknown as DOMRect;
}

async function renderRail(searching = false): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  root = createRoot(host!);
  await act(async () => {
    root!.render(
      <div className="app-rail-inner">
        <Rail groups={GROUPS} searching={searching} />
      </div>,
    );
  });
}

function groupContent(): HTMLElement {
  const content = host!.querySelector<HTMLElement>(".app-rail-group-items");
  if (!content) throw new Error("no group content in the rail");
  return content;
}

function groupTrigger(): HTMLButtonElement {
  const trigger = host!.querySelector<HTMLButtonElement>(".app-rail-group-label");
  if (!trigger) throw new Error("no group trigger in the rail");
  return trigger;
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
  HTMLElement.prototype.getBoundingClientRect = () => box();
  HTMLElement.prototype.getClientRects = () => [box()] as unknown as DOMRectList;

  host = document.createElement("div");
  document.body.appendChild(host);
  await renderRail();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host = null;
  HTMLElement.prototype.getBoundingClientRect = originalRect;
  HTMLElement.prototype.getClientRects = originalRects;
  document.body.innerHTML = "";
});

describe("Rail content inside the shared frame", () => {
  it("places the sliding indicator behind the clicked active link", async () => {
    const link = host!.querySelector<HTMLAnchorElement>('a[href="#alpha"]');
    expect(link).toBeTruthy();

    await act(async () => {
      link!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const indicator = host!.querySelector<HTMLElement>(".app-rail-indicator");
    expect(indicator).toBeTruthy();
    expect(indicator!.style.height).toBe("24px");
    expect(link!.getAttribute("aria-current")).toBe("true");
  });

  it("collapses a group on click but forces it open while searching", async () => {
    expect(groupContent().hidden).toBe(false);

    await act(async () => {
      groupTrigger().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(groupContent().hidden).toBe(true);

    act(() => root?.unmount());
    root = null;
    await renderRail(true);
    expect(groupContent().hidden).toBe(false);
  });
});
