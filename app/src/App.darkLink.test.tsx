// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Issue #110: "Copy link to this view" dropped the dark state, so opening the
// copied URL landed with Dark unchecked. This mounts the real App with a
// deep-linked ?dark=1 and asserts the switch comes up on, the dark override is
// what the root element actually receives, and the flag survives the URL sync.
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

describe("App dark deep link (#110)", () => {
  it("restores the dark variant from ?dark=1 and keeps it in the URL", async () => {
    const el = await mountApp();

    expect(el.querySelector<HTMLElement>(".app-dark-switch")?.getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(document.documentElement.style.getPropertyValue(TOKEN)).toBe("#000000");
    expect(window.location.search).toContain("dark=1");
  });
});
