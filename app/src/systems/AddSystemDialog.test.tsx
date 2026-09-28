// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { AddSystemDialog } from "./AddSystemDialog.tsx";

// Issue #32: the "Open in" preference must survive the migration. The legacy
// viewer wrote `dsv.afterSave` with values `system|preview|compare`; the React
// app reads `dsv.app.afterSave` with `tokens|preview|compare`. Since #124 the
// preference is a small menu attached to Save instead of a footer row, so the
// contract these tests pin is the one that matters: the stored choice is the
// one shown, it is honoured on save, and picking another writes the canonical
// key+value.

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let savedTabs: string[] = [];

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
        onSaved={(tab) => savedTabs.push(tab)}
      />,
    );
  });
}

/** The visible "Open in" choice — the menu trigger's own label. */
function openInLabel(): string | null {
  return document.querySelector(".app-import-openin")?.textContent?.replace(/[^A-Za-z]/g, "") ?? null;
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  savedTabs = [];
  localStorage.clear();
});

describe("AddSystemDialog 'Open in' preference", () => {
  it("honors a legacy dsv.afterSave=system preference as the Tokens choice", async () => {
    localStorage.setItem("dsv.afterSave", "system");
    await renderDialog();
    expect(openInLabel()).toBe("Tokens");
  });

  it("honors a legacy dsv.afterSave=compare preference", async () => {
    localStorage.setItem("dsv.afterSave", "compare");
    await renderDialog();
    expect(openInLabel()).toBe("Compare");
  });

  it("falls back to the default (Preview) for an unknown stored value", async () => {
    localStorage.setItem("dsv.app.afterSave", "bogus");
    await renderDialog();
    expect(openInLabel()).toBe("Preview");
  });

  it("defaults to Preview when nothing is stored", async () => {
    await renderDialog();
    expect(openInLabel()).toBe("Preview");
  });

  it("honours the stored choice on save", async () => {
    localStorage.setItem("dsv.app.afterSave", "compare");
    await renderDialog();
    await act(async () =>
      setValue(document.querySelector<HTMLTextAreaElement>('textarea[aria-label="CSS text"]')!, "--color-bg: #fff;"),
    );
    const save = [...document.querySelectorAll<HTMLButtonElement>(".app-import-dialog button")].find(
      (b) => b.textContent?.trim() === "Save system",
    )!;
    await act(async () => save.click());
    expect(savedTabs).toEqual(["compare"]);
  });

  it("writes the canonical key and value when another tab is picked", async () => {
    await renderDialog();
    const trigger = document.querySelector<HTMLButtonElement>(".app-import-openin")!;
    await act(async () => {
      trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
      trigger.click();
    });
    const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((i) =>
      i.textContent?.includes("Compare"),
    );
    expect(item).toBeDefined();
    await act(async () => item!.click());
    expect(localStorage.getItem("dsv.app.afterSave")).toBe("compare");
    expect(localStorage.getItem("dsv.afterSave")).toBeNull();
    expect(openInLabel()).toBe("Compare");
  });
});
