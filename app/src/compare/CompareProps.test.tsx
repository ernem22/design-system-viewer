// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { CompareProps } from "./CompareProps.tsx";
import { CompareView } from "./CompareView.tsx";
import { useCompareView } from "./useCompareView.ts";
import type { CompareViewModel } from "./useCompareView.ts";
import type { DesignSystem } from "../systems/store.ts";

// Issue #120: the "Selected systems" block was read-only text, so the only way
// to unpick a system was the 38-row rail. These mount the real useCompareView
// with both views sharing it (exactly how App wires them) and remove a system
// from the block itself, asserting the column and the row both go — through the
// one existing selection state, not a second one.

function system(slug: string, name = slug): DesignSystem {
  return {
    slug,
    name,
    css: ":root { --color-accent: #6366f1; }",
    groups: [
      { id: "g", label: "Colors", kind: "color", tokens: [{ name: "--color-accent", value: "#6366f1" }] },
    ],
    createdAt: "",
    updatedAt: "",
  } as unknown as DesignSystem;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let view: CompareViewModel | null = null;

function Harness({ systems }: { systems: DesignSystem[] }) {
  view = useCompareView(systems);
  return (
    <>
      <CompareView view={view} />
      <CompareProps view={view} />
    </>
  );
}

async function mount(systems: DesignSystem[]): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Harness systems={systems} />);
  });
  return host;
}

const removeButtons = (el: HTMLElement): HTMLButtonElement[] =>
  [...el.querySelectorAll<HTMLButtonElement>(".cmp-props-remove")];

const propNames = (el: HTMLElement): string[] =>
  [...el.querySelectorAll(".cmp-props-list li .cmp-props-name")].map((n) => n.textContent ?? "");

function colHeadings(el: HTMLElement): string[] {
  return [...el.querySelectorAll(".cmp-col-head")].map((head) => {
    const clone = head.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".cmp-swatch, .cmp-cov").forEach((n) => n.remove());
    return clone.textContent?.trim() ?? "";
  });
}

const click = async (el: Element) => {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  view = null;
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

describe("CompareProps in-place removal (#120)", () => {
  it("renders a real, named remove control for every selected system", async () => {
    const el = await mount([system("aurora", "Aurora"), system("chatgpt", "ChatGPT"), system("claude")]);

    const buttons = removeButtons(el);
    expect(buttons).toHaveLength(2);
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Remove Aurora from the comparison",
      "Remove ChatGPT from the comparison",
    ]);
    // A real control, not a clickable div: a <button> with native semantics and
    // a keyboard path.
    for (const b of buttons) {
      expect(b.tagName).toBe("BUTTON");
      expect(b.disabled).toBe(false);
      expect(b.tabIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it("removes a system from the comparison view itself, through the one selection state", async () => {
    const el = await mount([system("aurora", "Aurora"), system("chatgpt", "ChatGPT"), system("claude", "Claude")]);
    // Seed a third pick so removal leaves two columns (the <2 placeholder path
    // is covered separately) and the column actually disappears.
    await act(async () => {
      view!.toggle("claude");
    });
    expect(colHeadings(el)).toEqual(["Aurora", "ChatGPT", "Claude"]);

    await click(removeButtons(el)[0]!);

    expect(view!.picked).toEqual(["chatgpt", "claude"]);
    expect(propNames(el)).toEqual(["ChatGPT", "Claude"]);
    expect(colHeadings(el)).toEqual(["ChatGPT", "Claude"]);
    expect(el.querySelector(".cmp-cols")?.getAttribute("data-count")).toBe("2");
  });

  it("moves focus with the keyboard path the button exposes", async () => {
    const el = await mount([system("aurora", "Aurora"), system("chatgpt", "ChatGPT")]);
    const button = removeButtons(el)[0]!;
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it("keeps the boundary paths intact: down to one, then zero", async () => {
    const el = await mount([system("aurora", "Aurora"), system("chatgpt", "ChatGPT")]);

    await click(removeButtons(el)[0]!);
    expect(view!.cols.map((s) => s.slug)).toEqual(["chatgpt"]);
    expect(removeButtons(el)).toHaveLength(1);
    expect(el.querySelector(".app-placeholder")?.textContent).toContain("Select at least 2 systems");
    // No stale column for the removed system.
    expect(el.querySelectorAll(".cmp-col")).toHaveLength(0);

    await click(removeButtons(el)[0]!);
    expect(view!.cols).toEqual([]);
    expect(el.querySelector(".cmp-props-empty")?.textContent).toContain("Pick systems in the rail");
    expect(el.querySelectorAll(".cmp-col")).toHaveLength(0);
    expect(removeButtons(el)).toHaveLength(0);
  });

  it("keeps the 4/4 cap showing exactly the four picked systems and no other", async () => {
    const el = await mount([
      system("aurora", "Aurora"),
      system("chatgpt", "ChatGPT"),
      system("claude", "Claude"),
      system("figma", "Figma"),
      system("framer", "Framer"),
    ]);
    // Default picks the first two; add two more to reach the cap.
    await act(async () => {
      view!.toggle("claude");
    });
    await act(async () => {
      view!.toggle("figma");
    });

    expect(view!.picked).toEqual(["aurora", "chatgpt", "claude", "figma"]);
    expect(view!.picked).toHaveLength(view!.maxColumns);
    expect(colHeadings(el)).toEqual(["Aurora", "ChatGPT", "Claude", "Figma"]);
    expect(el.querySelectorAll(".cmp-col")).toHaveLength(4);
    expect(el.textContent).not.toContain("Framer");
  });
});
