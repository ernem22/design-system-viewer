// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { ImportSheet } from "./ImportSheet.tsx";
import { fetchCss } from "../lib/cssImport.ts";

vi.mock("../lib/cssImport.ts", () => ({
  fetchCss: vi.fn(),
  readCssFile: vi.fn(),
}));

// Every source feeds the same buffer; the race guard lets only the newest
// import write it, and a manual edit supersedes an in-flight import.

const JSON_EXPORT = JSON.stringify({
  name: "Aurora",
  slug: "aurora",
  css: "--color-bg: #0a0a0f;\n--color-text: #f0f0f3;",
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function renderSheet(): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <ImportSheet
        open
        onOpenChange={() => {}}
        onAdd={() => {}}
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
const urlField = () => document.querySelector<HTMLInputElement>('input[aria-label="Stylesheet URL"]');

function button(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === label,
  );
}

async function click(el: HTMLElement | undefined): Promise<void> {
  await act(async () => el!.click());
}

async function openUrlRow(): Promise<void> {
  await click(button("From URL"));
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  vi.restoreAllMocks();
});

describe("ImportSheet sources", () => {
  it("opens one source row at a time, and only when asked", async () => {
    await renderSheet();
    expect(document.querySelector(".app-import-inline")).toBeNull();
    await openUrlRow();
    expect(urlField()).not.toBeNull();
    expect(document.querySelector('textarea[aria-label="System JSON"]')).toBeNull();
    await click(button("Paste JSON export"));
    expect(document.querySelector('textarea[aria-label="System JSON"]')).not.toBeNull();
    expect(urlField()).toBeNull();
  });

  it("imports JSON through its row", async () => {
    await renderSheet();
    await click(button("Paste JSON export"));
    await act(async () =>
      setValue(document.querySelector<HTMLTextAreaElement>('textarea[aria-label="System JSON"]')!, JSON_EXPORT),
    );
    await click(button("Use this JSON"));
    expect(textPane()!.value).toBe("--color-bg: #0a0a0f;\n--color-text: #f0f0f3;");
    expect(document.querySelector(".app-import-source")?.textContent).toContain("Aurora");
  });

  it("expands the schema helper and edits the same buffer", async () => {
    await renderSheet();
    const schema = document.querySelector<HTMLDetailsElement>(".app-import-schema")!;
    expect(schema.open).toBe(false);
    await click(schema.querySelector("summary")!);
    expect(schema.open).toBe(true);

    const filter = schema.querySelector<HTMLInputElement>('input[aria-label="Filter tokens by name"]')!;
    await act(async () => setValue(filter, "--color-bg"));
    const row = schema.querySelector<HTMLInputElement>('input[aria-label="--color-bg"]')!;
    await act(async () => setValue(row, "#111"));
    expect(textPane()!.value).toBe("--color-bg: #111;\n");
  });

  it("lets only the newest URL import write the buffer", async () => {
    const pending: Array<(value: string) => void> = [];
    vi.mocked(fetchCss).mockImplementation(
      () => new Promise<string>((resolve) => pending.push(resolve)),
    );
    await renderSheet();
    await openUrlRow();

    await act(async () => setValue(urlField()!, "https://one.example/slow.css"));
    await act(async () => urlField()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(pending).toHaveLength(1);

    await act(async () => setValue(urlField()!, "https://two.example/fast.css"));
    await act(async () => urlField()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(pending).toHaveLength(2);

    await act(async () => pending[1]("--newer: 1;"));
    await act(async () => pending[0]("--stale: 1;"));
    expect(textPane()!.value).toBe("--newer: 1;");
  });

  it("keeps the live fetch's loading state when an earlier one is superseded", async () => {
    const pending: Array<(value: string) => void> = [];
    vi.mocked(fetchCss).mockImplementation(
      () => new Promise<string>((resolve) => pending.push(resolve)),
    );
    await renderSheet();
    await openUrlRow();

    await act(async () => setValue(urlField()!, "https://one.example/slow.css"));
    await act(async () => urlField()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    await act(async () => setValue(urlField()!, "https://two.example/fast.css"));
    await act(async () => urlField()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));

    const fetch = button("Fetching…")!;
    expect(fetch.disabled).toBe(true);
    expect(fetch.getAttribute("aria-busy")).toBe("true");

    await act(async () => pending[1]("--newer: 1;"));
  });

  it("cancels a pending URL fetch when the text is edited by hand", async () => {
    const pending: Array<(value: string) => void> = [];
    vi.mocked(fetchCss).mockImplementation(
      () => new Promise<string>((resolve) => pending.push(resolve)),
    );
    await renderSheet();
    await openUrlRow();
    await act(async () => setValue(urlField()!, "https://slow.example/tokens.css"));
    await act(async () => urlField()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));

    await act(async () => setValue(textPane()!, "--manual: 1;"));
    await act(async () => pending[0]("--fetched: 1;"));

    expect(textPane()!.value).toBe("--manual: 1;");
  });
});
