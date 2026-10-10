// @vitest-environment happy-dom
// Issue #307 RED: selecting a token renders an inspector edit form — a text
// input labelled "Token value" prefilled with the value, plus Save/Cancel —
// and saving calls the patch callback with (name, value). Double-clicking a
// gallery row sets `editingName`, which moves focus into this input.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { TokensProps } from "./TokensProps.tsx";
import type { TokensViewModel } from "./useTokensView.ts";
import type { Token } from "../systems/store.ts";

const selected: Token = { name: "--space-1", value: "0.25rem" };

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function viewFor(overrides: Partial<TokensViewModel> = {}): TokensViewModel {
  return {
    cov: { present: 1, expected: 2, missing: 1, extraCount: 0 },
    selected,
    warnings: [],
    copyToken: () => {},
    editingName: null,
    onEdit: () => {},
    pushToast: () => {},
    ...overrides,
  } as unknown as TokensViewModel;
}

async function renderProps(
  view: TokensViewModel,
  onPatch: (name: string, value: string) => void,
): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  if (!root) {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  }
  await act(async () => {
    root!.render(<TokensProps view={view} onPatch={onPatch} />);
  });
  return host!;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  document.body.innerHTML = "";
});

function setInput(input: HTMLInputElement, value: string): void {
  act(() => {
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("inspector edit form (issue #307 RED)", () => {
  it("renders an input labelled Token value prefilled with the token value", async () => {
    const el = await renderProps(viewFor(), () => {});
    const labelled = [...el.querySelectorAll("label")].find((l) =>
      l.textContent?.includes("Token value"),
    );
    expect(labelled, "Token value label renders").not.toBeUndefined();
    const field = labelled!.querySelector("input") as HTMLInputElement | null;
    expect(field, "Token value label names the input").not.toBeNull();
    expect(field!.value).toBe(selected.value);
  });

  it("saving calls the patch callback with (name, value)", async () => {
    const onPatch = vi.fn();
    const pushToast = vi.fn();
    const el = await renderProps(viewFor({ pushToast } as Partial<TokensViewModel>), onPatch);
    const field = el.querySelector(".tok-edit-form input") as HTMLInputElement;
    setInput(field, "0.5rem");
    const save = [...el.querySelectorAll(".tok-edit-actions button")].find(
      (b) => b.textContent === "Save",
    ) as HTMLButtonElement;
    act(() => {
      save.click();
    });
    expect(onPatch, "patch called with (name, value)").toHaveBeenCalledWith("--space-1", "0.5rem");
    expect(pushToast, "same --x updated toast").toHaveBeenCalledWith("--space-1 updated", "ok");
  });

  it("submitting the form (Enter) saves", async () => {
    const onPatch = vi.fn();
    const el = await renderProps(viewFor(), onPatch);
    const field = el.querySelector(".tok-edit-form input") as HTMLInputElement;
    setInput(field, "1rem");
    act(() => {
      el
        .querySelector(".tok-edit-form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(onPatch).toHaveBeenCalledWith("--space-1", "1rem");
  });

  it("Escape cancels without saving", async () => {
    const onPatch = vi.fn();
    const onEdit = vi.fn();
    const el = await renderProps(viewFor({ onEdit } as Partial<TokensViewModel>), onPatch);
    const field = el.querySelector(".tok-edit-form input") as HTMLInputElement;
    setInput(field, "9rem");
    act(() => {
      field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onPatch, "no patch on Esc").not.toHaveBeenCalled();
    expect(onEdit, "Esc clears the edit target").toHaveBeenCalledWith(null);
  });

  it("Cancel clears the edit target without saving", async () => {
    const onPatch = vi.fn();
    const onEdit = vi.fn();
    const el = await renderProps(viewFor({ onEdit } as Partial<TokensViewModel>), onPatch);
    const cancel = [...el.querySelectorAll(".tok-edit-actions button")].find(
      (b) => b.textContent === "Cancel",
    ) as HTMLButtonElement;
    act(() => {
      cancel.click();
    });
    expect(onPatch).not.toHaveBeenCalled();
    expect(onEdit).toHaveBeenCalledWith(null);
  });

  it("saving an unchanged value does not patch", async () => {
    const onPatch = vi.fn();
    const el = await renderProps(viewFor(), onPatch);
    const save = [...el.querySelectorAll(".tok-edit-actions button")].find(
      (b) => b.textContent === "Save",
    ) as HTMLButtonElement;
    act(() => {
      save.click();
    });
    expect(onPatch, "unchanged value is a no-op").not.toHaveBeenCalled();
  });

  it("double-click focus: setting editingName moves focus into the input", async () => {
    const onPatch = vi.fn();
    const el = await renderProps(viewFor({ editingName: null }), onPatch);
    const field = el.querySelector(".tok-edit-form input") as HTMLInputElement;
    expect(document.activeElement).not.toBe(field);
    await renderProps(viewFor({ editingName: selected.name }), onPatch);
    expect(document.activeElement, "inspector input has focus").toBe(
      el.querySelector(".tok-edit-form input"),
    );
  });

  it("keeps the existing Copy button", async () => {
    const el = await renderProps(viewFor(), () => {});
    const copy = [...el.querySelectorAll(".tok-inspector button")].find((b) =>
      b.textContent?.includes("Copy"),
    );
    expect(copy, "Copy button stays").not.toBeUndefined();
  });
});
