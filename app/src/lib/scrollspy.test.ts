// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { useScrollSpy } from "./scrollspy.ts";

// useScrollSpy is a hook, so the suite mounts a tiny probe. happy-dom gives it
// the scroller React's listeners attach to, and a fake geometry where "alpha"
// sits on the activation line and "beta" is far below it -- so unpinning a
// pin on "beta" is observably different from leaving it alone (it recomputes
// to "alpha").

interface ProbeApi {
  activeId: string | null;
  pin: (id: string) => void;
}

let latest: ProbeApi | null = null;

function Probe() {
  const [activeId, pin] = useScrollSpy(["alpha", "beta"]);
  latest = { activeId, pin };
  return createElement("div");
}

function current(): ProbeApi {
  if (!latest) throw new Error("scrollspy probe did not render");
  return latest;
}

function stubTop(el: Element, top: number): void {
  // happy-dom's default rects are all zeros; distinct tops make the
  // activation-line scan pick a deterministic id per element.
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

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

  const host = document.createElement("div");
  document.body.appendChild(host);

  const { createRoot } = await import("react-dom/client");
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(Probe));
  });
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  latest = null;
  document.body.innerHTML = "";
});

function press(key: string, target: EventTarget = window): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

describe("useScrollSpy", () => {
  it("keeps a click-pinned section while a letter key is typed", () => {
    act(() => current().pin("beta"));
    expect(current().activeId).toBe("beta");

    press("x");

    expect(current().activeId).toBe("beta");
  });

  it("keeps the pin when a scroll key is pressed inside a text input", () => {
    act(() => current().pin("beta"));

    const input = document.createElement("input");
    document.body.appendChild(input);
    press("ArrowDown", input);

    expect(current().activeId).toBe("beta");
  });

  it("releases the pin on a scroll key pressed outside an editable target", () => {
    act(() => current().pin("beta"));

    press("ArrowDown");

    expect(current().activeId).toBe("alpha");
  });

  it("releases the pin on a wheel event", () => {
    act(() => current().pin("beta"));

    act(() => {
      document
        .querySelector(".app-main")!
        .dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    });

    expect(current().activeId).toBe("alpha");
  });
});
