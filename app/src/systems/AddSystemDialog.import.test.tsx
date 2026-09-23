// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { AddSystemDialog } from "./AddSystemDialog.tsx";

// Issue #124: the Add System dialog is an import flow — Source → Review →
// Save — and only the last step writes. These tests pin the three claims the
// card is built on: no write before step 3, a JSON export reads back in, and
// the grouped surface (54 groups) is what step 2 shows.

const JSON_EXPORT = JSON.stringify({
  name: "Aurora",
  slug: "aurora",
  css: "--color-bg: #0a0a0f;\n--color-text: #f0f0f3;",
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let added: { name: string; css: string }[] = [];
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

const step = () => document.querySelector(".tok-dialog")?.getAttribute("data-step");
const textarea = () => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="CSS or a JSON export"]');
const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>(".tok-dialog button")].find((b) => b.textContent === label);

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
  vi.restoreAllMocks();
});

describe("AddSystemDialog import flow", () => {
  it("opens on the Source step and offers no write there", async () => {
    await renderDialog();
    expect(step()).toBe("1");
    expect(button("Save system")).toBeUndefined();
    expect(button("Continue")).toBeDefined();
  });

  it("does not leave step 1 without a token, and writes nothing", async () => {
    await renderDialog();
    await click(button("Continue"));
    expect(step()).toBe("1");
    expect(added).toHaveLength(0);
    expect(document.querySelector(".tok-dialog-error")?.textContent).toMatch(/empty/);
  });

  it("reads a pasted JSON export into its css and name", async () => {
    await renderDialog();
    await act(async () => setValue(textarea()!, JSON_EXPORT));
    expect(textarea()!.value).toBe("--color-bg: #0a0a0f;\n--color-text: #f0f0f3;");
    expect(document.querySelector(".app-import-hint")?.textContent).toContain("Aurora");
    expect(document.querySelector(".app-import-status")?.textContent).toContain("JSON export");
  });

  it("offers four sources and only shows the panel of the chosen one", async () => {
    await renderDialog();
    const labels = [...document.querySelectorAll(".app-import-source-label")].map((e) => e.textContent);
    expect(labels).toEqual(["Paste CSS", "Upload .css", "Fetch URL", "JSON export"]);
    expect(document.querySelector(".app-import-source.is-active .app-import-source-label")?.textContent).toBe(
      "Paste CSS",
    );
    const upload = [...document.querySelectorAll<HTMLButtonElement>(".app-import-source")].find((b) =>
      b.textContent?.startsWith("Upload"),
    )!;
    await click(upload);
    expect(document.querySelector(".app-import-source.is-active .app-import-source-label")?.textContent).toBe(
      "Upload .css",
    );
    expect(button("Choose a .css file")).toBeDefined();
    expect(document.querySelector(".tok-source-url")).toBeNull();
  });

  it("imports JSON through the JSON panel and records where it came from", async () => {
    await renderDialog();
    const jsonTab = [...document.querySelectorAll<HTMLButtonElement>(".app-import-source")].find((b) =>
      b.textContent?.startsWith("JSON"),
    )!;
    await click(jsonTab);
    await act(async () => setValue(document.querySelector<HTMLTextAreaElement>('textarea[aria-label="System JSON"]')!, JSON_EXPORT));
    await click(button("Import this JSON"));
    expect(document.querySelector(".app-import-status")?.textContent).toContain("Aurora");
    expect(textarea()!.value).toBe("--color-bg: #0a0a0f;\n--color-text: #f0f0f3;");
  });

  it("keeps the source status empty until something is loaded", async () => {
    await renderDialog();
    expect(document.querySelector(".app-import-status")?.textContent).toContain("Nothing loaded yet");
  });

  it("shows the grouped schema on the Review step", async () => {
    await renderDialog();
    await act(async () => setValue(textarea()!, "--color-bg: #fff;"));
    await click(button("Continue"));
    expect(step()).toBe("2");
    expect(document.querySelectorAll(".app-fill-group")).toHaveLength(54);
  });

  it("keeps the text across a back step and shows it in the paste view", async () => {
    await renderDialog();
    await act(async () => setValue(textarea()!, "--color-bg: #fff;"));
    await click(button("Continue"));
    await click(button("Back"));
    expect(step()).toBe("1");
    expect(textarea()!.value).toBe("--color-bg: #fff;");
    await click(button("Continue"));
    const paste = [...document.querySelectorAll<HTMLButtonElement>(".tok-seg-item")].find(
      (b) => b.textContent === "Paste",
    )!;
    await click(paste);
    expect(document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Imported CSS"]')!.value).toBe(
      "--color-bg: #fff;",
    );
  });

  it("writes only from the Save step", async () => {
    await renderDialog();
    await act(async () => setValue(textarea()!, "--color-bg: #fff;"));
    await click(button("Continue"));
    await click(button("Continue"));
    expect(step()).toBe("3");
    await click(button("Save system"));
    expect(added).toEqual([{ name: "Untitled", css: "--color-bg: #fff;" }]);
    expect(closed).toBe(1);
  });

  it("copies the full template, the action the port had dropped", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await renderDialog();
    await click(button("Copy template"));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain("--color-bg: ;");
    expect(writeText.mock.calls[0][0]).toContain("--font-size-base: ;");
  });
});
