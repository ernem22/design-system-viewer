// @vitest-environment happy-dom
/**
 * RED for issue #221 (a11y slice of audit #127): token rows and schema
 * table are mouse-only, with invalid aria-selected.
 *
 * Fails on the parent where a token row / colour swatch / schema row is a
 * clickable div/tr with no tabIndex, no role and no keyboard handler, and
 * `aria-selected` sits on an element without a role that supports it.
 * Companion assertions pin RefBadge's accessible text and the rows.css
 * findings (tabular-nums, truncation so the name cannot overflow).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { ColorGrid, RefBadge, TokenRow, BarRow } from "./rows.tsx";
import { SchemaView } from "./SchemaView.tsx";
import { useTokensView } from "./useTokensView.ts";
import type { DesignSystem, Token } from "../systems/store.ts";
import type { PushToast } from "../lib/toasts.ts";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const token: Token = { name: "--space-1", value: "0.25rem" };
const colorToken: Token = { name: "--color-accent", value: "#4f46e5" };
const noop = () => {};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function mount(node: React.ReactNode): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(node);
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

function keydown(el: Element, key: string): void {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

const rowCallbacks = (onPick: (t: Token) => void) => ({
  selectedName: "--space-1",
  onPick,
  editingName: null as string | null,
  onEdit: noop,
  onSave: noop,
});

describe("issue #221 RED: pickable rows are keyboard-operable with a valid role/state", () => {
  it("focuses a token row and picks it with Enter", async () => {
    const onPick = vi.fn();
    const el = await mount(
      <TokenRow token={token} demo={null} {...rowCallbacks(onPick)} />,
    );
    const row = el.querySelector<HTMLElement>("[data-token='--space-1']")!;
    expect(row, "token row renders").not.toBeNull();
    expect(row.tabIndex, "row is Tab-reachable").toBeGreaterThanOrEqual(0);
    expect(row.getAttribute("role"), "row exposes option role").toBe("option");
    expect(row.getAttribute("aria-selected"), "row exposes selected state").toBe("true");
    keydown(row, "Enter");
    expect(onPick, "Enter picks the token").toHaveBeenCalledWith(token);
  });

  it("picks a token row with Space and exposes listbox context", async () => {
    const onPick = vi.fn();
    const el = await mount(
      <BarRow tokens={[token]} {...rowCallbacks(onPick)} />,
    );
    const row = el.querySelector<HTMLElement>("[data-token='--space-1']")!;
    keydown(row, " ");
    expect(onPick, "Space picks the token").toHaveBeenCalledWith(token);
    const list = el.querySelector("[role='listbox']") ?? row.closest("[role='listbox']");
    expect(list, "row sits in a listbox").not.toBeNull();
  });

  it("focuses a colour swatch and picks it with Enter", async () => {
    const onPick = vi.fn();
    const el = await mount(
      <ColorGrid
        tokens={[colorToken]}
        selectedName={colorToken.name}
        onPick={onPick}
        editingName={null}
        onEdit={noop}
        onSave={noop}
      />,
    );
    const swatch = el.querySelector<HTMLElement>(`[data-token='${colorToken.name}']`)!;
    expect(swatch, "swatch renders").not.toBeNull();
    expect(swatch.tabIndex, "swatch is Tab-reachable").toBeGreaterThanOrEqual(0);
    expect(swatch.getAttribute("role"), "swatch exposes option role").toBe("option");
    expect(swatch.getAttribute("aria-selected"), "swatch exposes selected state").toBe("true");
    keydown(swatch, "Enter");
    expect(onPick, "Enter picks the swatch").toHaveBeenCalledWith(colorToken);
  });
});

function SchemaHarness({ system, push }: { system: DesignSystem; push: PushToast }) {
  const view = useTokensView(system, push);
  return (
    <SchemaView
      view={view}
      onPick={view.copyToken}
      editingName={view.editingName}
      onEdit={view.onEdit}
      onSave={() => {}}
    />
  );
}

describe("issue #221 RED: schema rows are keyboard-operable inside a grid", () => {
  it("focuses a schema row, picks it with Enter, and keeps aria-selected valid", async () => {
    const system = {
      slug: "demo",
      name: "Demo",
      css: ":root { --color-accent: #4f46e5; }",
    } as unknown as DesignSystem;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const el = await mount(<SchemaHarness system={system} push={vi.fn()} />);
    const row = el.querySelector<HTMLElement>("[data-token='--color-accent']")!;
    expect(row, "schema row renders").not.toBeNull();
    expect(row.tabIndex, "schema row is Tab-reachable").toBeGreaterThanOrEqual(0);
    expect(row.closest("table")?.getAttribute("role"), "schema table is a grid").toBe("grid");
    keydown(row, "Enter");
    expect(writeText, "Enter copies the schema token").toHaveBeenCalledWith(
      "--color-accent: #4f46e5;",
    );
  });
});

describe("issue #221 companion findings", () => {
  it("exposes RefBadge meaning as accessible text, not title-only", async () => {
    const el = await mount(<RefBadge value="var(--space-1)" />);
    const badge = el.querySelector(".tok-ref")!;
    expect(badge, "badge renders for a reference").not.toBeNull();
    const name =
      badge.getAttribute("aria-label") ?? badge.querySelector("[aria-label]")?.getAttribute("aria-label");
    expect(name, "badge has an accessible name").toBeTruthy();
  });

  it("renders numeric values with tabular-nums", () => {
    const css = read("./rows.css");
    const at = css.indexOf(".tok-num");
    expect(at, ".tok-num rule exists").toBeGreaterThanOrEqual(0);
    expect(css.slice(at, css.indexOf("}", at)), ".tok-num tabular-nums").toContain("tabular-nums");
  });

  it("truncates the row name so it cannot overflow its track", () => {
    const css = read("./rows.css");
    const at = css.indexOf(".tok-row-name");
    expect(at, ".tok-row-name rule exists").toBeGreaterThanOrEqual(0);
    const body = css.slice(at, css.indexOf("}", at));
    expect(body, "name truncates").toContain("text-overflow: ellipsis");
    expect(body, "name clips").toContain("overflow: hidden");
  });
});
