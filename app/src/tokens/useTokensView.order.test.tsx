// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import type { DesignSystem, TokenGroup } from "../systems/store.ts";
import { useTokensView } from "./useTokensView.ts";
import type { TokensViewModel } from "./useTokensView.ts";

// Issue #306: the Tokens tab listed component tokens first and colors second.
// `perp-ultra-v2` stores its component (`raw`) groups first, and the gallery
// + rail both followed stored order, so the rail opened on "Other" instead
// of the palette. Groups are now ordered by kind in a fixed order
// (color first, component/raw last), so the rail opens on Color.

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

interface SystemJson {
  slug: string;
  name: string;
  css: string;
  groups: TokenGroup[];
  createdAt: string;
  updatedAt: string;
}

function perpUltraV2(): DesignSystem {
  const json = JSON.parse(read("../../../systems/perp-ultra-v2.json")) as SystemJson;
  return {
    slug: json.slug,
    name: json.name,
    css: json.css,
    groups: json.groups,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let view: TokensViewModel | null = null;

function Harness({ system }: { system: DesignSystem | null }) {
  view = useTokensView(system, () => {});
  return null;
}

async function mount(system: DesignSystem | null): Promise<void> {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Harness system={system} />);
  });
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  view = null;
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

describe("useTokensView group kind order (#306)", () => {
  it("opens the rail and gallery on color groups for perp-ultra-v2", async () => {
    await mount(perpUltraV2());
    expect(view!.railGroups.length).toBeGreaterThan(0);
    // Rail's first parent is the palette, not component tokens.
    expect(view!.railGroups[0][0]).toBe("Color");
    // The gallery opens on a color group too.
    expect(view!.visibleGroups.length).toBeGreaterThan(0);
    expect(view!.visibleGroups[0].group.kind).toBe("color");
    // Component (raw) groups come last.
    const last = view!.railGroups[view!.railGroups.length - 1];
    expect(last[0]).toBe("Other");
  });

  it("keeps stored order within one kind (stable sort)", async () => {
    await mount(perpUltraV2());
    const raw = JSON.parse(read("../../../systems/perp-ultra-v2.json")) as SystemJson;
    const storedColorIds = raw.groups.filter((g) => g.kind === "color").map((g) => g.id);
    const shownColorIds = view!.visibleGroups
      .filter((g) => g.group.kind === "color")
      .map((g) => g.group.id);
    expect(shownColorIds).toEqual(storedColorIds);
  });
});
