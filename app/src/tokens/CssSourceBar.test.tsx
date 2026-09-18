// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { CssSourceBar } from "./CssSourceBar.tsx";
import type { PushToast } from "../lib/toasts.ts";

// Tone parity with legacy (issue #34): the empty-URL notice and the
// non-.css-file notice were soft `warn`s in src/viewer/app.js (lines
// 1025/1049), but the port downgraded them to `err`. A cancel stays silent in
// both, so only real input problems speak.

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function render(onToast: PushToast): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<CssSourceBar onLoad={() => {}} onToast={onToast} />);
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

function button(el: HTMLElement, label: string): HTMLButtonElement {
  const found = [...el.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  );
  if (!found) throw new Error(`no "${label}" button`);
  return found as HTMLButtonElement;
}

function fileInput(el: HTMLElement): HTMLInputElement {
  const found = el.querySelector<HTMLInputElement>('input[type="file"]');
  if (!found) throw new Error("no file input");
  return found;
}

async function pick(el: HTMLElement, files: File[]): Promise<void> {
  const input = fileInput(el);
  Object.defineProperty(input, "files", { configurable: true, value: files });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("CssSourceBar", () => {
  it("warns, rather than errors, when Fetch is clicked with an empty URL", async () => {
    const onToast = vi.fn();
    const el = await render(onToast);

    await act(async () => {
      button(el, "Fetch").click();
    });

    expect(onToast).toHaveBeenCalledWith("Enter a stylesheet URL", "warn");
  });

  it("warns for a non-.css file but stays silent when the picker is cancelled", async () => {
    const onToast = vi.fn();
    const el = await render(onToast);

    // Cancel: the picker resolves with no file — no toast at all.
    await pick(el, []);
    expect(onToast).not.toHaveBeenCalled();

    // A real wrong-type pick is the only case that speaks, and it warns.
    await pick(el, [new File(["{}"], "tokens.json", { type: "application/json" })]);
    expect(onToast).toHaveBeenCalledWith("Only .css files", "warn");
  });
});
