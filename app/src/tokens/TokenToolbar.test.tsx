// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { TokenToolbar } from "./TokenToolbar.tsx";
import { useTokensView } from "./useTokensView.ts";
import type { DesignSystem, Token, TokenGroup } from "../systems/store.ts";

// Issue #90: the Delete confirmation is a Radix AlertDialog. Radix sets
// role="alertdialog" + aria-labelledby/-describedby, but this app never
// declared aria-modal, so the dialog was not exposed as modal.

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

let root: Root | null = null;
let host: HTMLDivElement | null = null;

/** The real Tokens view model, fed a hand-built system — the toolbar only
    reads stable fields off it, so the hook's full pipeline is unnecessary. */
function Probe() {
  const view = useTokensView(system, () => {});
  return (
    <TokenToolbar
      view={view}
      system={system}
      onMerge={() => {}}
      onExportCss={() => {}}
      onExportJson={() => {}}
      onDelete={() => {}}
    />
  );
}

async function renderToolbar(): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Probe />);
  });
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

describe("TokenToolbar delete dialog modal semantics", () => {
  it("marks the alert dialog aria-modal on its alertdialog role", async () => {
    await renderToolbar();
    const trigger = [...document.querySelectorAll<HTMLButtonElement>(".tok-toolbar button")].find(
      (b) => b.textContent?.trim() === "Delete",
    )!;
    await act(async () => trigger.click());
    const content = document.querySelector('[role="alertdialog"]');
    expect(content).not.toBeNull();
    expect(content!.getAttribute("aria-modal")).toBe("true");
    expect(content!.getAttribute("aria-labelledby")).toBeTruthy();
  });
});
