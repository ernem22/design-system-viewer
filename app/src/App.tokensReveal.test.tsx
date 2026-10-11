// @vitest-environment happy-dom
// Issue #315: on a phone the properties panel is a closed overlay drawer, so
// tapping a token row copied it and toasted but showed no inspector — a dead
// click. Selecting a token (click, Enter/Space, double-click) must reveal the
// props drawer on narrow viewports, exactly like the Preview token badge
// already reveals it. Desktop behaviour must not change (no open/close, no
// `dsv.app.props` write).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The gallery is irrelevant here; render the shell with no gallery entries
// (same stub as App.test.tsx / panels282.test.tsx).
vi.mock("./gallery/components/index.ts", () => ({ COMPONENT_ENTRIES: [] }));

import { act } from "react";
import type { Root } from "react-dom/client";
import App from "./App.tsx";
import type { DesignSystem } from "./systems/store.ts";

function stubMatchMedia(matches: boolean): void {
  const mql = {
    matches,
    media: "",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
    onchange: null,
  };
  vi.stubGlobal("matchMedia", vi.fn(() => mql));
}

// A single spacing token renders through BarRow -> TokenRow, i.e. `.tok-row`
// (color groups render swatches/ramps instead, so they cannot drive the row
// click the issue describes).
const TOKEN = "--space-4";
const system = {
  slug: "probe",
  name: "Probe",
  css: `:root { ${TOKEN}: 16px; }`,
  groups: [
    {
      id: "spacing",
      label: "Spacing",
      kind: "length",
      tokens: [{ name: TOKEN, value: "16px" }],
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

function clipOpen(el: Element, selector: string): string | null {
  return el.querySelector(selector)?.getAttribute("data-open") ?? null;
}

function firstRow(el: Element): HTMLElement {
  const row = el.querySelector<HTMLElement>(".tok-row");
  if (!row) throw new Error("no .tok-row rendered");
  return row;
}

function clickRow(row: HTMLElement): void {
  act(() => {
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("dsv.app.systems", JSON.stringify([system]));
  localStorage.setItem("dsv.app.active", system.slug);
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  vi.unstubAllGlobals();
});

describe("issue #315 RED: selecting a token reveals the props drawer on a phone", () => {
  it("opens the props drawer when a token row is clicked", async () => {
    stubMatchMedia(true);
    const el = await mountApp();
    expect(clipOpen(el, ".app-props-clip")).toBe("false");

    clickRow(firstRow(el));

    expect(clipOpen(el, ".app-props-clip")).toBe("true");
  });

  it("does not toggle the drawer closed when the same token is selected again", async () => {
    stubMatchMedia(true);
    const el = await mountApp();
    const row = firstRow(el);

    clickRow(row);
    expect(clipOpen(el, ".app-props-clip")).toBe("true");

    clickRow(row);
    expect(clipOpen(el, ".app-props-clip")).toBe("true");
  });

  it("keeps the drawer open across a real tap (pointerdown then click) on the open row", async () => {
    stubMatchMedia(true);
    const el = await mountApp();
    const row = firstRow(el);

    // Desktop-style first tap: pointerdown outside the drawer must not be
    // treated as a dismiss when it lands on a token row, then click reveals.
    act(() => {
      row.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(clipOpen(el, ".app-props-clip")).toBe("true");

    // Second tap on the same (already selected) row: pointerdown must not
    // close the drawer, and the click cannot re-open what it never closed.
    act(() => {
      row.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(clipOpen(el, ".app-props-clip")).toBe("true");
  });

  it("reveals the props drawer through a keyboard pick too", async () => {
    stubMatchMedia(true);
    const el = await mountApp();
    act(() => {
      firstRow(el).dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(clipOpen(el, ".app-props-clip")).toBe("true");
  });
});

describe("issue #315: desktop selection is unchanged", () => {
  it("leaves the panel hidden and never writes the preference when selecting", async () => {
    stubMatchMedia(false);
    localStorage.setItem("dsv.app.props", "closed");
    const el = await mountApp();
    expect(clipOpen(el, ".app-props-clip")).toBe("false");

    clickRow(firstRow(el));

    expect(clipOpen(el, ".app-props-clip")).toBe("false");
    expect(localStorage.getItem("dsv.app.props")).toBe("closed");
  });
});