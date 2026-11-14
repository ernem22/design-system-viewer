// @vitest-environment happy-dom
// Unified token editing: the right-rail inspector is the only editor. It opens
// in a read state (name/value + Copy + Edit); Edit reveals the value form with
// explicit Save/Cancel. A missing schema token shows "Not set" with an
// Add-token form. Every save goes through one onPatch + one toast path.
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
    selectedMissing: false,
    warnings: [],
    copyToken: () => {},
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

function button(el: HTMLElement, label: string): HTMLButtonElement | undefined {
  return [...el.querySelectorAll("button")].find((b) => b.textContent?.trim() === label) as
    | HTMLButtonElement
    | undefined;
}

async function click(el: Element | undefined | null): Promise<void> {
  await act(async () => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function setInput(input: HTMLInputElement, value: string): void {
  act(() => {
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("inspector read state (unified edit model)", () => {
  it("shows name and value with Copy and Edit, but no form until Edit", async () => {
    const el = await renderProps(viewFor(), () => {});
    expect(el.querySelector(".tok-inspector-name")?.textContent).toBe(selected.name);
    expect(el.querySelector(".tok-inspector-value")?.textContent).toBe(selected.value);
    expect(button(el, "Edit"), "Edit action renders").not.toBeUndefined();
    expect(button(el, "Copy `--name: value;`"), "Copy renders").not.toBeUndefined();
    expect(el.querySelector(".tok-edit-form"), "no form in read state").toBeNull();
  });

  it("keeps the existing Copy button", async () => {
    const copyToken = vi.fn();
    const el = await renderProps(viewFor({ copyToken } as Partial<TokensViewModel>), () => {});
    await click(button(el, "Copy `--name: value;`"));
    expect(copyToken).toHaveBeenCalledWith(selected);
  });

  it("reveals the value input when Edit is clicked", async () => {
    const el = await renderProps(viewFor(), () => {});
    await click(button(el, "Edit"));
    const labelled = [...el.querySelectorAll("label")].find((l) =>
      l.textContent?.includes("Token value"),
    );
    expect(labelled, "Token value label renders").not.toBeUndefined();
    const field = labelled!.querySelector("input") as HTMLInputElement | null;
    expect(field, "Token value label names the input").not.toBeNull();
    expect(field!.value).toBe(selected.value);
  });

  it("moves focus into the input after Edit", async () => {
    const el = await renderProps(viewFor(), () => {});
    expect(document.activeElement).not.toBe(el.querySelector(".tok-edit-form input"));
    await click(button(el, "Edit"));
    expect(document.activeElement, "inspector input has focus").toBe(
      el.querySelector(".tok-edit-form input"),
    );
  });
});

describe("inspector save/cancel", () => {
  it("saving calls the patch callback with (name, value) and one toast", async () => {
    const onPatch = vi.fn();
    const pushToast = vi.fn();
    const el = await renderProps(viewFor({ pushToast } as Partial<TokensViewModel>), onPatch);
    await click(button(el, "Edit"));
    setInput(el.querySelector(".tok-edit-form input") as HTMLInputElement, "0.5rem");
    await click(button(el, "Save"));
    expect(onPatch, "patch called with (name, value)").toHaveBeenCalledWith("--space-1", "0.5rem");
    expect(pushToast, "same --x updated toast").toHaveBeenCalledWith("--space-1 updated", "ok");
    expect(el.querySelector(".tok-edit-form"), "returns to read state").toBeNull();
  });

  it("submitting the form (Enter) saves", async () => {
    const onPatch = vi.fn();
    const el = await renderProps(viewFor(), onPatch);
    await click(button(el, "Edit"));
    const field = el.querySelector(".tok-edit-form input") as HTMLInputElement;
    setInput(field, "1rem");
    await act(async () => {
      el.querySelector(".tok-edit-form")!.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(onPatch).toHaveBeenCalledWith("--space-1", "1rem");
  });

  it("Escape cancels without saving and returns to the read state", async () => {
    const onPatch = vi.fn();
    const el = await renderProps(viewFor(), onPatch);
    await click(button(el, "Edit"));
    const field = el.querySelector(".tok-edit-form input") as HTMLInputElement;
    setInput(field, "9rem");
    await act(async () => {
      field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onPatch, "no patch on Esc").not.toHaveBeenCalled();
    expect(el.querySelector(".tok-edit-form"), "form closes").toBeNull();
  });

  it("Cancel returns to the read state without saving", async () => {
    const onPatch = vi.fn();
    const el = await renderProps(viewFor(), onPatch);
    await click(button(el, "Edit"));
    await click(button(el, "Cancel"));
    expect(onPatch).not.toHaveBeenCalled();
    expect(el.querySelector(".tok-edit-form"), "form closes").toBeNull();
    expect(el.querySelector(".tok-inspector-value")?.textContent).toBe(selected.value);
  });

  it("saving an unchanged value does not patch", async () => {
    const onPatch = vi.fn();
    const el = await renderProps(viewFor(), onPatch);
    await click(button(el, "Edit"));
    const save = button(el, "Save")!;
    expect(save.disabled, "unchanged value disables Save").toBe(true);
    await click(save);
    expect(onPatch, "unchanged value is a no-op").not.toHaveBeenCalled();
  });
});

describe("missing schema token (Not set / Add)", () => {
  const missing: Token = { name: "--color-accent-hover", value: "" };

  it("shows Not set with an Add form and no Copy/Edit read actions", async () => {
    const el = await renderProps(
      viewFor({ selected: missing, selectedMissing: true } as Partial<TokensViewModel>),
      () => {},
    );
    expect(el.querySelector(".tok-inspector-name")?.textContent).toBe(missing.name);
    expect(el.querySelector(".tok-inspector")?.textContent).toContain("Not set");
    expect(button(el, "Edit"), "no Edit for a missing token").toBeUndefined();
    expect(el.querySelector(".tok-edit-form"), "Add form renders").not.toBeNull();
    expect(button(el, "Add token"), "explicit create action").not.toBeUndefined();
  });

  it("saving the Add form creates the token through the same patch path", async () => {
    const onPatch = vi.fn();
    const pushToast = vi.fn();
    const el = await renderProps(
      viewFor({ selected: missing, selectedMissing: true, pushToast } as Partial<TokensViewModel>),
      onPatch,
    );
    const field = el.querySelector(".tok-edit-form input") as HTMLInputElement;
    expect(field.value, "value starts empty").toBe("");
    setInput(field, "#4338ca");
    await click(button(el, "Add token"));
    expect(onPatch).toHaveBeenCalledWith(missing.name, "#4338ca");
    expect(pushToast).toHaveBeenCalledWith(`${missing.name} updated`, "ok");
  });
});
