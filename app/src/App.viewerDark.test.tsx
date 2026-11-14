// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Issue #276, slice 1: the viewer dark chrome is retired. The always-present
// topbar switch ("Viewer dark mode") and the `html[data-theme="dark"]` chrome
// rules are gone; a stale `dsv.viewer.dark` value in localStorage is never
// read. The per-system Dark variant (`.app-dark-switch`, `themes.dark`) is
// slice 2 and is untouched here.
vi.mock("./gallery/components/index.ts", () => ({ COMPONENT_ENTRIES: [] }));

import { act } from "react";
import type { Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import App from "./App.tsx";
import type { DesignSystem } from "./systems/store.ts";

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
  // A stale pre-retirement value: must be ignored, never applied.
  localStorage.setItem("dsv.app.systems", JSON.stringify([lightOnly]));
  localStorage.setItem("dsv.app.active", lightOnly.slug);
  localStorage.setItem("dsv.viewer.dark", "1");
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

describe("viewer dark chrome retired (#276)", () => {
  it("renders no control named Viewer dark mode", async () => {
    const el = await mountApp();
    expect(el.querySelector('[aria-label="Viewer dark mode"]')).toBeNull();
    expect(el.querySelector(".app-viewer-dark-switch")).toBeNull();
    expect(el.querySelector(".app-viewer-dark")).toBeNull();
  });

  it("ignores a stale dsv.viewer.dark value", async () => {
    await mountApp();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("has no html[data-theme=\"dark\"] rule in shell.css", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/shell/shell.css"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).not.toContain('html[data-theme="dark"]');
    expect(css).not.toContain("app-viewer-dark");
  });
});
