// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The full component gallery is irrelevant here; render the shell with no
// gallery entries.
vi.mock("./gallery/components/index.ts", () => ({ COMPONENT_ENTRIES: [] }));

import { act } from "react";
import type { Root } from "react-dom/client";
import App from "./App.tsx";
import type { DesignSystem } from "./systems/store.ts";
import { getInspectorState, selectScope } from "./lib/tokenOverrides.ts";

// Issue #37, App-wiring follow-up: the Tokens model and the Preview inspector
// share one token-value source (see PreviewProps.test.tsx).

const TOKEN = "--color-accent";

const darkThemed = {
  slug: "wire-dark",
  name: "Wire dark",
  css: `:root { ${TOKEN}: #222222; }`,
  groups: [
    {
      id: "color-accent",
      label: "Accent / Brand",
      kind: "color",
      tokens: [{ name: TOKEN, value: "#111111" }],
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as DesignSystem;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function mountApp(): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<App />);
  });
  return host;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("dsv.app.systems", JSON.stringify([darkThemed]));
  localStorage.setItem("dsv.app.active", darkThemed.slug);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  selectScope(null);
  localStorage.clear();
});

// Issue #95: App.tsx rendered a full <Rail>/<CompareRail> (each with its own
// `.app-rail-inner`) inside every tab panel, so the "common" rail was really
// three force-mounted frames. The shell must own one frame; a tab supplies
// content. This fails on the parent commit with 3 `.app-rail-inner` nodes.
describe("App shell rail frame (issue #95)", () => {
  it("renders exactly one rail frame and keeps it across a tab switch", async () => {
    const el = await mountApp();

    const before = el.querySelectorAll<HTMLElement>(".app-rail-inner");
    expect(before).toHaveLength(1);

    // A tab switch must not rebuild the frame — one element now, so a rebuild
    // would reset the scroll position the single scroller is supposed to keep.
    const frame = before[0];
    frame.scrollTop = 120;

    const trigger = [...el.querySelectorAll<HTMLElement>(".app-tabs button")].find(
      (b) => b.textContent === "Preview",
    );
    expect(trigger).toBeTruthy();
    await act(async () => {
      trigger!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const after = el.querySelectorAll<HTMLElement>(".app-rail-inner");
    expect(after).toHaveLength(1);
    expect(after[0]).toBe(frame);
    expect(after[0].scrollTop).toBe(120);
  });
});

// Issue #119: the docked Preview inspector's Escape belonged to no surface —
// a global document listener live whenever a scope was selected. Because Shell
// force-mounts every tab's props panel, Escape on the Tokens tab reached it and
// silently cleared the Preview selection, and the token-filter Escape
// double-fired into it. These drive the real App with a scope selected while
// the Tokens tab is showing.
describe("docked inspector Escape scoping (#119)", () => {
  function pressEscape(): KeyboardEvent {
    return new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  }

  it("does not close the Preview inspector on Escape from the Tokens tab", async () => {
    await mountApp();
    // The default tab is Tokens; select a Preview scope as if it had been
    // opened there and the user tabbed away.
    await act(async () => {
      selectScope({ id: "wire", title: "Wire", tokens: [TOKEN] });
    });
    expect(getInspectorState().selected).not.toBeNull();

    await act(async () => {
      document.body.dispatchEvent(pressEscape());
    });

    // On the parent commit the force-mounted panel's document listener ran and
    // cleared this to null.
    expect(getInspectorState().selected).not.toBeNull();
  });

  it("clears the token filter with Escape without closing the Preview inspector", async () => {
    const el = await mountApp();
    await act(async () => {
      selectScope({ id: "wire", title: "Wire", tokens: [TOKEN] });
    });
    const filter = el.querySelector<HTMLInputElement>(".tok-filter")!;
    expect(filter).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(filter, "ac");
      filter.dispatchEvent(new Event("input", { bubbles: true }));
      filter.focus();
    });
    expect(filter.value).toBe("ac");

    await act(async () => {
      filter.dispatchEvent(pressEscape());
    });

    // Clearing the filter is the field's own Escape; it must not reach the
    // docked panel. On the parent commit the panel closed here too.
    expect(filter.value).toBe("");
    expect(getInspectorState().selected).not.toBeNull();
  });
});

// Issue #95, second region: the props frame was still per-tab — each tab
// rendered its own <Props> (a `.app-props-clip`/`.app-props-inner` pair), so
// the shell-owned-one-frame contract held for the rail but not one region
// over. This fails on the pre-fix head with 3 `.app-props-inner` nodes.
describe("App shell props frame (issue #95)", () => {
  it("renders exactly one props frame and keeps it across a tab switch", async () => {
    const el = await mountApp();

    expect(el.querySelectorAll(".app-props-clip")).toHaveLength(1);
    const before = el.querySelectorAll<HTMLElement>(".app-props-inner");
    expect(before).toHaveLength(1);

    // Same identity argument as the rail: one element across a switch, so a
    // rebuild would reset the scroll the single scroller is meant to keep.
    const frame = before[0];
    frame.scrollTop = 200;

    const trigger = [...el.querySelectorAll<HTMLElement>(".app-tabs button")].find(
      (b) => b.textContent === "Preview",
    );
    expect(trigger).toBeTruthy();
    await act(async () => {
      trigger!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(el.querySelectorAll(".app-props-clip")).toHaveLength(1);
    const after = el.querySelectorAll<HTMLElement>(".app-props-inner");
    expect(after).toHaveLength(1);
    expect(after[0]).toBe(frame);
    expect(after[0].scrollTop).toBe(200);
  });
});

// Issue #117: the document had 0 <h1> and 94 <h2> — the outline had no top at
// all. The shell supplies exactly one h1 for the page; sections and blocks stay
// below it. This fails on the parent commit with 0 h1 nodes.
describe("App heading outline (issue #117)", () => {
  it("renders exactly one h1 as the document's outline root", async () => {
    const el = await mountApp();
    const h1s = el.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe("Design System Viewer");
    // The sections it introduces remain lower in the outline.
    expect(el.querySelectorAll("h2").length).toBeGreaterThan(0);
  });
});
