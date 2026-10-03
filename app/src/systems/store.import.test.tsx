// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { nextFreeSlug, useSystems, type DesignSystem, type SourceProvenance } from "./store.ts";

// Issue #125: the import's write modes and slug-collision resolution, and the
// additive `source` provenance. These pin the store half: a colliding add
// renames instead of throwing, a write carries its source, replace keeps the
// slug, and `source` survives a reload (including the ensureGroups rebuild
// path, which predates the field).

const SOURCE: SourceProvenance = {
  kind: "file",
  filename: "aurora.css",
  importedAt: "2026-09-30T00:00:00.000Z",
};

const BASE: DesignSystem = {
  slug: "aurora",
  name: "Aurora",
  css: "--color-bg: #ffffff;",
  groups: [{ id: "color", label: "Color", kind: "color", tokens: [{ name: "--color-bg", value: "#ffffff" }] }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let current: ReturnType<typeof useSystems> | null = null;

function Harness() {
  current = useSystems();
  return null;
}

async function mount(list?: DesignSystem[]): Promise<void> {
  if (list) localStorage.setItem("dsv.app.systems", JSON.stringify(list));
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Harness />);
  });
}

async function remount(): Promise<void> {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  current = null;
  await mount();
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // The stored list is authoritative, so the bundled fetch must not run.
  vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  current = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("addSystem collision + provenance", () => {
  it("attaches the source and resolves a slug collision by renaming, never throwing", async () => {
    await mount([BASE]);
    let created!: DesignSystem;
    await act(async () => {
      created = current!.addSystem("Aurora", "--color-text: #000000;", SOURCE);
    });

    expect(created.slug).toBe("aurora-2");
    expect(created.source).toEqual(SOURCE);
    expect(current!.systems.map((s) => s.slug)).toEqual(["aurora", "aurora-2"]);
    const stored = JSON.parse(localStorage.getItem("dsv.app.systems")!) as DesignSystem[];
    expect(stored[1].source).toEqual(SOURCE);
  });

  it("skips past an already-taken -2 suffix", async () => {
    await mount([BASE, { ...BASE, slug: "aurora-2", name: "Aurora 2" }]);
    let created!: DesignSystem;
    await act(async () => {
      created = current!.addSystem("Aurora", "--color-text: #000000;");
    });
    expect(created.slug).toBe("aurora-3");
  });
});

describe("mergeCss provenance", () => {
  it("records the import source on the merged system", async () => {
    await mount([BASE]);
    let merged!: DesignSystem;
    await act(async () => {
      merged = current!.mergeCss("aurora", "--color-accent: #ff0000;", SOURCE);
    });
    expect(merged.source).toEqual(SOURCE);
    expect(current!.systems[0].source).toEqual(SOURCE);
    expect(current!.systems[0].css).toContain("--color-accent: #ff0000;");
  });
});

describe("replaceSystem", () => {
  it("keeps the slug and createdAt, and swaps in the new tokens", async () => {
    await mount([BASE]);
    let replaced!: DesignSystem;
    await act(async () => {
      replaced = current!.replaceSystem("aurora", "Aurora", "--color-bg: #000000;", SOURCE);
    });
    expect(replaced.slug).toBe("aurora");
    expect(replaced.createdAt).toBe(BASE.createdAt);
    expect(replaced.updatedAt).not.toBe(BASE.updatedAt);
    expect(replaced.source).toEqual(SOURCE);
    expect(replaced.css).toContain("--color-bg: #000000;");
    expect(replaced.css).not.toContain("#ffffff");
    expect(current!.systems).toHaveLength(1);
  });
});

describe("source survives a reload", () => {
  it("keeps source when stored groups are valid", async () => {
    await mount([{ ...BASE, source: SOURCE }]);
    expect(current!.systems[0].source).toEqual(SOURCE);
  });

  it("keeps source through the ensureGroups rebuild path", async () => {
    // Empty groups force ensureGroups to recategorize from CSS; the spread
    // that rebuilds the system must not drop the new field.
    await mount([{ ...BASE, groups: [], source: SOURCE }]);
    expect(current!.systems[0].source).toEqual(SOURCE);
    expect(current!.systems[0].groups.length).toBeGreaterThan(0);
  });

  it("writes source, then reads it back after a reload", async () => {
    await mount([BASE]);
    await act(async () => {
      current!.addSystem("Aurora", "--color-text: #000000;", SOURCE);
    });
    await remount();
    const added = current!.systems.find((s) => s.slug === "aurora-2")!;
    expect(added.source).toEqual(SOURCE);
  });
});

describe("nextFreeSlug", () => {
  it("returns the base when free, then -2, -3… when taken", () => {
    expect(nextFreeSlug("aurora", [])).toBe("aurora");
    expect(nextFreeSlug("aurora", ["aurora"])).toBe("aurora-2");
    expect(nextFreeSlug("aurora", ["aurora", "aurora-2"])).toBe("aurora-3");
  });
});
