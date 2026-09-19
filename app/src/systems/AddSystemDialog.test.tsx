// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { AddSystemDialog } from "./AddSystemDialog.tsx";

// Issue #32: the "Open in" preference must survive the migration. The legacy
// viewer wrote `dsv.afterSave` with values `system|preview|compare`; the React
// app reads `dsv.app.afterSave` with `tokens|preview|compare`. A user with the
// old spelling stored must still see their choice selected when the dialog
// first opens -- and an unknown value must fall back to the default rather
// than leaving nothing selected.

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

/** The visible "Open in" selection (Radix ToggleGroup marks it data-state="on"). */
function selectedTab(): string | null {
  return document.querySelector(".tok-seg [data-state='on']")?.textContent ?? null;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  localStorage.clear();
});

describe("AddSystemDialog 'Open in' preference", () => {
  it("honors a legacy dsv.afterSave=system preference as the Tokens choice", async () => {
    localStorage.setItem("dsv.afterSave", "system");
    await renderDialog();
    expect(selectedTab()).toBe("Tokens");
  });

  it("honors a legacy dsv.afterSave=compare preference", async () => {
    localStorage.setItem("dsv.afterSave", "compare");
    await renderDialog();
    expect(selectedTab()).toBe("Compare");
  });

  it("falls back to the default (Preview) for an unknown stored value", async () => {
    localStorage.setItem("dsv.app.afterSave", "bogus");
    await renderDialog();
    expect(selectedTab()).toBe("Preview");
  });

  it("defaults to Preview when nothing is stored", async () => {
    await renderDialog();
    expect(selectedTab()).toBe("Preview");
  });

  it("writes the canonical key and value when the user picks a tab", async () => {
    await renderDialog();
    const compare = [...document.querySelectorAll<HTMLButtonElement>(".tok-seg-item")].find(
      (b) => b.textContent === "Compare",
    );
    await act(async () => {
      compare!.click();
    });
    expect(localStorage.getItem("dsv.app.afterSave")).toBe("compare");
    expect(localStorage.getItem("dsv.afterSave")).toBeNull();
    expect(selectedTab()).toBe("Compare");
  });
});
