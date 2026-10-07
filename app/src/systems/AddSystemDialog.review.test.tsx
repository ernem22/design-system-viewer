// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { AddSystemDialog } from "./AddSystemDialog.tsx";

// Issue #216, slice 4: the summary at the top of the Review step — coverage
// present/432, extras with near-miss suggestions, lint warnings, colour
// swatches. Partial import is the default; zero schema tokens is the only
// hard fail.

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function renderDialog(onAdd?: (name: string, css: string) => void): Promise<{ added: { name: string; css: string }[] }> {
  const { createRoot } = await import("react-dom/client");
  const added: { name: string; css: string }[] = [];
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <AddSystemDialog
        open
        onOpenChange={() => {}}
        onAdd={(name, css) => {
          added.push({ name, css });
          onAdd?.(name, css);
        }}
        onToast={() => {}}
        onSaved={() => {}}
      />,
    );
  });
  return { added };
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

const reviewPane = () => document.querySelector('[aria-label="Review"]');
const summary = () => document.querySelector('[aria-label="Import summary"]');
const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>(".app-import-dialog button")].find((b) =>
    b.textContent?.trim().startsWith(label),
  );

async function click(el: HTMLElement | undefined): Promise<void> {
  await act(async () => el!.click());
}

async function goToReview(): Promise<void> {
  await click(button("Continue"));
}

async function goToSave(): Promise<void> {
  await click(button("Continue"));
  await click(button("Continue"));
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

describe("AddSystemDialog review summary (#216)", () => {
  it("shows coverage and the extra with its suggestion", async () => {
    await renderDialog();
    const text = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="CSS text"]')!;
    await act(async () => setValue(text, "--color-bg: #fff;\n--colour-bg: #eee;"));
    await goToReview();
    expect(reviewPane()).not.toBeNull();
    expect(summary()?.textContent).toContain("1/432");
    const extras = summary()?.querySelector('[aria-label="Extra tokens"]');
    expect(extras?.textContent).toContain("--colour-bg");
    expect(extras?.textContent).toContain("--color-bg");
  });

  it("lists lint warnings", async () => {
    await renderDialog();
    const text = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="CSS text"]')!;
    await act(async () => setValue(text, "--color-bg: #zzz;"));
    await goToReview();
    const warnings = summary()?.querySelector('[aria-label="Value warnings"]');
    expect(warnings?.textContent).toContain("--color-bg");
    expect(warnings?.textContent).toMatch(/invalid hex/i);
  });

  it("shows a swatch for a colour token", async () => {
    await renderDialog();
    const text = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="CSS text"]')!;
    await act(async () => setValue(text, "--color-bg: #fff;"));
    await goToReview();
    const swatches = summary()?.querySelector('[aria-label="Colour tokens"]');
    expect(swatches?.textContent).toContain("--color-bg");
    expect(swatches?.querySelector(".app-import-swatch")).not.toBeNull();
  });

  it("blocks a source with 0 schema tokens, even when it has declarations", async () => {
    const { added } = await renderDialog();
    const text = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="CSS text"]')!;
    await act(async () => setValue(text, "--not-a-schema-token: 1;\n--also-outside: 2;"));
    await goToSave();
    await click(button("Save system"));
    expect(added).toHaveLength(0);
    expect(document.querySelector(".app-import-error")?.textContent).toMatch(/no schema tokens/i);
  });
});
