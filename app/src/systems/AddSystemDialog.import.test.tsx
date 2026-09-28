// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { AddSystemDialog } from "./AddSystemDialog.tsx";
import { fetchCss } from "../lib/cssImport.ts";

vi.mock("../lib/cssImport.ts", () => ({
  fetchCss: vi.fn(),
  readCssFile: vi.fn(),
}));

// Issue #124, second composition. The dialog exists to add a system, so the
// work owns the surface: the schema fill and the raw text are both live, and
// the ways in are compact triggers in the top bar — no steps, no wizard. These
// tests pin the properties that make that true: both panes on open, a source
// that opens only its own row, a JSON export read back in, the fill pane
// tracking the text, and a write that only happens on Save.

const JSON_EXPORT = JSON.stringify({
  name: "Aurora",
  slug: "aurora",
  css: "--color-bg: #0a0a0f;\n--color-text: #f0f0f3;",
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let added: { name: string; css: string }[] = [];
let savedTabs: string[] = [];
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
        onSaved={(tab) => savedTabs.push(tab)}
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
const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>(".app-import-dialog button")].find((b) =>
    b.textContent?.trim().startsWith(label),
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
  savedTabs = [];
  closed = 0;
  vi.restoreAllMocks();
});

describe("AddSystemDialog composition", () => {
  it("opens with the work on screen: both panes, no steps", async () => {
    await renderDialog();
    expect(document.querySelector('[aria-label="Schema fill"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="CSS text"]')).not.toBeNull();
    expect(document.querySelector(".app-import-steps")).toBeNull();
    expect(textPane()).not.toBeNull();
    expect(nameField()).not.toBeNull();
    // The fill pane is live, not behind a step: one section per schema group.
    expect(document.querySelectorAll(".app-fill-group")).toHaveLength(54);
  });

  it("writes nothing without a token, and says why", async () => {
    await renderDialog();
    await click(button("Save system"));
    expect(added).toHaveLength(0);
    expect(document.querySelector(".app-import-error")?.textContent).toMatch(/no .*token/i);
  });

  it("reads a pasted JSON export into the text and the name", async () => {
    await renderDialog();
    await act(async () => setValue(textPane()!, JSON_EXPORT));
    expect(textPane()!.value).toBe("--color-bg: #0a0a0f;\n--color-text: #f0f0f3;");
    expect(nameField()!.value).toBe("Aurora");
    expect(document.querySelector(".app-import-status")?.textContent).toContain("JSON export");
  });

  it("keeps the fill pane in step with the text", async () => {
    await renderDialog();
    await act(async () => setValue(textPane()!, "--color-bg: #fff;"));
    expect(document.querySelector(".app-fill-summary")?.textContent).toContain("1/432");
  });

  it("opens one source row at a time, and only when asked", async () => {
    await renderDialog();
    expect(document.querySelector(".app-import-inline")).toBeNull();
    await click(button("Fetch URL"));
    expect(document.querySelector('input[aria-label="Stylesheet URL"]')).not.toBeNull();
    expect(document.querySelector('textarea[aria-label="System JSON"]')).toBeNull();
    await click(button("JSON export"));
    expect(document.querySelector('textarea[aria-label="System JSON"]')).not.toBeNull();
    expect(document.querySelector('input[aria-label="Stylesheet URL"]')).toBeNull();
  });

  it("imports JSON through its row", async () => {
    await renderDialog();
    await click(button("JSON export"));
    await act(async () =>
      setValue(document.querySelector<HTMLTextAreaElement>('textarea[aria-label="System JSON"]')!, JSON_EXPORT),
    );
    await click(button("Import this JSON"));
    expect(textPane()!.value).toBe("--color-bg: #0a0a0f;\n--color-text: #f0f0f3;");
    expect(document.querySelector(".app-import-status")?.textContent).toContain("Aurora");
  });

  it("fills the text from the template trigger", async () => {
    await renderDialog();
    await click(button("Template"));
    expect(textPane()!.value).toContain("--color-bg: ;");
    expect(textPane()!.value).toContain("--font-size-base: ;");
  });

  it("copies the template, the action the port had dropped", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await renderDialog();
    await click(button("Copy template"));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain("--color-bg: ;");
  });

  it("writes on Save, with the name that is in the field", async () => {
    await renderDialog();
    await act(async () => setValue(textPane()!, "--color-bg: #fff;"));
    await act(async () => setValue(nameField()!, "Probe"));
    await click(button("Save system"));
    expect(added).toEqual([{ name: "Probe", css: "--color-bg: #fff;" }]);
    expect(closed).toBe(1);
    expect(savedTabs).toHaveLength(1);
  });

  // A slow import that resolves after a newer one must not replace the newer
  // buffer: only the newest request may write, and the superseded one is
  // ignored (and its controller aborted).
  it("lets only the newest import write the buffer", async () => {
    const pending: Array<(value: string) => void> = [];
    vi.mocked(fetchCss).mockImplementation(
      () => new Promise<string>((resolve) => pending.push(resolve)),
    );
    await renderDialog();
    await click(button("Fetch URL"));
    const urlField = document.querySelector<HTMLInputElement>('input[aria-label="Stylesheet URL"]')!;

    await act(async () => setValue(urlField, "https://one.example/slow.css"));
    await act(async () =>
      urlField.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );
    expect(pending).toHaveLength(1);

    await act(async () => setValue(urlField, "https://two.example/fast.css"));
    await act(async () =>
      urlField.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );
    expect(pending).toHaveLength(2);

    // The newer import resolves first; the stale one lands last.
    await act(async () => pending[1]("--newer: 1;"));
    await act(async () => pending[0]("--stale: 1;"));

    expect(textPane()!.value).toBe("--newer: 1;");
  });

  // Finding 3 (#124 fix): a superseded fetch's `finally` must not clear the
  // live fetch's loading state while the newer request is still in flight.
  it("keeps the live fetch's loading state when an earlier one is superseded", async () => {
    const pending: Array<(value: string) => void> = [];
    vi.mocked(fetchCss).mockImplementation(
      () => new Promise<string>((resolve) => pending.push(resolve)),
    );
    await renderDialog();
    await click(button("Fetch URL"));
    const urlField = document.querySelector<HTMLInputElement>('input[aria-label="Stylesheet URL"]')!;

    await act(async () => setValue(urlField, "https://one.example/slow.css"));
    await act(async () =>
      urlField.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );
    await act(async () => setValue(urlField, "https://two.example/fast.css"));
    await act(async () =>
      urlField.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );

    const fetchButton = document.querySelector<HTMLButtonElement>(
      ".app-import-inline .tok-btn-primary",
    )!;
    expect(fetchButton.disabled).toBe(true);
    expect(fetchButton.textContent).toBe("…");

    await act(async () => pending[1]("--newer: 1;"));
  });

  // Finding 4 (#124 fix): the `.json` file read has no request guard, so its
  // late result overwrites the buffer even after a newer import took over.
  it("ignores a JSON file read that a newer import superseded", async () => {
    const pending: Array<(value: string) => void> = [];
    vi.mocked(fetchCss).mockImplementation(
      () => new Promise<string>((resolve) => pending.push(resolve)),
    );
    await renderDialog();
    await click(button("JSON export"));

    let resolveJson!: (value: string) => void;
    const file = {
      name: "aurora.json",
      text: () => new Promise<string>((resolve) => (resolveJson = resolve)),
    } as unknown as File;
    const jsonInput = document.querySelector<HTMLInputElement>('input[type="file"][accept*="json"]')!;
    Object.defineProperty(jsonInput, "files", { value: [file], configurable: true });
    await act(async () => jsonInput.dispatchEvent(new Event("change", { bubbles: true })));

    await click(button("Fetch URL"));
    const urlField = document.querySelector<HTMLInputElement>('input[aria-label="Stylesheet URL"]')!;
    await act(async () => setValue(urlField, "https://two.example/fast.css"));
    await act(async () =>
      urlField.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );
    await act(async () => pending[0]("--newer: 1;"));

    await act(async () => resolveJson(JSON_EXPORT));
    expect(textPane()!.value).toBe("--newer: 1;");
  });

  // Finding 5 (#124 fix): editing the text by hand is a newer buffer than a
  // slow URL import, so the completion must not replace it.
  it("cancels a pending URL fetch when the text is edited by hand", async () => {
    const pending: Array<(value: string) => void> = [];
    vi.mocked(fetchCss).mockImplementation(
      () => new Promise<string>((resolve) => pending.push(resolve)),
    );
    await renderDialog();
    await click(button("Fetch URL"));
    const urlField = document.querySelector<HTMLInputElement>('input[aria-label="Stylesheet URL"]')!;
    await act(async () => setValue(urlField, "https://slow.example/tokens.css"));
    await act(async () =>
      urlField.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );

    await act(async () => setValue(textPane()!, "--manual: 1;"));
    await act(async () => pending[0]("--fetched: 1;"));

    expect(textPane()!.value).toBe("--manual: 1;");
  });

  // Finding 5 (#124 fix), the other named path: filling a schema row is a
  // manual buffer edit too, and must cancel the in-flight fetch.
  it("cancels a pending URL fetch when a schema row is filled by hand", async () => {
    const pending: Array<(value: string) => void> = [];
    vi.mocked(fetchCss).mockImplementation(
      () => new Promise<string>((resolve) => pending.push(resolve)),
    );
    await renderDialog();
    await click(button("Fetch URL"));
    const urlField = document.querySelector<HTMLInputElement>('input[aria-label="Stylesheet URL"]')!;
    await act(async () => setValue(urlField, "https://slow.example/tokens.css"));
    await act(async () =>
      urlField.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );

    const filter = document.querySelector<HTMLInputElement>('input[aria-label="Filter tokens by name"]')!;
    await act(async () => setValue(filter, "--color-bg"));
    const row = document.querySelector<HTMLInputElement>('input[aria-label="--color-bg"]')!;
    await act(async () => setValue(row, "#fff"));
    await act(async () => pending[0]("--fetched: 1;"));

    expect(textPane()!.value).toContain("--color-bg: #fff;");
    expect(textPane()!.value).not.toContain("--fetched: 1;");
  });
});
