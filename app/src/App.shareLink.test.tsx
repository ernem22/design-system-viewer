// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Issue #337: a copied view link carried no system data, so a recipient with
// only the bundled catalogue opened some other system. Loading with a valid
// `?s=` now shows the SharedSystemBanner; Dismiss consumes the one-shot
// param. RED on the parent commit, where shareLink.ts does not exist.
vi.mock("./gallery/components/index.ts", () => ({ COMPONENT_ENTRIES: [] }));

import { act } from "react";
import type { Root } from "react-dom/client";
import App from "./App.tsx";
import { encodeSystem } from "./lib/shareLink.ts";
import type { DesignSystem } from "./systems/store.ts";

const seeded = {
  slug: "wire-house",
  name: "Wire house",
  css: ":root { --color-accent: #111111; }",
  groups: [
    {
      id: "color-accent",
      label: "Accent / Brand",
      kind: "color",
      tokens: [{ name: "--color-accent", value: "#111111" }],
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as DesignSystem;

const SHARED_CSS = `:root {
  --shr-one: #111111;
  --shr-two: 8px;
  --shr-three: 4px;
}`;

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

async function waitForBanner(el: HTMLElement): Promise<HTMLElement | null> {
  for (let i = 0; i < 50; i++) {
    const banner = el.querySelector<HTMLElement>(".app-shared-banner");
    if (banner) return banner;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }
  return el.querySelector<HTMLElement>(".app-shared-banner");
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("dsv.app.systems", JSON.stringify([seeded]));
  localStorage.setItem("dsv.app.active", seeded.slug);
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

async function clickButton(banner: HTMLElement, label: string): Promise<void> {
  const button = [...banner.querySelectorAll("button")].find(
    (b) => b.textContent === label,
  );
  expect(button).toBeTruthy();
  await act(async () => {
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("shared-system link (issue #337)", () => {
  it("shows the banner for a valid ?s= and clears s= on Dismiss", async () => {
    const encoded = await encodeSystem({ name: "Shared Three", css: SHARED_CSS });
    window.history.replaceState(null, "", `/?s=${encoded}`);

    const el = await mountApp();
    const banner = await waitForBanner(el);
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain("Shared system");
    expect(banner!.textContent).toContain("Shared Three");
    expect(banner!.textContent).toContain("3 tokens");

    await clickButton(banner!, "Dismiss");

    expect(el.querySelector(".app-shared-banner")).toBeNull();
    // The one-shot param is gone (?sys= remains — "sys=" merely contains
    // the substring "s=", so assert on the parsed param, not the raw string).
    expect(new URLSearchParams(window.location.search).has("s")).toBe(false);
  });

  it("Open applies the shared tokens for the session without saving", async () => {
    const encoded = await encodeSystem({ name: "Shared Three", css: SHARED_CSS });
    window.history.replaceState(null, "", `/?s=${encoded}`);

    const el = await mountApp();
    const banner = await waitForBanner(el);
    expect(banner).not.toBeNull();
    await clickButton(banner!, "Open");

    // The Tokens tab shows the three shared tokens, from the session system.
    expect(el.querySelector('[data-token="--shr-one"]')).not.toBeNull();
    expect(el.querySelector('[data-token="--shr-two"]')).not.toBeNull();
    expect(el.querySelector('[data-token="--shr-three"]')).not.toBeNull();
    // Nothing saved: the stored list still holds only the seeded system.
    const stored = JSON.parse(localStorage.getItem("dsv.app.systems") ?? "[]") as unknown[];
    expect(stored).toHaveLength(1);
    expect(new URLSearchParams(window.location.search).has("s")).toBe(false);
  });

  it("Add to my systems saves, and the system survives a reload", async () => {
    const encoded = await encodeSystem({ name: "Shared Three", css: SHARED_CSS });
    window.history.replaceState(null, "", `/?s=${encoded}`);

    const el = await mountApp();
    const banner = await waitForBanner(el);
    expect(banner).not.toBeNull();
    await clickButton(banner!, "Add to my systems");

    const stored = JSON.parse(localStorage.getItem("dsv.app.systems") ?? "[]") as { name: string }[];
    expect(stored.map((s) => s.name)).toContain("Shared Three");

    // A reload (fresh mount, no `s`) has no banner and names the system in
    // the switcher.
    act(() => root?.unmount());
    root = null;
    host?.remove();
    host = null;
    const reloaded = await mountApp();
    expect(reloaded.querySelector(".app-shared-banner")).toBeNull();
    expect(new URLSearchParams(window.location.search).has("s")).toBe(false);
    expect(reloaded.textContent).toContain("Shared Three");
  });

  it("reports refused values in the banner without fetching them", async () => {
    const encoded = await encodeSystem({
      name: "Shared Unsafe",
      css: ":root { --shr-ok: #111111; --shr-x: url(https://e.example/a.png); }",
    });
    window.history.replaceState(null, "", `/?s=${encoded}`);

    const el = await mountApp();
    const banner = await waitForBanner(el);
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain("1 dropped");
    expect(el.querySelector('[data-token="--shr-x"]')).toBeNull();
  });
});
