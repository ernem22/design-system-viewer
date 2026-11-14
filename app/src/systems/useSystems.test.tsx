// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { useSystems } from "./store.ts";

// Issue #91: the systems load swallowed its failure into the seed with no
// signal, so Preview could not tell a failed load from a loaded app. These
// cases pin the signal: the reason is reported on failure, the seed fallback
// still populates the gallery, and neither a stored list nor a deliberate
// empty list (the no-systems empty state) reports a failure.

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let current: ReturnType<typeof useSystems> | null = null;

function Harness() {
  current = useSystems();
  return null;
}

async function mount(): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Harness />);
  });
  // The fetch resolves on a microtask after the effect runs; flush it.
  await act(async () => {});
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
  current = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("useSystems load failure", () => {
  it("reports the reason and keeps the seed fallback when the index fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await mount();

    expect(current!.loading).toBe(false);
    expect(current!.error).toBe("Failed to fetch");
    // The seed fallback is kept: the gallery renders with fallback tokens.
    expect(current!.systems).toHaveLength(1);
    expect(current!.active).not.toBeNull();
  });

  it("reports a non-OK index response by its status line", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500, statusText: "Internal Server Error" })),
    );
    await mount();

    expect(current!.error).toBe("500 Internal Server Error");
    expect(current!.systems).toHaveLength(1);
  });

  it("reports no failure when systems come from this browser (no fetch)", async () => {
    localStorage.setItem(
      "dsv.app.systems",
      JSON.stringify([
        { slug: "s1", name: "S1", css: "", groups: [], createdAt: "", updatedAt: "" },
      ]),
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await mount();

    expect(current!.loading).toBe(false);
    expect(current!.error).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports no failure for a deliberately empty stored list — the empty state", async () => {
    localStorage.setItem("dsv.app.systems", "[]");
    await mount();

    expect(current!.loading).toBe(false);
    expect(current!.error).toBeNull();
    expect(current!.systems).toHaveLength(0);
    expect(current!.active).toBeNull();
  });
});
