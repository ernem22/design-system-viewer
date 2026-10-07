// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { AddSystemDialog } from "./AddSystemDialog.tsx";

// Issue #215, slice 3: the Review step holds the grouped schema fill — one
// collapsible section per schema group over the same `css` string the paste
// path edits, so a single row can be filled without pasting 432 lines and the
// form/paste paths interleave without loss.

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function renderDialog(): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <AddSystemDialog
        open
        onOpenChange={() => {}}
        onAdd={() => {}}
        onToast={() => {}}
        onSaved={() => {}}
      />,
    );
  });
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

const reviewPane = () => document.querySelector('[aria-label="Review"]');
const reviewGroups = () => reviewPane()?.querySelectorAll(".app-fill-group") ?? [];
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

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

describe("AddSystemDialog review fill (#215)", () => {
  it("renders one section per group with correct counts", async () => {
    await renderDialog();
    await goToReview();
    expect(reviewPane()).not.toBeNull();
    // 54 schema groups, each header showing present/expected.
    expect(reviewGroups()).toHaveLength(54);
    expect(reviewPane()?.textContent).toContain("0/432");
  });

  it("filling one row emits exactly that declaration", async () => {
    await renderDialog();
    await goToReview();
    const search = reviewPane()?.querySelector<HTMLInputElement>('input[aria-label="Filter tokens by name"]');
    expect(search).not.toBeNull();
    await act(async () => setValue(search!, "--color-bg"));
    const row = reviewPane()?.querySelector<HTMLInputElement>('input[aria-label="--color-bg"]');
    expect(row).not.toBeNull();
    await act(async () => setValue(row!, "#111"));
    // Exactly that declaration lands in the shared CSS text — go back to the
    // Source paste pane to read it.
    await click(button("Back"));
    const text = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="CSS text"]')!;
    expect(text.value).toBe("--color-bg: #111;\n");
  });

  it("form and paste edits interleave without loss", async () => {
    await renderDialog();
    await goToReview();
    // Paste path first: switch to Paste and type a token.
    await click(button("Paste"));
    const paste = reviewPane()?.querySelector<HTMLTextAreaElement>('textarea[aria-label="Review CSS text"]');
    expect(paste).not.toBeNull();
    await act(async () => setValue(paste!, "--color-bg: #fff;"));
    // Form path keeps it: back on Form the row shows the pasted value…
    await click(button("Form"));
    const pane = reviewPane()!;
    const search = pane.querySelector<HTMLInputElement>('input[aria-label="Filter tokens by name"]')!;
    await act(async () => setValue(search, "--color-bg"));
    expect(pane.querySelector<HTMLInputElement>('input[aria-label="--color-bg"]')!.value).toBe("#fff");
    // …and a form edit lands back in the paste text with the paste kept.
    await act(async () => setValue(pane.querySelector<HTMLInputElement>('input[aria-label="--color-bg"]')!, "#000"));
    await click(button("Paste"));
    expect(
      reviewPane()!.querySelector<HTMLTextAreaElement>('textarea[aria-label="Review CSS text"]')!.value,
    ).toBe("--color-bg: #000;");
  });
});
