// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { ImportSheet } from "./ImportSheet.tsx";

// The sheet is one surface: title, subline, one paste buffer, a muted source
// line, a live summary, a collapsed schema helper, identity (new-system mode)
// and one primary action. These tests pin the composition and the write gate.

const JSON_EXPORT = JSON.stringify({
  name: "Aurora",
  slug: "aurora",
  css: "--color-bg: #0a0a0f;\n--color-text: #f0f0f3;",
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let added: { name: string; css: string }[] = [];
let saved: string[] = [];
let opened: boolean[] = [];

async function renderSheet(initialCss?: string): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <ImportSheet
        open
        initialCss={initialCss}
        onOpenChange={(next) => opened.push(next)}
        onAdd={(name, css) => added.push({ name, css })}
        onToast={() => {}}
        onSaved={(tab) => saved.push(tab)}
      />,
    );
  });
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const textPane = () => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="CSS text"]');
const nameField = () => document.querySelector<HTMLInputElement>('input[aria-label="System name"]');

function button(label: string, scope: ParentNode = document): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === label,
  );
}

async function click(el: HTMLElement | undefined): Promise<void> {
  await act(async () => el!.click());
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  added = [];
  saved = [];
  opened = [];
  localStorage.clear();
});

describe("ImportSheet composition", () => {
  it("is one sheet: title, paste buffer, collapsed schema helper, one primary", async () => {
    await renderSheet();
    expect(document.querySelector(".app-import-sheet")).not.toBeNull();
    expect(document.querySelector(".app-import-title")?.textContent).toBe("Add a system");
    expect(document.querySelector(".app-import-sub")?.textContent).toMatch(/nothing is saved/i);
    expect(textPane()).not.toBeNull();
    expect(document.querySelector(".app-import-sourcebar")).not.toBeNull();
    expect(document.querySelector(".app-import-schema")?.hasAttribute("open")).toBe(false);
    expect(nameField()).not.toBeNull();
    expect(button("Save system")).toBeDefined();
    expect(button("Cancel")).toBeDefined();
    // No stepper and no second screen.
    expect(document.querySelector(".app-import-steps")).toBeNull();
  });

  it("marks the content aria-modal on its dialog role", async () => {
    await renderSheet();
    const content = document.querySelector(".app-import-sheet")!;
    expect(content.getAttribute("role")).toBe("dialog");
    expect(content.getAttribute("aria-modal")).toBe("true");
    expect(content.getAttribute("aria-labelledby")).toBeTruthy();
  });

  it("reads a pasted JSON export into the buffer and the name", async () => {
    await renderSheet();
    await act(async () => setValue(textPane()!, JSON_EXPORT));
    expect(textPane()!.value).toBe("--color-bg: #0a0a0f;\n--color-text: #f0f0f3;");
    expect(nameField()!.value).toBe("Aurora");
    expect(document.querySelector(".app-import-source")?.textContent).toContain("JSON export");
  });

  it("opens a dropped JSON export with its css and name", async () => {
    await renderSheet(JSON_EXPORT);
    expect(textPane()!.value).toBe("--color-bg: #0a0a0f;\n--color-text: #f0f0f3;");
    expect(nameField()!.value).toBe("Aurora");
  });
});

describe("ImportSheet write gate", () => {
  it("writes nothing without a schema token, and says why", async () => {
    await renderSheet();
    await act(async () => setValue(textPane()!, "--not-a-schema-token: 1;"));
    await click(button("Save system"));
    expect(added).toHaveLength(0);
    expect(document.querySelector(".app-import-error")?.textContent).toMatch(/no schema tokens/i);
  });

  it("writes on the primary action with the name in the field", async () => {
    await renderSheet();
    await act(async () => setValue(textPane()!, "--color-bg: #fff;"));
    await act(async () => setValue(nameField()!, "Probe"));
    await click(button("Save system"));
    expect(added).toEqual([{ name: "Probe", css: "--color-bg: #fff;" }]);
    expect(opened).toEqual([false]);
    expect(saved).toHaveLength(1);
  });

  it("asks before discarding a non-empty buffer", async () => {
    await renderSheet();
    await act(async () => setValue(textPane()!, "--color-bg: #fff;"));
    await click(button("Cancel"));
    // The close was intercepted, not performed.
    expect(opened).toHaveLength(0);
    expect(document.querySelector(".app-import-collision")?.textContent).toMatch(/discard this import/i);

    await click(button("Keep editing"));
    expect(document.querySelector(".app-import-collision")).toBeNull();
    expect(opened).toHaveLength(0);

    await click(button("Cancel"));
    await click(button("Discard"));
    expect(opened).toEqual([false]);
  });

  it("reviews the real diff inline before saving", async () => {
    await renderSheet();
    await act(async () => setValue(textPane()!, "--color-bg: #fff;\n--color-accent: #111;"));
    const review = document.querySelector(".app-import-review")!;
    expect(review.textContent).toContain("Added 2");
    expect(review.textContent).toContain("Overridden 0");
    expect(review.textContent).toContain("Unchanged 0");
    expect(review.textContent).toContain("Removed 0");
  });
});
