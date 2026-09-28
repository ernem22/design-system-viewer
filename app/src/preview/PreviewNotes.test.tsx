// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import { useSystems, type DesignSystem } from "../systems/store.ts";
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

// Issue #121: wiring the real store's retry to the notice proves the retry
// re-attempts the load through the existing path — the notice clears and the
// loaded system replaces the fallback, no page reload.
let store: ReturnType<typeof useSystems> | null = null;

function RetryHarness() {
  store = useSystems();
  const { active, loading, error, retry } = store;
  return <PreviewNotes system={active} loading={loading} error={error} onRetry={retry} />;
}

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
  localStorage.clear();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  store = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
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
    // The recovery is added inside the notice, so the message itself is
    // unchanged and there is still exactly one alert region.
    expect(alert!.textContent).toContain(
      "Failed to load system (Failed to fetch). Components shown with fallback tokens.",
    );
    // Distinct from the empty state: no Welcome chrome, no CTA.
    expect(el.querySelector(".app-welcome")).toBeNull();
    expect(text(el)).not.toContain("No systems yet");
  });

  it("offers a retry control in the failure notice that re-attempts the load", async () => {
    const onRetry = vi.fn();
    const el = await mount(<PreviewNotes system={system} error="Failed to fetch" onRetry={onRetry} />);

    // A failed load stays a single alert — recovery is added to it, not a
    // second announcement.
    const alerts = el.querySelectorAll('[role="alert"]');
    expect(alerts).toHaveLength(1);

    const retry = el.querySelector<HTMLButtonElement>('[role="alert"] button');
    expect(retry).not.toBeNull();
    expect(retry!.textContent).toBe("Retry");

    await act(async () => {
      retry!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("a failed retry keeps the same single alert in place, without re-announcing", async () => {
    const onRetry = vi.fn();
    const el = await mount(<PreviewNotes system={system} error="Failed to fetch" onRetry={onRetry} />);
    const before = el.querySelector('[role="alert"]');

    await act(async () => {
      el.querySelector<HTMLButtonElement>('[role="alert"] button')!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    // Same DOM node — no remount, so the alert is not announced twice.
    expect(el.querySelector('[role="alert"]')).toBe(before);
    expect(el.querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect(before!.textContent).toContain("Failed to load system (Failed to fetch).");
  });

  it("does not offer a retry while loading or with zero systems", async () => {
    const loadingEl = await mount(<PreviewNotes system={null} loading />);
    expect(loadingEl.querySelector('[role="alert"]')).toBeNull();
    expect(loadingEl.querySelector("button")).toBeNull();

    act(() => root?.unmount());
    root = null;
    host?.remove();
    host = null;

    const emptyEl = await mount(<PreviewNotes system={null} />);
    expect(emptyEl.querySelector('[role="alert"]')).toBeNull();
    expect(emptyEl.textContent).not.toContain("Retry");
  });

  it("a successful retry clears the notice and swaps in the loaded system", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              slug: "recovered",
              name: "Recovered",
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
            },
          ]),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const el = await mount(<RetryHarness />);
    await act(async () => {});
    expect(el.querySelector('[role="alert"]')).not.toBeNull();

    await act(async () => {
      el.querySelector<HTMLButtonElement>('[role="alert"] button')!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await act(async () => {});

    // Retry went back through the same load path (a second fetch) and the
    // fallback is replaced: the notice is gone and the loaded system is active.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(store!.error).toBeNull();
    expect(store!.systems.map((s) => s.slug)).toEqual(["recovered"]);
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
