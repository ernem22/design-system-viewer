// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { ImportSheet } from "./ImportSheet.tsx";
import type { DesignSystem, SourceProvenance } from "./store.ts";

function sys(slug: string, name: string, css: string): DesignSystem {
  return {
    slug,
    name,
    css,
    groups: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const SYSTEMS: DesignSystem[] = [sys("aurora", "Aurora", "--color-bg: #ffffff;\n--color-text: #000000;")];

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let added: Array<{ name: string; css: string; source?: SourceProvenance }> = [];
let merged: Array<{ slug: string; css: string; source?: SourceProvenance }> = [];
let replaced: Array<{ slug: string; name: string; css: string; source?: SourceProvenance }> = [];
let closed = 0;

async function renderSheet(): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <ImportSheet
        open
        systems={SYSTEMS}
        onOpenChange={() => (closed += 1)}
        onAdd={(name, css, source) => added.push({ name, css, source })}
        onMerge={(slug, css, source) => merged.push({ slug, css, source })}
        onReplace={(slug, name, css, source) => replaced.push({ slug, name, css, source })}
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

const textPane = () => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="CSS text"]');
const nameField = () => document.querySelector<HTMLInputElement>('input[aria-label="System name"]');
const collisionPanel = () => document.querySelector<HTMLElement>(".app-import-collision");
const review = () => document.querySelector<HTMLElement>(".app-import-review");

function buttonIn(scope: ParentNode, label: string): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
    b.textContent?.trim().startsWith(label),
  );
}

const button = (label: string) => buttonIn(document, label);
const mode = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>(".app-import-modebtn")].find(
    (b) => b.textContent?.trim() === label,
  );

async function click(el: HTMLElement | undefined): Promise<void> {
  await act(async () => el!.click());
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  added = [];
  merged = [];
  replaced = [];
  closed = 0;
});

describe("ImportSheet write modes", () => {
  it("merges into a chosen system and reviews added / overridden / unchanged", async () => {
    await renderSheet();
    await act(async () => setValue(textPane()!, "--color-bg: #111111;\n--color-accent: #ff0000;"));
    await click(mode("Merge into"));
    const select = document.querySelector<HTMLSelectElement>('select[aria-label="System to merge into"]')!;
    await act(async () => setValue(select, "aurora"));

    expect(review()?.textContent).toContain("Added 1");
    expect(review()?.textContent).toContain("Overridden 1");
    expect(review()?.textContent).toContain("Unchanged 0");
    expect(review()?.textContent).toContain("Removed 0");

    await click(button("Merge system"));
    expect(merged).toHaveLength(1);
    expect(merged[0].slug).toBe("aurora");
    expect(merged[0].css).toContain("--color-accent: #ff0000;");
    expect(closed).toBe(1);
  });

  it("hides the name field and shows merge errors even with a target chosen", async () => {
    await renderSheet();
    await act(async () => setValue(textPane()!, "--not-a-schema-token: #111111;"));
    await click(mode("Merge into"));
    const select = document.querySelector<HTMLSelectElement>('select[aria-label="System to merge into"]')!;
    await act(async () => setValue(select, "aurora"));

    expect(nameField()).toBeNull();
    await click(button("Merge system"));
    expect(merged).toHaveLength(0);
    expect(document.querySelector(".app-import-error")?.textContent).toMatch(/nothing to save/i);
  });

  it("clones a chosen system by seeding the visible buffer", async () => {
    await renderSheet();
    await click(mode("Clone from"));
    const select = document.querySelector<HTMLSelectElement>('select[aria-label="System to clone from"]')!;
    await act(async () => setValue(select, "aurora"));
    expect(textPane()!.value).toContain("--color-bg: #ffffff;");

    const filter = document.querySelector<HTMLInputElement>('input[aria-label="Filter tokens by name"]')!;
    await act(async () => setValue(filter, "--color-accent"));
    const row = document.querySelector<HTMLInputElement>('input[aria-label="--color-accent"]')!;
    await act(async () => setValue(row, "#ff0000"));
    await act(async () => setValue(nameField()!, "Aurora copy"));

    await click(button("Clone system"));
    expect(added).toHaveLength(1);
    expect(added[0].name).toBe("Aurora copy");
    expect(added[0].css).toContain("--color-bg: #ffffff;");
    expect(added[0].css).toContain("--color-accent: #ff0000;");
    expect(added[0].css.match(/--color-bg:/g)).toHaveLength(1);
    expect(added[0].source).toMatchObject({ kind: "clone" });
  });

  it("records the import source on a plain new-system write", async () => {
    await renderSheet();
    await act(async () => setValue(textPane()!, "--color-bg: #123456;"));
    await act(async () => setValue(nameField()!, "Probe"));
    await click(button("Save system"));

    expect(added).toHaveLength(1);
    expect(added[0].source).toMatchObject({ kind: "paste" });
    expect(typeof added[0].source?.importedAt).toBe("string");
  });
});

describe("ImportSheet slug-collision resolution", () => {
  async function collide(): Promise<void> {
    await renderSheet();
    await act(async () => setValue(textPane()!, "--color-bg: #111111;"));
    await act(async () => setValue(nameField()!, "Aurora"));
    await click(button("Save system"));
  }

  it("offers rename / merge / replace / cancel instead of throwing a slug error", async () => {
    await collide();
    const panel = collisionPanel();
    expect(panel).not.toBeNull();
    expect(panel!.textContent).toContain("aurora");
    expect(panel!.textContent).toMatch(/already exists/i);
    expect(added).toHaveLength(0);
    expect(buttonIn(panel!, "Rename")).toBeDefined();
    expect(buttonIn(panel!, "Merge")).toBeDefined();
    expect(buttonIn(panel!, "Replace")).toBeDefined();
    expect(buttonIn(panel!, "Cancel")).toBeDefined();
    expect(closed).toBe(0);
  });

  it("renames (the store suffixes -2) when Rename is chosen", async () => {
    await collide();
    await click(buttonIn(collisionPanel()!, "Rename"));
    expect(added).toHaveLength(1);
    expect(added[0].name).toBe("Aurora");
    expect(closed).toBe(1);
  });

  it("merges into the colliding system when Merge is chosen", async () => {
    await collide();
    await click(buttonIn(collisionPanel()!, "Merge"));
    expect(merged).toHaveLength(1);
    expect(merged[0].slug).toBe("aurora");
    expect(closed).toBe(1);
  });

  it("requires a second confirmation before replacing", async () => {
    await collide();
    await click(buttonIn(collisionPanel()!, "Replace"));
    expect(collisionPanel()!.textContent).toMatch(/cannot be undone/i);
    expect(replaced).toHaveLength(0);
    expect(closed).toBe(0);

    await click(buttonIn(collisionPanel()!, "Replace permanently"));
    expect(replaced).toHaveLength(1);
    expect(replaced[0].slug).toBe("aurora");
    expect(closed).toBe(1);
  });

  it("keeps the existing system when the replace confirmation is dismissed", async () => {
    await collide();
    await click(buttonIn(collisionPanel()!, "Replace"));
    await click(buttonIn(collisionPanel()!, "Keep existing"));
    expect(replaced).toHaveLength(0);
    expect(collisionPanel()!.textContent).toMatch(/already exists/i);
    expect(closed).toBe(0);
  });

  it("dismisses the collision prompt on Cancel without writing", async () => {
    await collide();
    await click(buttonIn(collisionPanel()!, "Cancel"));
    expect(collisionPanel()).toBeNull();
    expect(added).toHaveLength(0);
    expect(merged).toHaveLength(0);
    expect(replaced).toHaveLength(0);
    expect(closed).toBe(0);
  });
});
