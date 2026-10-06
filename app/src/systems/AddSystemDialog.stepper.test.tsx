// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { AddSystemDialog } from "./AddSystemDialog.tsx";

// Issue #213, slice 1: the Add System dialog is a 3-step stepper inside the
// existing `.tok-dialog` shell — Source → Review → Save. Back never loses
// the parsed text, Cancel at any step writes nothing, and nothing is written
// before Save. Review shows only what exists today (the parsed token count).

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let added: Array<{ name: string; css: string }> = [];
let closed = 0;

async function renderDialog(): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <AddSystemDialog
        open
        onOpenChange={() => (closed += 1)}
        onAdd={(name, css) => added.push({ name, css })}
        onToast={() => {}}
        onSaved={() => {}}
      />,
    );
  });
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const textPane = () => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="CSS text"]');
const nameField = () => document.querySelector<HTMLInputElement>('input[aria-label="System name"]');
const steps = () => document.querySelector(".app-import-steps");
const currentStepLabel = () =>
  document.querySelector('.app-import-step[data-active="true"] .app-import-steplabel')?.textContent ?? null;

function button(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>(".app-import-dialog button")].find(
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
  closed = 0;
});

describe("AddSystemDialog stepper shell (#213)", () => {
  it("opens on step 1 with no Save entry point", async () => {
    await renderDialog();
    expect(steps()).not.toBeNull();
    expect(currentStepLabel()).toBe("Source");
    expect(textPane()).not.toBeNull();
    expect(button("Save system")).toBeUndefined();
    expect(button("Continue")).toBeDefined();
  });

  it("only writes from step 3", async () => {
    await renderDialog();
    await act(async () => setValue(textPane()!, "--color-bg: #fff;"));
    // Step 1 offers Continue, not Save — stepping forward writes nothing.
    await click(button("Continue"));
    expect(added).toHaveLength(0);
    expect(currentStepLabel()).toBe("Review");
    expect(button("Save system")).toBeUndefined();
    // Step 3 holds the only write entry point.
    await click(button("Continue"));
    expect(currentStepLabel()).toBe("Save");
    expect(nameField()).not.toBeNull();
    await act(async () => setValue(nameField()!, "Probe"));
    await click(button("Save system"));
    expect(added).toEqual([{ name: "Probe", css: "--color-bg: #fff;" }]);
  });

  it("keeps the source text on Back from Review", async () => {
    await renderDialog();
    await act(async () => setValue(textPane()!, "--color-bg: #fff;"));
    await click(button("Continue"));
    expect(document.querySelector('[aria-label="Review"]')?.textContent).toContain("1 token");
    await click(button("Back"));
    expect(currentStepLabel()).toBe("Source");
    expect(textPane()!.value).toBe("--color-bg: #fff;");
  });

  it("writes nothing on Cancel from any step", async () => {
    async function cancelOnStep(target: 1 | 2 | 3): Promise<void> {
      await renderDialog();
      await act(async () => setValue(textPane()!, "--color-bg: #fff;"));
      if (target >= 2) await click(button("Continue"));
      if (target >= 3) await click(button("Continue"));
      expect(currentStepLabel()).toBe(target === 1 ? "Source" : target === 2 ? "Review" : "Save");
      await click(button("Cancel"));
      expect(added).toHaveLength(0);
      act(() => root?.unmount());
      root = null;
      host?.remove();
      host = null;
      added = [];
      closed = 0;
    }

    // Cancel on step 1 (Source), step 2 (Review) and step 3 (Save).
    await cancelOnStep(1);
    await cancelOnStep(2);
    await cancelOnStep(3);
  });
});
