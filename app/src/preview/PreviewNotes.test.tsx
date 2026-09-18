// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import type { DesignSystem } from "../systems/store.ts";
import { PreviewNotes } from "./PreviewNotes.tsx";

// Issue #91: Preview had no zero-systems or load-error state — with no active
// system PreviewNotes returned null and App still rendered the component
// gallery. These cases pin the three load states that replace it.

const system = {
  slug: "probe",
  name: "Probe",
  css: ":root { --color-bg: #ffffff; }",
  groups: [
    {
      id: "color-bg",
      label: "Background",
      kind: "color",
      tokens: [{ name: "--color-bg", value: "#ffffff" }],
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as DesignSystem;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function mount(node: ReactNode): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(node);
  });
  return host;
}

function text(el: HTMLDivElement): string {
  return el.textContent ?? "";
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  vi.unstubAllGlobals();
});

describe("PreviewNotes load states", () => {
  it("renders the app's zero-systems empty state when no system is loaded", async () => {
    const el = await mount(<PreviewNotes system={null} />);

    // Reuses the app's existing empty-state chrome (shell/Welcome).
    expect(el.querySelector(".app-welcome")).not.toBeNull();
    expect(text(el)).toContain("No systems yet");
    // And never the failure state.
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(text(el)).not.toContain("Failed to load system");
  });

  it("wires the empty state's paste and upload affordances", async () => {
    const onPaste = vi.fn();
    const onUpload = vi.fn();
    const el = await mount(<PreviewNotes system={null} onPaste={onPaste} onUpload={onUpload} />);

    const cards = el.querySelectorAll<HTMLButtonElement>(".app-welcome-card");
    expect(cards).toHaveLength(2);
    await act(async () => {
      cards[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
      cards[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onPaste).toHaveBeenCalledTimes(1);
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it("renders the load-failure notice, with the reason, beside the fallback system", async () => {
    const el = await mount(<PreviewNotes system={system} error="Failed to fetch" />);

    const alert = el.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toBe(
      "Failed to load system (Failed to fetch). Components shown with fallback tokens.",
    );
    // Distinct from the empty state: no Welcome chrome, no CTA.
    expect(el.querySelector(".app-welcome")).toBeNull();
    expect(text(el)).not.toContain("No systems yet");
  });

  it("shows a loading placeholder instead of the empty state while the index is in flight", async () => {
    const el = await mount(<PreviewNotes system={null} loading />);
    expect(text(el)).toContain("Loading systems…");
    expect(el.querySelector(".app-welcome")).toBeNull();
  });

  it("falls through to the notes — not a load state — once a system is present", async () => {
    const el = await mount(<PreviewNotes system={system} />);
    expect(el.querySelector(".app-welcome")).toBeNull();
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(text(el)).not.toContain("No systems yet");
  });
});
