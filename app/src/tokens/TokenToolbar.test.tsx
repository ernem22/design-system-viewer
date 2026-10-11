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

// Issue #312: the view switch was a single Toggle that renamed itself
// ("Schema" in gallery mode, "Gallery" in schema mode), reading as an
// action button next to Add tokens / Export. It is a segmented control now:
// a group named "View" with both labels always shown, the active one
// pressed. Gallery mode is the URL default (?tv=schema selects schema).
describe("TokenToolbar view switch segmented control", () => {
  // Radix ToggleGroup type="single" renders role="radiogroup" (a group
  // subclass, the correct single-select semantics) with role="radio" items.
  function viewGroup(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[aria-label="View"]');
  }

  function viewItems(): { gallery: HTMLButtonElement; schema: HTMLButtonElement } {
    const group = viewGroup()!;
    const buttons = [...group.querySelectorAll<HTMLButtonElement>("button")];
    const gallery = buttons.find((b) => b.textContent?.trim() === "Gallery")!;
    const schema = buttons.find((b) => b.textContent?.trim() === "Schema")!;
    expect(gallery, "Gallery item renders").toBeDefined();
    expect(schema, "Schema item renders").toBeDefined();
    return { gallery, schema };
  }

  it("shows Gallery and Schema as two items of a group named View", async () => {
    await renderToolbar();
    const group = viewGroup();
    expect(group, 'a group named "View" exists').not.toBeNull();
    expect(group!.getAttribute("role"), "group role").toMatch(/^(group|radiogroup)$/);
    const labels = [...group!.querySelectorAll("button")].map((b) => b.textContent?.trim());
    expect(labels).toEqual(["Gallery", "Schema"]);
  });

  it("marks Gallery pressed in gallery mode and flips on click", async () => {
    await renderToolbar();
    const { gallery, schema } = viewItems();
    expect(gallery.getAttribute("data-state"), "Gallery pressed in gallery mode").toBe("on");
    expect(gallery.getAttribute("aria-checked"), "Gallery selected in gallery mode").toBe("true");
    expect(schema.getAttribute("data-state")).toBe("off");

    await act(async () => {
      schema.click();
    });
    expect(schema.getAttribute("data-state"), "Schema pressed after click").toBe("on");
    // Gallery-only controls leave with gallery mode through the same
    // schemaMode/setSchemaMode (?tv=schema keeps working).
    expect(document.querySelector(".tok-inline"), "Show missing hides in schema mode").toBeNull();

    await act(async () => {
      gallery.click();
    });
    expect(gallery.getAttribute("data-state"), "Gallery pressed again").toBe("on");
    expect(
      document.querySelector(".tok-inline"),
      "Show missing returns in gallery mode",
    ).not.toBeNull();
  });

  it("keeps the toolbar arrow-key navigation across the new control", async () => {
    await renderToolbar();
    const { gallery, schema } = viewItems();
    gallery.focus();
    act(() => {
      gallery.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(document.activeElement, "ArrowRight moves Gallery -> Schema").toBe(schema);
  });
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
