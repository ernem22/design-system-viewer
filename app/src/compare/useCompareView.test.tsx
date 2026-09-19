// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { useCompareView } from "./useCompareView.ts";
import type { CompareViewModel } from "./useCompareView.ts";
import type { DesignSystem } from "../systems/store.ts";

// Issue #20: first boot renders `systems` as [] (async fetch), so the picked
// initialiser seeds nothing; when the systems arrive the repair effect saw
// valid.length === cur.length (0 === 0) and bailed, leaving `cols = []` and the
// "Select at least 2 systems" placeholder on a fresh load. These tests mount the
// real hook and drive systems from empty to loaded the same way App does.

function system(slug: string, name = slug): DesignSystem {
  return { slug, name, css: "", groups: [], createdAt: "", updatedAt: "" };
}

/** Issue #22: a system that ships a dark variant overriding one of its two
    group tokens, so a resolved-for-dark read is distinguishable from light. */
function darkSystem(): DesignSystem {
  return {
    slug: "aurora",
    name: "Aurora",
    css: ":root { --color-bg: #f8fafc; --color-accent: #6366f1; }",
    groups: [
      {
        id: "surface",
        label: "Surface / Elevation",
        kind: "color",
        tokens: [
          { name: "--color-bg", value: "#f8fafc" },
          { name: "--color-accent", value: "#6366f1" },
        ],
      },
    ],
    themes: { dark: [{ name: "--color-bg", value: "#0a0f1c" }] },
    createdAt: "",
    updatedAt: "",
  };
}

const firstTwo = ["aurora", "chatgpt"];

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let view: CompareViewModel | null = null;

function Harness({ systems, dark = false }: { systems: DesignSystem[]; dark?: boolean }) {
  view = useCompareView(systems, dark);
  return null;
}

async function mount(systems: DesignSystem[], dark = false): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Harness systems={systems} dark={dark} />);
  });
}

async function rerender(systems: DesignSystem[], dark = false): Promise<void> {
  await act(async () => {
    root!.render(<Harness systems={systems} dark={dark} />);
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

describe("useCompareView default selection", () => {
  it("defaults to the first two systems once the async list arrives", async () => {
    await mount([]);
    expect(view!.picked).toEqual([]);

    await rerender([system("aurora"), system("chatgpt"), system("claude")]);

    expect(view!.picked).toEqual(firstTwo);
    expect(view!.cols.map((s) => s.slug)).toEqual(firstTwo);
  });

  it("does not re-seed after the user deliberately clears the selection", async () => {
    await mount([system("aurora"), system("chatgpt")]);
    expect(view!.picked).toEqual(firstTwo);

    await act(async () => {
      view!.toggle("aurora");
    });
    await act(async () => {
      view!.toggle("chatgpt");
    });
    expect(view!.picked).toEqual([]);

    await rerender([system("aurora"), system("chatgpt"), system("claude")]);
    expect(view!.picked).toEqual([]);
    expect(view!.cols).toEqual([]);
  });

  it("keeps a valid deep-linked selection across the async load", async () => {
    window.history.replaceState({}, "", "/?cmp=claude");
    await mount([]);
    expect(view!.picked).toEqual(["claude"]);

    await rerender([system("aurora"), system("chatgpt"), system("claude")]);
    expect(view!.picked).toEqual(["claude"]);
  });

  it("falls back to the first two systems when a deep link names no known slug", async () => {
    window.history.replaceState({}, "", "/?cmp=ghost");
    await mount([]);

    await rerender([system("aurora"), system("chatgpt"), system("claude")]);
    expect(view!.picked).toEqual(firstTwo);
  });
});

describe("useCompareView dark variant (#22)", () => {
  it("resolves styleFor to the light value when dark is off", async () => {
    await mount([darkSystem()]);
    expect(view!.styleFor.get("aurora")?.["--color-bg"]).toBe("#f8fafc");
  });

  it("resolves styleFor to the dark override when dark is on", async () => {
    await mount([darkSystem()], true);
    expect(view!.styleFor.get("aurora")?.["--color-bg"]).toBe("#0a0f1c");
  });

  it("overlays dark per token, leaving non-overridden tokens light", async () => {
    await mount([darkSystem()], true);
    expect(view!.styleFor.get("aurora")?.["--color-accent"]).toBe("#6366f1");
  });

  it("feeds the diff table's groups the dark override when dark is on", async () => {
    await mount([darkSystem()], true);
    const token = view!.cols[0]?.groups
      .flatMap((g) => g.tokens)
      .find((t) => t.name === "--color-bg");
    expect(token?.value).toBe("#0a0f1c");
  });

  it("never mutates the stored system when overlaying dark", async () => {
    const sys = darkSystem();
    await mount([sys], true);
    expect(sys.groups[0]?.tokens[0]?.value).toBe("#f8fafc");
    expect(sys.themes?.dark?.[0]?.value).toBe("#0a0f1c");
  });
});
