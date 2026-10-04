// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Full gallery is irrelevant (and heavy); this test is about App's viewer dark
// control being reachable regardless of what the active system ships.
vi.mock("./gallery/components/index.ts", () => ({ COMPONENT_ENTRIES: [] }));

import { act } from "react";
import type { Root } from "react-dom/client";
import App from "./App.tsx";
import type { DesignSystem } from "./systems/store.ts";

// Literal (not imported from lib/viewerDark.ts) so this file still compiles —
// and its first assertion still runs — on the parent commit, where that module
// does not exist. That keeps the RED failure the assertion, not a resolution
// error.
const VIEWER_DARK_KEY = "dsv.viewer.dark";

// Issue #115: 35 of the 37 catalogue systems ship no `themes.dark`, so the
// per-system Dark switch is not rendered for them. This mounts the shell with
// a system that has no dark theme and asserts the viewer dark control is still
// reachable and still repaints the chrome. On the parent commit the control is
// absent (App.tsx only renders `.app-dark-switch` when `active.themes.dark`
// exists), so the first querySelector assertion is the RED line.

const lightOnly = {
  slug: "wire-light",
  name: "Wire light",
  css: `:root { --color-accent: #111111; }`,
  groups: [
    {
      id: "color-accent",
      label: "Accent / Brand",
      kind: "color",
      tokens: [{ name: "--color-accent", value: "#111111" }],
    },
  ],
  // no `themes.dark` — the common case in the catalogue.
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as DesignSystem;

const darkThemed = {
  ...lightOnly,
  slug: "wire-dark",
  name: "Wire dark",
  themes: { dark: [{ name: "--color-accent", value: "#000000" }] },
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

function setSystems(list: DesignSystem[], activeSlug: string) {
  localStorage.setItem("dsv.app.systems", JSON.stringify(list));
  localStorage.setItem("dsv.app.active", activeSlug);
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("App viewer dark control (#115)", () => {
  it("is reachable for a system that ships no dark theme", async () => {
    setSystems([lightOnly], lightOnly.slug);
    const el = await mountApp();

    // The system-variant switch is (correctly) absent here.
    expect(el.querySelector(".app-dark-switch")).toBeNull();

    const toggle = el.querySelector<HTMLElement>(".app-viewer-dark-switch");
    expect(toggle).not.toBeNull();
    expect(toggle!.getAttribute("aria-checked")).toBe("false");
  });

  it("repaints the viewer chrome when switched on", async () => {
    setSystems([lightOnly], lightOnly.slug);
    const el = await mountApp();

    const toggle = el.querySelector<HTMLElement>(".app-viewer-dark-switch");
    expect(toggle).not.toBeNull();
    expect(document.documentElement.dataset.theme).toBe("light");

    await act(async () => {
      toggle!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(toggle!.getAttribute("aria-checked")).toBe("true");
    expect(localStorage.getItem(VIEWER_DARK_KEY)).toBe("1");
  });

  it("is present even for a system that does ship a dark theme", async () => {
    setSystems([darkThemed], darkThemed.slug);
    const el = await mountApp();
    expect(el.querySelector(".app-viewer-dark-switch")).not.toBeNull();
  });

  it("is present with an empty catalogue (no active system)", async () => {
    setSystems([], "");
    const el = await mountApp();
    expect(el.querySelector(".app-viewer-dark-switch")).not.toBeNull();
  });
});
