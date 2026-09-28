// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { REFERENCE } from "../../../src/core/schema.js";
import { SchemaFill } from "./SchemaFill.tsx";

// Issue #124: the schema is 54 groups / 432 names. Before this surface the
// only way to see the schema was a 432-line paste, so a single token could not
// be filled without copy-pasting the whole template. These tests pin the
// properties that make it navigable: one section per schema group, rows only
// for what you are looking at, a row edit that lands in the CSS text, and an
// extras list whose suggestion actually renames.

const GROUP_COUNT = (REFERENCE as unknown[]).length;

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let lastCss = "";

async function renderFill(css: string): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<SchemaFill css={css} onChange={(next) => (lastCss = next)} />);
  });
}

/** React tracks the value on the node, so a raw `.value =` is ignored: go
    through the prototype setter and fire the event React listens for. A
    `<select>` declares its own `value` accessor, so it needs its own
    prototype — the input one throws on happy-dom's private fields. */
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

const row = (name: string) => document.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`);

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  lastCss = "";
  vi.restoreAllMocks();
});

describe("SchemaFill", () => {
  it("renders one section per schema group and keeps the rows collapsed", async () => {
    await renderFill("--color-bg: #fff;");
    expect(document.querySelectorAll(".app-fill-group")).toHaveLength(GROUP_COUNT);
    expect(document.querySelectorAll(".app-fill-row")).toHaveLength(0);
    expect(document.querySelector(".app-fill-summary")?.textContent).toContain(`1/${432}`);
  });

  it("opens the groups a filter matches and shows only those rows", async () => {
    await renderFill("--color-bg: #fff;");
    const search = document.querySelector<HTMLInputElement>(".app-fill-search")!;
    await act(async () => setValue(search, "--color-bg"));
    expect(row("--color-bg")).not.toBeNull();
    expect(document.querySelectorAll(".app-fill-group")).toHaveLength(1);
  });

  it("writes a typed value into the CSS text", async () => {
    await renderFill("");
    await act(async () => setValue(document.querySelector<HTMLInputElement>(".app-fill-search")!, "--color-bg"));
    await act(async () => setValue(row("--color-bg")!, "#111"));
    expect(lastCss).toBe("--color-bg: #111;\n");
  });

  it("hides the rows that already have a value when 'Only missing' is on", async () => {
    await renderFill("--color-bg: #fff;");
    await act(async () => setValue(document.querySelector<HTMLInputElement>(".app-fill-search")!, "--color-bg"));
    expect(row("--color-bg")).not.toBeNull();
    await act(async () => document.querySelector<HTMLInputElement>(".app-fill-check input")!.click());
    expect(row("--color-bg")).toBeNull();
  });

  it("clears a declaration instead of writing an empty one", async () => {
    await renderFill("--color-bg: #fff;\n--color-text: #000;");
    await act(async () => setValue(document.querySelector<HTMLInputElement>(".app-fill-search")!, "--color-bg"));
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Clear --color-bg"]')!.click());
    expect(lastCss).toBe("--color-text: #000;");
  });

  it("lists the extras with a suggestion that renames them", async () => {
    await renderFill("--color-bg: #fff;\n--color-background: #eee;");
    const extras = document.querySelector(".app-fill-extras")!;
    expect(extras.textContent).toContain("--color-background");
    const rename = [...extras.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
      b.textContent?.startsWith("rename to"),
    )!;
    expect(rename.textContent).toBe("rename to --color-bg");
    await act(async () => rename.click());
    expect(lastCss).toBe("--color-bg: #eee;\n");
  });

  it("jumps to a single group from the group filter", async () => {
    await renderFill("--color-bg: #fff;");
    const select = document.querySelector<HTMLSelectElement>(".app-fill-groups")!;
    const surface = [...select.options].find((o) => o.text.startsWith("Surface / Elevation"))!;
    await act(async () => setValue(select, surface.value));
    expect(document.querySelectorAll(".app-fill-group")).toHaveLength(1);
    expect(row("--color-bg")).not.toBeNull();
  });
});
