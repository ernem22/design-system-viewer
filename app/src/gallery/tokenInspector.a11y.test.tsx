// @vitest-environment happy-dom
// RED for issue #223: token inspector a11y slice of audit #127.
// The picker must be a plain group of buttons (no listbox role without
// options); the icon-only undo buttons must expose their name via
// aria-label (title alone is not a name); the search field's
// `outline: none` needs a :focus-visible/:focus-within replacement; the
// overlay + drawer animations need a prefers-reduced-motion override; and
// drawer + overlay need overscroll-behavior: contain. The search autofocus
// must be guarded so touch devices do not get a forced keyboard.
import { readFileSync } from "node:fs";
import { act } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ALL_TOKENS,
  clearAll,
  kindOf,
  selectScope,
  setSwap,
} from "../lib/tokenOverrides.ts";
import { ScopePanel } from "./tokenInspector.tsx";

const css = readFileSync("src/gallery/tokenInspector.css", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);
const tsx = readFileSync("src/gallery/tokenInspector.tsx", "utf8");

const colorTokens = ALL_TOKENS.filter((t) => kindOf(t.name) === "color").map((t) => t.name);
const TOKEN = colorTokens[0];
const OTHER = colorTokens[1];

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function mount(node: React.ReactNode): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(node);
  });
}

/** Open the inline swap picker for TOKEN via the real row action button. */
async function openPicker(): Promise<void> {
  await act(async () => {
    selectScope({ id: "demo", title: "Demo", tokens: [TOKEN] });
  });
  await mount(<ScopePanel valueOf={() => "#111111"} />);
  const swapAction = [...document.querySelectorAll<HTMLButtonElement>(".dsv-token-row-actions button")].find(
    (b) => b.textContent === "Use another token here",
  )!;
  await act(async () => {
    swapAction.click();
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  act(() => {
    selectScope(null);
    clearAll();
  });
  document.body.innerHTML = "";
});

describe("token inspector a11y (#223)", () => {
  it("picker is a plain group of buttons, not a listbox without options", async () => {
    await openPicker();
    // The fix picks the plain-group side: no listbox role at all. On the
    // parent commit this fails: role=listbox wraps plain buttons.
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    const group = document.querySelector(".dsv-token-picker-list")!;
    expect(group.getAttribute("role")).toBe("group");
    expect(group.querySelectorAll("button").length).toBeGreaterThan(0);
  });

  it("icon-only undo button exposes its name via aria-label, not title alone", async () => {
    await act(async () => {
      selectScope({ id: "demo", title: "Demo", tokens: [TOKEN] });
      setSwap("demo", TOKEN, OTHER);
    });
    await mount(<ScopePanel valueOf={() => "#111111"} />);
    const undo = document.querySelector<HTMLButtonElement>(".dsv-token-row-undo")!;
    // On the parent commit this fails: aria-label is null, title is the only name.
    expect(undo.getAttribute("aria-label")).toBe(`Stop using ${OTHER} here`);
  });

  it("search field outline:none has a focus-visible/focus-within replacement", () => {
    expect(css).toMatch(/\.dsv-token-picker-search input[^}]*outline:\s*none/);
    // On the parent commit this fails: no focus rule for the search field.
    expect(css).toMatch(/\.dsv-token-picker-search[^{]*:focus-(visible|within)[^{]*\{[^}]*outline/);
  });

  it("drawer and overlay honour prefers-reduced-motion", () => {
    // On the parent commit this fails: no reduced-motion block at all.
    expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/);
    const reduced = css.slice(css.indexOf("prefers-reduced-motion"));
    expect(reduced).toMatch(/\.dsv-drawer-overlay/);
    expect(reduced).toMatch(/\.dsv-drawer/);
    expect(reduced).toMatch(/animation\s*:\s*none/);
  });

  it("drawer and overlay contain overscroll", () => {
    // On the parent commit this fails: no overscroll-behavior anywhere.
    expect(css).toMatch(/\.dsv-drawer-overlay[^}]*overscroll-behavior:\s*contain/);
    expect(css).toMatch(/\.dsv-drawer[^}]*overscroll-behavior:\s*contain/);
  });

  it("search autofocus is guarded for touch devices", () => {
    // On the parent commit this fails: bare autoFocus with no touch guard.
    expect(tsx).not.toMatch(/\bautoFocus\b/);
    expect(tsx).toMatch(/pointer:\s*fine|matchMedia/);
  });
});
