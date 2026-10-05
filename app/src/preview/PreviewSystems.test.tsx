// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The full component gallery is irrelevant here (and heavy); one stub entry
// keeps the Preview outline non-empty so the test proves the rail holds both
// the outline and the system list, while mounting as fast as App.test.tsx.
vi.mock("../gallery/components/index.ts", () => ({
  COMPONENT_ENTRIES: [{ id: "wire", label: "Wire", desc: "", Body: () => null }],
}));

import { act } from "react";
import type { Root } from "react-dom/client";
import App from "../App.tsx";
import { PreviewSystems } from "./PreviewSystems.tsx";
import type { DesignSystem } from "../systems/store.ts";

// Issue #16: the Preview tab's left rail only ever showed the
// component/section outline — the design-system list lived only in the topbar
// SystemSwitcher. PreviewSystems renders that list into the Preview rail slot
// alongside <Rail>, sharing activeSlug with the switcher so they never drift.

const sysA = {
  slug: "aurora",
  name: "Aurora",
  css: ":root { --color-accent: #111111; }",
  groups: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as DesignSystem;

const sysB = {
  slug: "chatgpt",
  name: "ChatGPT",
  css: ":root { --color-accent: #222222; }",
  groups: [],
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

function switchToTab(el: HTMLElement, label: string): HTMLElement {
  const trigger = [...el.querySelectorAll<HTMLElement>(".app-tabs button")].find(
    (b) => b.textContent === label,
  );
  if (!trigger) throw new Error(`no ${label} tab trigger`);
  return trigger;
}

/** Rail panels in tab order: tokens, preview, compare (Shell forceMounts all). */
function railPanels(el: HTMLElement): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>('#app-rail [role="tabpanel"]')];
}

function railButtonFor(panel: HTMLElement, name: string): HTMLButtonElement | undefined {
  return [...panel.querySelectorAll<HTMLButtonElement>("button.app-rail-link")].find(
    (b) => b.textContent === name,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("dsv.app.systems", JSON.stringify([sysA, sysB]));
  localStorage.setItem("dsv.app.active", sysA.slug);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  localStorage.clear();
});

describe("PreviewSystems unit", () => {
  it("returns null with no systems", async () => {
    const { createRoot } = await import("react-dom/client");
    const el = document.createElement("div");
    document.body.appendChild(el);
    const r = createRoot(el);
    await act(async () => {
      r.render(<PreviewSystems systems={[]} activeSlug="" onSelect={() => {}} />);
    });
    expect(el.querySelector(".app-rail-group")).toBeNull();
    act(() => r.unmount());
    el.remove();
  });
});

describe("Preview tab rail systems list (issue #16)", () => {
  it("shows the outline and the system list together on the Preview tab", async () => {
    const el = await mountApp();
    const trigger = switchToTab(el, "Preview");
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const panels = railPanels(el);
    expect(panels).toHaveLength(3);
    const preview = panels[1];
    // RED on the parent: the Preview rail holds no system list, so neither
    // button exists there.
    expect(railButtonFor(preview, "Aurora")).toBeTruthy();
    expect(railButtonFor(preview, "ChatGPT")).toBeTruthy();
    // The component/section outline is still present alongside it.
    expect(preview.querySelector("a.app-rail-link")).not.toBeNull();
  });

  it("picking a rail system changes the topbar switcher too", async () => {
    const el = await mountApp();
    const trigger = switchToTab(el, "Preview");
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const switcher = () => el.querySelector<HTMLElement>(".app-sysbtn");
    expect(switcher()?.getAttribute("aria-label")).toContain("Aurora");

    const preview = railPanels(el)[1];
    const chatgpt = railButtonFor(preview, "ChatGPT");
    expect(chatgpt).toBeTruthy();
    await act(async () => {
      chatgpt!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Both controls share activeSlug: the rail pick moves the topbar, and the
    // rail marks the new active via aria-current.
    expect(switcher()?.getAttribute("aria-label")).toContain("ChatGPT");
    expect(railButtonFor(railPanels(el)[1], "ChatGPT")?.getAttribute("aria-current")).toBe(
      "true",
    );
    expect(
      railButtonFor(railPanels(el)[1], "Aurora")?.getAttribute("aria-current"),
    ).toBeNull();
  });

  it("leaves the Tokens and Compare rails unaffected", async () => {
    const el = await mountApp();
    const panels = railPanels(el);
    expect(panels).toHaveLength(3);
    // Tokens rail has no PreviewSystems list — no system-name buttons there.
    expect(railButtonFor(panels[0], "Aurora")).toBeUndefined();
    expect(railButtonFor(panels[0], "ChatGPT")).toBeUndefined();
    // Compare keeps its own multi-select chips, not this single-select list.
    expect(panels[2].querySelectorAll(".cmp-chip")).toHaveLength(2);
    expect(railButtonFor(panels[2], "Aurora")).toBeUndefined();
  });
});
