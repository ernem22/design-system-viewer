// @vitest-environment happy-dom
// Issue #341 (fixer): TypeTokenRow's fallback oscillated — the effect measured
// the visible (short-dependent) text with deps on `short`, so a large size
// flipped sentence → "Ag" → sentence → … and never stably showed "Ag".
// The fix measures the full sentence via a hidden sizer with deps on the
// token identity. happy-dom has no layout engine, so scrollWidth/clientWidth
// are stubbed: the full sentence overflows (500 > 100) while "Ag" fits.
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";

const FULL = "Aa Bb Cc — sample text 0123";
const SHORT = "Ag";

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let restores: Array<() => void> = [];
let measureCalls = 0;

function stubLayout() {
  const swDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");
  const cwDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get(this: HTMLElement) {
      if (!this.classList?.contains("tok-typespec-fit")) return 0;
      measureCalls++;
      // Fail fast instead of hanging the runner on the old render loop.
      if (measureCalls > 10) throw new Error("type-fallback loop: measured >10 times");
      // The hidden sizer always holds the full sentence; the visible specimen
      // holds whichever text the fallback picked.
      if (this.getAttribute("aria-hidden") === "true") return 500;
      return this.textContent?.includes("Bb") ? 500 : 20;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      if (this.classList?.contains("tok-typespec-fit")) return 100;
      return 0;
    },
  });
  restores.push(() => {
    if (swDesc) Object.defineProperty(HTMLElement.prototype, "scrollWidth", swDesc);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>)["scrollWidth"];
    if (cwDesc) Object.defineProperty(HTMLElement.prototype, "clientWidth", cwDesc);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>)["clientWidth"];
  });
}

async function renderTypeRow() {
  const { createRoot } = await import("react-dom/client");
  const { TypeRow } = await import("./rows.tsx");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <TypeRow
        tokens={[{ name: "--font-size-display-xl", value: "8rem" }]}
        selectedName={null}
        onPick={() => {}}
        editingName={null}
        onEdit={() => {}}
        onSave={() => {}}
      />,
    );
  });
  await act(async () => {});
  return host;
}

afterEach(() => {
  try {
    if (root) act(() => root!.unmount());
  } catch {
    /* noop */
  }
  root = null;
  host?.remove();
  host = null;
  restores.forEach((fn) => {
    try {
      fn();
    } catch {
      /* noop */
    }
  });
  restores = [];
  measureCalls = 0;
});

describe("type fallback is one-way stable (issue #341)", () => {
  it("stably shows Ag for an overflowing large size without looping renders", async () => {
    stubLayout();
    const el = await renderTypeRow();
    const specimen = el.querySelector<HTMLElement>(".tok-row-demo .tok-typespec-fit:not([aria-hidden])");
    expect(specimen?.textContent).toBe(SHORT);
    expect(measureCalls).toBeLessThanOrEqual(3);
    // A further flush must not flip back to the sentence.
    await act(async () => {});
    expect(el.querySelector<HTMLElement>(".tok-row-demo .tok-typespec-fit:not([aria-hidden])")?.textContent).toBe(
      SHORT,
    );
    expect(measureCalls).toBeLessThanOrEqual(3);
  });

  it("keeps the full sentence while it fits", async () => {
    stubLayout();
    const el = await renderTypeRow();
    // Widen the column so the sentence fits: clientWidth now exceeds the
    // full-sentence width, then re-measure via resize.
    const cwDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get(this: HTMLElement) {
        if (this.classList?.contains("tok-typespec-fit")) return 600;
        return 0;
      },
    });
    restores.push(() => {
      if (cwDesc) Object.defineProperty(HTMLElement.prototype, "clientWidth", cwDesc);
    });
    await act(async () => {
      window.dispatchEvent(new window.Event("resize"));
    });
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(
      el.querySelector<HTMLElement>(".tok-row-demo .tok-typespec-fit:not([aria-hidden])")?.textContent,
    ).toBe(FULL);
  });
});
