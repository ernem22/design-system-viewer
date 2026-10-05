// @vitest-environment happy-dom
/**
 * RED on the parent for issue #224 (a11y slice of audit #127): Tokens
 * toolbar and dialogs — input names, overscroll, live status, number format.
 *
 * Fails on the parent commit where the filter + URL inputs have no `name`,
 * the Add-Tokens dialog suppresses its own Description via
 * `aria-describedby={undefined}`, and ContrastSection formats ratios with
 * `toFixed(2)` instead of `Intl.NumberFormat`. Companion assertions pin the
 * rest of the issue's findings (roving toolbar keys, overscroll/touch-action,
 * aria-hidden warning glyph, tabular-nums, textarea name/placeholder,
 * CssSourceBar autocomplete + live busy state, curly apostrophe).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { TokenToolbar } from "./TokenToolbar.tsx";
import { TokenDialog } from "./TokenDialog.tsx";
import { CssSourceBar } from "./CssSourceBar.tsx";
import { TokenEditControl } from "./InlineEditor.tsx";
import { TokensView } from "./TokensView.tsx";
import { CssPreview } from "./CssPreview.tsx";
import { useTokensView } from "./useTokensView.ts";
import type { DesignSystem, Token, TokenGroup } from "../systems/store.ts";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const token: Token = { name: "--color-bg", value: "#fff" };
const group: TokenGroup = { id: "color-bg", label: "Background", kind: "color", tokens: [token] };

const system: DesignSystem = {
  slug: "aurora",
  name: "Aurora",
  css: ":root { --color-bg: #fff; }",
  groups: [group],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// Invalid hex trips lintTokens, so the TokensView warning row (the ⚠) renders.
const warnSystem: DesignSystem = {
  ...system,
  slug: "warn-fixture",
  css: ":root { --color-bg: #zzz; }",
  groups: [{ ...group, tokens: [{ name: "--color-bg", value: "#zzz" }] }],
};

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
  return host;
}

function ToolbarProbe() {
  const view = useTokensView(system, noop);
  return (
    <TokenToolbar
      view={view}
      system={system}
      onMerge={noop}
      onExportCss={noop}
      onExportJson={noop}
      onDelete={noop}
    />
  );
}

function WarnProbe() {
  const view = useTokensView(warnSystem, noop);
  return (
    <TokensView system={warnSystem} view={view} onDelete={noop} onMerge={noop} onPatch={noop} />
  );
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  document.body.innerHTML = "";
});

describe("issue #224 RED: input names, dialog description, number format", () => {
  it("names the toolbar filter input", async () => {
    const el = await mount(<ToolbarProbe />);
    const input = el.querySelector<HTMLInputElement>("input.tok-filter")!;
    expect(input, "filter input renders").not.toBeNull();
    expect(input.getAttribute("name"), "filter input name").toBeTruthy();
  });

  it("names the stylesheet URL input with autocomplete off and no spellcheck", async () => {
    const el = await mount(<CssSourceBar onLoad={noop} onToast={noop} />);
    const input = el.querySelector<HTMLInputElement>("input.tok-source-url")!;
    expect(input, "url input renders").not.toBeNull();
    expect(input.getAttribute("name"), "url input name").toBeTruthy();
    expect(input.getAttribute("autocomplete"), "url input autocomplete").toBeTruthy();
    expect(input.getAttribute("spellcheck"), "url input spellcheck").toBe("false");
  });

  it("links the Add-Tokens dialog to its rendered description", async () => {
    await mount(<TokenDialog system={system} onMerge={noop} onToast={noop} />);
    const trigger = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Add tokens",
    )!;
    await act(async () => trigger.click());
    const content = document.querySelector('[role="dialog"].tok-dialog');
    expect(content, "dialog content renders").not.toBeNull();
    const describedBy = content!.getAttribute("aria-describedby");
    expect(describedBy, "dialog aria-describedby").toBeTruthy();
    const desc = describedBy ? document.getElementById(describedBy) : null;
    expect(desc, "describedby target exists").not.toBeNull();
    expect(desc!.textContent).toMatch(/Nothing is overwritten/);
  });

  it("formats contrast ratios with Intl.NumberFormat, not toFixed", () => {
    const src = read("./ContrastSection.tsx");
    expect(src, "uses Intl.NumberFormat").toContain("Intl.NumberFormat");
    expect(src, "no toFixed(2)").not.toContain("toFixed(2)");
  });
});

describe("issue #224 companion findings", () => {
  it("moves focus with arrow keys across the toolbar buttons", async () => {
    const el = await mount(<ToolbarProbe />);
    const toolbar = el.querySelector('[role="toolbar"]')!;
    // Arrow keys rove between buttons; the filter textbox keeps its caret
    // keys, so the round-trip starts from the first action button instead.
    const add = [...toolbar.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent?.trim() === "Add tokens",
    )!;
    const buttons = [...toolbar.querySelectorAll<HTMLButtonElement>("button")].filter(
      (b) => !b.disabled,
    );
    const next = buttons[buttons.indexOf(add) + 1];
    expect(next, "a button follows Add tokens").toBeTruthy();
    add.focus();
    await act(async () => {
      add.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(document.activeElement, "ArrowRight moves focus").toBe(next);
    await act(async () => {
      next.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    expect(document.activeElement, "ArrowLeft moves focus back").toBe(add);
  });

  it("contains overscroll in the dialog overlay + scrolling dialog", () => {
    const css = read("./TokenToolbar.css");
    const ruleText = (selector: string) => {
      const at = css.indexOf(`${selector} {`);
      if (at === -1) return "";
      const end = css.indexOf("}", at);
      return css.slice(at, end === -1 ? undefined : end);
    };
    expect(ruleText(".tok-dialog-overlay")).toContain("overscroll-behavior: contain");
    expect(ruleText(".tok-dialog"), "tok-dialog rule").toContain("overscroll-behavior: contain");
    expect(ruleText(".tok-btn"), "tok-btn rule").toContain("touch-action: manipulation");
  });

  it("hides the decorative warning glyph from assistive tech", async () => {
    const el = await mount(<WarnProbe />);
    const summary = el.querySelector(".tok-warns summary");
    expect(summary, "warning summary renders").not.toBeNull();
    const glyph = summary!.querySelector('[aria-hidden="true"]');
    expect(glyph, "glyph hidden").not.toBeNull();
    expect(glyph!.textContent).toContain("⚠");
  });

  it("renders coverage + contrast numbers with tabular-nums", () => {
    const propsCss = read("./TokensProps.css");
    const contrastCss = read("./ContrastSection.css");
    expect(propsCss, "coverage % tabular-nums").toContain("tabular-nums");
    expect(contrastCss, "contrast num tabular-nums").toContain("tabular-nums");
  });

  it("names the Add-Tokens textarea and ends its placeholder with an ellipsis", async () => {
    await mount(<TokenDialog system={system} onMerge={noop} onToast={noop} />);
    const trigger = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Add tokens",
    )!;
    await act(async () => trigger.click());
    const area = document.querySelector<HTMLTextAreaElement>("textarea.tok-textarea")!;
    expect(area, "textarea renders").not.toBeNull();
    expect(area.getAttribute("name"), "textarea name").toBeTruthy();
    expect(area.getAttribute("placeholder"), "placeholder ellipsis").toMatch(/…$/);
  });

  it("names the inline editor input", async () => {
    await mount(
      <TokenEditControl token={token} open={true} onOpenChange={noop} onSave={noop} />,
    );
    const input = document.querySelector<HTMLInputElement>("input.tok-pop-input");
    expect(input, "inline editor input renders").not.toBeNull();
    expect(input!.getAttribute("name"), "inline editor input name").toBeTruthy();
  });

  it("announces the Fetch busy swap", async () => {
    const el = await mount(<CssSourceBar onLoad={noop} onToast={noop} />);
    const fetch = [...el.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Fetch",
    )!;
    expect(
      fetch.getAttribute("aria-live") ?? fetch.getAttribute("aria-busy"),
      "fetch announces busy",
    ).toBeTruthy();
  });

  it("uses a curly apostrophe in the CssPreview extra note", async () => {
    const el = await mount(
      <CssPreview css=":root { --color-bg: #fff; --nope-extra: 1; }" baseCss={system.css} />,
    );
    const summary = el.querySelector(".tok-dialog-preview summary");
    expect(summary, "extra summary renders").not.toBeNull();
    expect(summary!.textContent, "curly apostrophe").toContain("won’t");
    expect(summary!.textContent, "no straight apostrophe").not.toContain("won't");
  });
});
