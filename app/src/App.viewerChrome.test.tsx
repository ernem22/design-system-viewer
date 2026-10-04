// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The full gallery is irrelevant here; render the shell with no entries.
vi.mock("./gallery/components/index.ts", () => ({ COMPONENT_ENTRIES: [] }));

import { act } from "react";
import type { Root } from "react-dom/client";
import App from "./App.tsx";
import type { DesignSystem } from "./systems/store.ts";

// Issue #111: the legacy viewer had a theme toggle (`themeBtn` -> legacy
// `data-theme` / `dsv.theme`) and a how-to dialog (`kbdBtn` -> `#kbdDlg`).
// Both were lost in the React migration. This mounts the real App and drives
// the restored controls: the theme survives a reload and honours
// `prefers-color-scheme` on first load; the help dialog carries the
// canonical-name rule and closes on Escape.

const sys = {
  slug: "wire",
  name: "Wire",
  css: ":root { --color-accent: #111111; }",
  groups: [],
  themes: {},
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

async function unmountApp(): Promise<void> {
  await act(async () => root?.unmount());
  root = null;
  host?.remove();
  host = null;
}

function stubPrefersLight(light: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: light && query.includes("prefers-color-scheme: light"),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("dsv.app.systems", JSON.stringify([sys]));
  localStorage.setItem("dsv.app.active", sys.slug);
  window.history.replaceState(null, "", "/");
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("viewer theme toggle (#111)", () => {
  it("defaults from prefers-color-scheme on first load", async () => {
    stubPrefersLight(true);
    await mountApp();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("dsv.theme")).toBe("light");
    await unmountApp();
  });

  it("persists a toggled theme across a reload", async () => {
    stubPrefersLight(false);
    const el = await mountApp();
    const toggle = el.querySelector<HTMLButtonElement>(".viewer-theme-toggle");
    expect(toggle).not.toBeNull();
    // No stored choice + OS dark -> dark viewer.
    expect(document.documentElement.dataset.theme).toBe("dark");

    await act(async () => toggle!.click());
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("dsv.theme")).toBe("light");

    // Reload: OS still dark, but the stored choice must win.
    await unmountApp();
    document.documentElement.removeAttribute("data-theme");
    stubPrefersLight(false);
    await mountApp();
    expect(document.documentElement.dataset.theme).toBe("light");
    await unmountApp();
  });
});

describe("help dialog (#111)", () => {
  it("carries the canonical-name rule and closes on Escape", async () => {
    stubPrefersLight(false);
    const el = await mountApp();
    const help = el.querySelector<HTMLButtonElement>(".viewer-help-trigger");
    expect(help).not.toBeNull();

    await act(async () => help!.click());
    const content = document.querySelector(".viewer-help-content");
    expect(content).not.toBeNull();
    expect(content!.textContent).toContain("canonical schema names");

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.querySelector(".viewer-help-content")).toBeNull();
    await unmountApp();
  });
});
