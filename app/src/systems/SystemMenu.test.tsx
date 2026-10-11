// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { SystemMenu } from "./SystemMenu.tsx";
import type { DesignSystem } from "./store.ts";

// Issue #313: Export and Delete left the Tokens toolbar for this system
// menu beside the topbar switcher, joined by Rename and Duplicate. The
// trigger reads "System actions"; the red danger style applies only inside
// the delete confirm dialog.

const system: DesignSystem = {
  slug: "aurora",
  name: "Aurora",
  css: ":root { --color-bg: #fff; }",
  groups: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function handlers() {
  return {
    onRename: vi.fn(),
    onDuplicate: vi.fn(),
    onExportCss: vi.fn(),
    onExportJson: vi.fn(),
    onDelete: vi.fn(),
  };
}

type Handlers = ReturnType<typeof handlers>;

async function renderMenu(h: Handlers): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<SystemMenu system={system} {...h} />);
  });
}

async function openMenu(): Promise<void> {
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label="System actions"]')!;
  expect(trigger, "System actions trigger renders").not.toBeNull();
  // Radix opens menus on pointerdown — a bare .click() never opens them.
  await act(async () => {
    trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    trigger.click();
  });
}

function menuItem(label: string): HTMLElement {
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) =>
    el.textContent?.includes(label),
  );
  expect(item, `menu item ${label} renders`).toBeDefined();
  return item!;
}

function setValue(el: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("SystemMenu items", () => {
  it("lists Rename, Duplicate, Export CSS, Export JSON and Delete", async () => {
    const h = handlers();
    await renderMenu(h);
    await openMenu();
    for (const label of ["Rename…", "Duplicate", "Export CSS", "Export JSON", "Delete…"])
      menuItem(label);
  });

  it("carries no red danger style on the menu's Delete row", async () => {
    const h = handlers();
    await renderMenu(h);
    await openMenu();
    const item = menuItem("Delete…");
    expect(item.className, "menu row is not danger-styled").not.toMatch(/danger/);
  });

  it("fires export and duplicate callbacks from the menu", async () => {
    const h = handlers();
    await renderMenu(h);
    await openMenu();
    await act(async () => {
      menuItem("Duplicate").click();
    });
    expect(h.onDuplicate).toHaveBeenCalledWith("aurora");
    await openMenu();
    await act(async () => {
      menuItem("Export CSS").click();
    });
    expect(h.onExportCss).toHaveBeenCalledTimes(1);
    await openMenu();
    await act(async () => {
      menuItem("Export JSON").click();
    });
    expect(h.onExportJson).toHaveBeenCalledTimes(1);
  });
});

describe("SystemMenu rename dialog", () => {
  it("prefills the active name and saves the edited name", async () => {
    const h = handlers();
    await renderMenu(h);
    await openMenu();
    await act(async () => {
      menuItem("Rename…").click();
    });
    const input = document.querySelector<HTMLInputElement>(".sys-dialog input")!;
    expect(input, "rename input renders").not.toBeNull();
    expect(input.value, "prefilled with the active name").toBe("Aurora");
    await act(async () => {
      setValue(input, "Perp X");
    });
    const save = [...document.querySelectorAll<HTMLButtonElement>(".sys-dialog button")].find(
      (b) => b.textContent?.trim() === "Save",
    )!;
    await act(async () => {
      save.click();
    });
    expect(h.onRename).toHaveBeenCalledWith("aurora", "Perp X");
  });

  it("cannot save an empty name", async () => {
    const h = handlers();
    await renderMenu(h);
    await openMenu();
    await act(async () => {
      menuItem("Rename…").click();
    });
    const input = document.querySelector<HTMLInputElement>(".sys-dialog input")!;
    await act(async () => {
      setValue(input, "   ");
    });
    const save = [...document.querySelectorAll<HTMLButtonElement>(".sys-dialog button")].find(
      (b) => b.textContent?.trim() === "Save",
    )!;
    expect(save.disabled, "Save disabled for a blank name").toBe(true);
    await act(async () => {
      save.click();
    });
    expect(h.onRename, "blank rename never fires").not.toHaveBeenCalled();
  });
});

describe("SystemMenu delete confirm", () => {
  it("confirms with the existing wording and fires delete on confirm", async () => {
    const h = handlers();
    await renderMenu(h);
    await openMenu();
    await act(async () => {
      menuItem("Delete…").click();
    });
    const content = document.querySelector('[role="alertdialog"]');
    expect(content, "alertdialog renders").not.toBeNull();
    expect(content!.textContent).toContain("Delete “Aurora”?");
    expect(content!.textContent).toContain("This cannot be undone.");
    expect(content!.getAttribute("aria-modal")).toBe("true");
    const confirm = [...content!.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent?.trim() === "Delete",
    )!;
    expect(confirm.className, "red style only inside the confirm").toMatch(/danger/);
    await act(async () => {
      confirm.click();
    });
    expect(h.onDelete).toHaveBeenCalledWith("aurora");
  });
});
