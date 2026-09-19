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

const firstTwo = ["aurora", "chatgpt"];

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let view: CompareViewModel | null = null;

function Harness({ systems }: { systems: DesignSystem[] }) {
  view = useCompareView(systems);
  return null;
}

async function mount(systems: DesignSystem[]): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Harness systems={systems} />);
  });
}

async function rerender(systems: DesignSystem[]): Promise<void> {
  await act(async () => {
    root!.render(<Harness systems={systems} />);
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
