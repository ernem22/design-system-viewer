// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import Brand from "./Brand.tsx";

// Issue #89: the legacy viewer's "How to use" button and its #kbdDlg guide
// (index.html:705, 731-779; app.js:1096) were dropped in the React port. This
// suite proves the guide is back, keyboard-reachable, carries the canonical
// schema-name rule, and closes on Escape. It renders through Brand — the one
// always-mounted topbar cluster — because the topbar action cluster (App.tsx)
// and dialog host (Shell.tsx) are held by other open PRs; on the parent commit
// Brand has no help trigger, so every case here is RED there.

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function renderBrand(): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Brand />);
  });
  return host;
}

function helpTrigger(el: HTMLDivElement): HTMLButtonElement {
  return el.querySelector<HTMLButtonElement>(".app-help-trigger")!;
}

async function openHelp(el: HTMLDivElement): Promise<void> {
  await act(async () => helpTrigger(el).click());
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  localStorage.clear();
});

describe("Help dialog (legacy kbdDlg parity)", () => {
  it("restores the 'How to use' topbar affordance the port dropped", async () => {
    const el = await renderBrand();
    const trigger = el.querySelector<HTMLButtonElement>(".app-help-trigger");
    expect(trigger).not.toBeNull();
    expect(trigger!.getAttribute("aria-label")).toBe("How to use");
  });

  it("opens from the trigger and states the canonical schema-name rule", async () => {
    const el = await renderBrand();
    await openHelp(el);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.textContent).toContain("Preview only reads the canonical schema names");
  });

  it("closes on Escape", async () => {
    const el = await renderBrand();
    await openHelp(el);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("closes from the 'Got it' action", async () => {
    const el = await renderBrand();
    await openHelp(el);
    const done = document.querySelector<HTMLButtonElement>(".app-help-done")!;
    await act(async () => done.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
