// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { CompareProps } from "./CompareProps.tsx";
import { CompareView } from "./CompareView.tsx";
import { useCompareView } from "./useCompareView.ts";
import type { CompareViewModel } from "./useCompareView.ts";
import type { DesignSystem } from "../systems/store.ts";

// The unified Compare model moved selection/removal into the rail: the props
// frame is now a read-only summary. These mount the real useCompareView with
// both views sharing it (exactly how App wires them) and assert the summary
// names systems, marks the first pick as the reference, and never exposes a
// second removal surface.

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

const propRefName = (el: HTMLElement): string | null =>
  el.querySelector(".cmp-props .cmp-props-ref-name")?.textContent ?? null;

function colHeadings(el: HTMLElement): string[] {
  return [...el.querySelectorAll(".cmp-col-head")].map((head) => {
    const clone = head.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".cmp-swatch, .cmp-cov, .cmp-ref-marker").forEach((n) => n.remove());
    return clone.textContent?.trim() ?? "";
  });
}

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

describe("CompareProps read-only reference summary", () => {
  it("names the reference once and does not repeat the selected list", async () => {
    const el = await mount([system("aurora", "Aurora"), system("chatgpt", "ChatGPT"), system("claude")]);

    expect(propRefName(el)).toBe("Aurora");
    // No third selection/catalogue list: the rail owns the selected set.
    expect(el.querySelector(".cmp-props-list")).toBeNull();
    expect(el.querySelectorAll(".cmp-props .cmp-props-name")).toHaveLength(0);
    // Other picked systems are named by the columns, not by the props panel.
    expect(el.querySelector(".cmp-props")?.textContent).not.toContain("ChatGPT");
  });

  it("follows the one selection state and moves the reference with it", async () => {
    const el = await mount([system("aurora", "Aurora"), system("chatgpt", "ChatGPT"), system("claude", "Claude")]);
    await act(async () => {
      view!.toggle("claude");
    });
    expect(colHeadings(el)).toEqual(["Aurora", "ChatGPT", "Claude"]);
    expect(propRefName(el)).toBe("Aurora");

    await act(async () => {
      view!.toggle("aurora");
    });
    expect(colHeadings(el)).toEqual(["ChatGPT", "Claude"]);
    // The first remaining pick becomes the reference; the summary says so.
    expect(propRefName(el)).toBe("ChatGPT");
  });

  it("keeps the boundary paths intact: down to one, then zero", async () => {
    const el = await mount([system("aurora", "Aurora"), system("chatgpt", "ChatGPT")]);

    await act(async () => {
      view!.toggle("aurora");
    });
    expect(propRefName(el)).toBe("ChatGPT");
    expect(el.querySelector(".app-placeholder")?.textContent).toContain("Select at least 2 systems");
    expect(el.querySelectorAll(".cmp-col")).toHaveLength(0);

    await act(async () => {
      view!.toggle("chatgpt");
    });
    expect(view!.cols).toEqual([]);
    expect(el.querySelector(".cmp-props-empty")?.textContent).toContain("Select systems in the rail");
    expect(el.querySelectorAll(".cmp-col")).toHaveLength(0);
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
    // The props summary still names only the baseline.
    expect(propRefName(el)).toBe("Aurora");
    expect(el.querySelector(".cmp-props")?.textContent).not.toContain("Framer");
  });
});

// Issue #325: the props panel showed a "100%" pill per picked system. It now
// summarises only the reference, and only when that system is incomplete.
describe("CompareProps reference coverage badge below 100% only (#325)", () => {
  it("renders nothing at 100% and a titled 32% only when the reference is incomplete", async () => {
    const { REFERENCE } = await import("../../../src/core/schema.js");
    const names: string[] = (REFERENCE as { tokens: string[] }[]).flatMap((g) => g.tokens);
    const cssFor = (count: number) =>
      `:root {\n${names.slice(0, count).map((n) => `${n}: #000;`).join("\n")}\n}`;
    const full = {
      ...system("full", "Full"),
      css: cssFor(names.length),
      groups: [
        {
          id: "g",
          label: "G",
          kind: "color",
          tokens: names.map((name) => ({ name, value: "#000" })),
        },
      ],
    } as unknown as DesignSystem;
    const figma = {
      ...system("figma", "Figma"),
      css: cssFor(138),
      groups: [
        {
          id: "g",
          label: "G",
          kind: "color",
          tokens: names.slice(0, 138).map((name) => ({ name, value: "#000" })),
        },
      ],
    } as unknown as DesignSystem;

    // Reference is complete: no badge anywhere in the props panel.
    const completeRef = await mount([full, figma]);
    expect(completeRef.querySelector(".cmp-props")?.textContent).not.toContain("100%");
    expect(completeRef.querySelectorAll(".cmp-props-pct")).toHaveLength(0);

    act(() => root?.unmount());
    root = null;
    host?.remove();

    // Reference is incomplete: one titled badge on the baseline.
    const incompleteRef = await mount([figma, full]);
    const pills = [...incompleteRef.querySelectorAll(".cmp-props-pct")];
    expect(pills).toHaveLength(1);
    expect(pills[0].textContent).toBe("32%");
    expect(pills[0].getAttribute("title")).toContain("432");
  });
});
