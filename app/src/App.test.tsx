// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The full component gallery is irrelevant here (and heavy); this test is
// about App's dark-flag wiring, so render the shell with no gallery entries.
vi.mock("./gallery/components/index.ts", () => ({ COMPONENT_ENTRIES: [] }));

import { act } from "react";
import type { Root } from "react-dom/client";
import App from "./App.tsx";
import type { DesignSystem } from "./systems/store.ts";
import { selectScope } from "./lib/tokenOverrides.ts";

// Issue #37, App-wiring follow-up: the fixer commit `bc61a74` taught the
// Tokens model and the Preview inspector to take a `dark` flag, but the live
// app never passed it, so the `themes.dark` overlay could not take effect.
// This mounts the real App against a dark-themed system, turns the topbar
// Dark switch on, and reads the value each panel actually renders.

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

/** Tokens tab inspector value — read through useTokensView's valueMap. */
function tokensValue(el: HTMLElement): string {
  return el.querySelector(".tok-inspector-value")?.textContent ?? "";
}

/** Preview tab inspector value — read through PreviewProps' valueOf. */
function previewValue(el: HTMLElement): string {
  return el.querySelector(".dsv-token-row-value")?.textContent ?? "";
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

describe("App dark-variant wiring", () => {
  it("shows the dark override in both token panels once Dark is on", async () => {
    const el = await mountApp();

    // Open the Preview inspector on the same token the Tokens inspector will
    // show, so both panels read the one shared token-value source.
    await act(async () => {
      selectScope({ id: "wire", title: "Wire", tokens: [TOKEN] });
    });

    // Select the token in the Tokens gallery -> TokensProps shows valueMap's
    // value for it (not the raw group value).
    const swatch = el.querySelector<HTMLElement>(`.tok-swatch[data-token="${TOKEN}"]`);
    expect(swatch).not.toBeNull();
    await act(async () => {
      swatch!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Dark off: both panels show the light value.
    expect(tokensValue(el)).toBe("#111111");
    expect(previewValue(el)).toBe("#111111");

    // Flip the topbar Dark switch.
    const toggle = el.querySelector<HTMLElement>(".app-dark-switch");
    expect(toggle).not.toBeNull();
    await act(async () => {
      toggle!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // With dark on, the value both panels show for the dark-overridden token
    // must be the dark value.
    expect(tokensValue(el)).toBe("#000000");
    expect(previewValue(el)).toBe("#000000");
  });
});
