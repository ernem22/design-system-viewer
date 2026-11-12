// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { useScrollSpy, DEFAULT_LANDING_OFFSET_PX } from "./scrollspy.ts";

// useScrollSpy is a hook, so the suite mounts a tiny probe. happy-dom gives it
// the scroller React's listeners attach to, and a fake geometry where "alpha"
// sits on the landing line and "beta" is far below it. There is no click pin
// any more: the shared landing offset makes the scanned id and the clicked id
// agree, so these assert the stateless geometry scan.

interface ProbeApi {
  activeId: string | null;
  enabled: boolean;
  refresh: () => void;
}

let latest: ProbeApi | null = null;
let enabled = true;

function Probe({ ids }: { ids: string[] }) {
  const [activeId, refresh] = useScrollSpy(ids, enabled);
  latest = { activeId, enabled, refresh };
  return createElement("div");
}

function current(): ProbeApi {
  if (!latest) throw new Error("scrollspy probe did not render");
  return latest;
}

function stubTop(el: Element, top: number): void {
  el.getBoundingClientRect = () =>
    ({
      top,
      bottom: top,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as unknown as DOMRect;
}

let root: Root | null = null;
let host: HTMLElement | null = null;

function flush(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  enabled = true;
  document.body.innerHTML = "";

  const scroller = document.createElement("div");
  scroller.className = "app-main";
  stubTop(scroller, 0);
  document.body.appendChild(scroller);

  const alpha = document.createElement("section");
  alpha.id = "alpha";
  stubTop(alpha, 0);
  document.body.appendChild(alpha);

  const beta = document.createElement("section");
  beta.id = "beta";
  stubTop(beta, 500);
  document.body.appendChild(beta);

  host = document.createElement("div");
  document.body.appendChild(host);

  const { createRoot } = await import("react-dom/client");
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(Probe, { ids: ["alpha", "beta"] }));
  });
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  latest = null;
  document.body.innerHTML = "";
});

describe("useScrollSpy stateless scan", () => {
  it("reports the section whose top has passed the landing line", () => {
    expect(current().activeId).toBe("alpha");
  });

  it("follows geometry after a scroll tick", async () => {
    const scroller = document.querySelector<HTMLElement>(".app-main")!;
    scroller.scrollTop = 500;
    await act(async () => {
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      await flush();
    });
    expect(current().activeId).toBe("beta");
  });

  it("resolves the landing offset from the followed element's scroll-margin", () => {
    // happy-dom resolves no cascade, so the fallback stands in for the token.
    expect(DEFAULT_LANDING_OFFSET_PX).toBe(60);
  });

  it("returns null while disabled and resumes without a remount", async () => {
    enabled = false;
    act(() => root?.unmount());
    const { createRoot } = await import("react-dom/client");
    root = createRoot(host!);
    await act(async () => {
      root!.render(createElement(Probe, { ids: ["alpha", "beta"] }));
    });
    expect(current().activeId).toBeNull();

    enabled = true;
    await act(async () => {
      root!.render(createElement(Probe, { ids: ["alpha", "beta"] }));
    });
    expect(current().activeId).toBe("alpha");
  });

  it("returns null when none of the ids are in the DOM", async () => {
    await act(async () => {
      root!.render(createElement(Probe, { ids: ["missing"] }));
    });
    expect(current().activeId).toBeNull();
  });
});
