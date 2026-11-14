// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { ImportSheet } from "./ImportSheet.tsx";
import type { DesignSystem } from "./store.ts";

// The second entry point: the same sheet scoped to the active system. No
// identity, no collision flow — the primary action merges into that system.

const SYSTEM: DesignSystem = {
  slug: "aurora",
  name: "Aurora",
  css: ":root { --color-bg: #ffffff; }",
  groups: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let merged: Array<{ slug: string; css: string }> = [];
let added = 0;
let opened: boolean[] = [];

async function renderSheet(): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <ImportSheet
        open
        scopeSystem={SYSTEM}
        systems={[SYSTEM]}
        onOpenChange={(next) => opened.push(next)}
        onAdd={() => (added += 1)}
        onMerge={(slug, css) => merged.push({ slug, css })}
        onToast={() => {}}
        onSaved={() => {}}
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

function button(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find(
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
  merged = [];
  added = 0;
  opened = [];
});

describe("ImportSheet add-to-active", () => {
  it("is scoped: names the system, hides identity, offers one Add tokens action", async () => {
    await renderSheet();
    expect(document.querySelector(".app-import-title")?.textContent).toBe("Add tokens — Aurora");
    expect(document.querySelector('input[aria-label="System name"]')).toBeNull();
    expect(document.querySelector(".app-import-identity")).toBeNull();
    expect(button("Add tokens")).toBeDefined();
    expect(button("Save system")).toBeUndefined();
    expect(document.querySelector(".app-import-targetnote")?.textContent).toContain("Aurora");
  });

  it("merges the pasted block into the active system", async () => {
    await renderSheet();
    await act(async () => setValue(textPane()!, "--color-accent: #111111;"));
    await click(button("Add tokens"));
    expect(merged).toHaveLength(1);
    expect(merged[0].slug).toBe("aurora");
    expect(merged[0].css).toBe("--color-accent: #111111;");
    expect(added).toBe(0);
    expect(opened).toEqual([false]);
  });

  it("adds any token, not only schema names, but refuses an empty buffer", async () => {
    await renderSheet();
    await click(button("Add tokens"));
    expect(merged).toHaveLength(0);
    expect(document.querySelector(".app-import-error")?.textContent).toMatch(/at least one/i);

    await act(async () => setValue(textPane()!, "--my-own-token: 1;"));
    await click(button("Add tokens"));
    expect(merged).toHaveLength(1);
    expect(merged[0].css).toContain("--my-own-token: 1;");
  });

  it("asks before discarding a non-empty buffer", async () => {
    await renderSheet();
    await act(async () => setValue(textPane()!, "--color-accent: #111111;"));
    await click(button("Cancel"));
    expect(opened).toHaveLength(0);
    expect(document.querySelector(".app-import-collision")?.textContent).toMatch(/discard this import/i);
  });
});
