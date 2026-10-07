// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Issue #277, slice 2: the per-system dark variant is retired. With a system
// that ships `themes.dark` and a stale `?dark=1` in the URL, App renders no
// "Dark" switch, applies the base (light) value to the root element, and
// drops the param on the next URL write. RED on the parent commit, where the
// switch renders, the dark override is applied, and the param survives.
vi.mock("./gallery/components/index.ts", () => ({ COMPONENT_ENTRIES: [] }));

import { act } from "react";
import type { Root } from "react-dom/client";
import App from "./App.tsx";
import type { DesignSystem } from "./systems/store.ts";

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
  themes: { dark: [{ name: TOKEN, value: "#000000" }] },
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
  window.history.replaceState(null, "", "/?dark=1");
  document.documentElement.style.removeProperty(TOKEN);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  document.documentElement.style.removeProperty(TOKEN);
  localStorage.clear();
});

describe("per-system dark variant retired (#277)", () => {
  it("ignores a stale ?dark=1: no switch, base value, param dropped", async () => {
    const el = await mountApp();

    expect(el.querySelector(".app-dark-switch")).toBeNull();
    expect(el.querySelector(".app-dark")).toBeNull();
    expect(document.documentElement.style.getPropertyValue(TOKEN)).toBe("#111111");
    expect(new URLSearchParams(window.location.search).has("dark")).toBe(false);
  });
});
