// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";

// Count actual parses so a cache *hit* is distinguishable from a mere
// correctness match: an LRU that keeps a warm entry never re-parses it.
const parseSpy = { calls: 0 };
vi.mock("../../../src/core/parse.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/core/parse.js")>();
  return {
    ...actual,
    parseTokens: (css: string) => {
      parseSpy.calls++;
      return actual.parseTokens(css);
    },
  };
});

import { coverage, REFERENCE } from "../../../src/core/schema.js";
import {
  coveragePercent,
  PCT_CACHE_MAX,
  systemCoveragePercent,
  useSystems,
  type DesignSystem,
} from "./store.ts";

// Issue #36: `pctCache` `clear()`ed all 200 warm entries on one overflow.
// These tests pin the replacement: a bounded LRU that evicts only the coldest
// key, keyed by slug + the whole CSS so a cache hit is never a stale one.
// Because the tests run in-process with the shared module cache, ordering is
// deterministic.

const REFERENCE_NAMES: string[] = (REFERENCE as { tokens: string[] }[]).flatMap((g) => g.tokens);

function css(names: string[]): string {
  return `:root {\n${names.map((n) => `${n}: #000;`).join("\n")}\n}`;
}

/** First N real reference tokens — pct lands on an exact, non-zero value. */
function system(slug: string, count: number): DesignSystem {
  const names = REFERENCE_NAMES.slice(0, count);
  return {
    slug,
    name: slug,
    css: css(names),
    groups: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/** Independent oracle — never through the cache under test. */
function expectedPct(sys: DesignSystem): number {
  const names = sys.css
    .split("\n")
    .map((line) => /^(--[A-Za-z0-9_-]+)\s*:/.exec(line)?.[1])
    .filter((n): n is string => !!n);
  return coveragePercent(coverage(names) as DesignSystem["coverage"]) as number;
}

describe("systemCoveragePercent correctness", () => {
  it("computes the exact schema percentage", () => {
    const sys = system("aurora", 22);
    expect(systemCoveragePercent(sys)).toBe(expectedPct(sys));
    expect(systemCoveragePercent(sys)).toBe(5);
  });

  it("stays correct after a mutation that keeps slug but changes CSS", () => {
    const before = system("chatgpt", 22);
    const after = system("chatgpt", 44);
    const p1 = systemCoveragePercent(before);
    const p2 = systemCoveragePercent(after);
    expect(p1).toBe(expectedPct(before));
    expect(p2).toBe(expectedPct(after));
    expect(p1).toBe(5);
    expect(p2).toBe(10);
  });

  it("does not serve a stale pct after a same-length edit in the middle", () => {
    // 89 reference tokens rounds to 21%; dropping one lands on 20%. The
    // renamed token sits far from both ends, so a length/head/tail key cannot
    // tell `before` from `after` and would serve the stale 21%.
    const names = REFERENCE_NAMES.slice(0, 89);
    const mid = Math.floor(names.length / 2);
    const last = names[mid].slice(-1);
    const renamed = `${names[mid].slice(0, -1)}${last === "q" ? "z" : "q"}`;
    const edited = names.slice();
    edited[mid] = renamed;

    const before = system("middle-edit", 89);
    const after: DesignSystem = { ...before, css: css(edited) };
    expect(after.css.length).toBe(before.css.length);
    const at = after.css.indexOf(renamed);
    expect(at).toBeGreaterThan(64);
    expect(at).toBeLessThan(after.css.length - 64);

    const p1 = systemCoveragePercent(before);
    expect(p1).toBe(21);
    expect(systemCoveragePercent(after)).toBe(expectedPct(after));
    expect(systemCoveragePercent(after)).toBe(20);
  });

  it("does not confuse two systems with identical CSS", () => {
    // Same CSS, different slugs: each must resolve to its own (equal) value
    // from an independent key, not a shared unprefixed entry.
    const a = system("alpha", 22);
    const b = system("beta", 22);
    expect(systemCoveragePercent(a)).toBe(expectedPct(a));
    expect(systemCoveragePercent(b)).toBe(expectedPct(b));
  });

  it("returns null for null/undefined systems", () => {
    expect(systemCoveragePercent(null)).toBeNull();
    expect(systemCoveragePercent(undefined)).toBeNull();
  });
});

describe("pctCache bounded LRU", () => {
  it("serves a warm entry without re-parsing", () => {
    const sys = system("aurora-hit", 22);
    parseSpy.calls = 0;
    systemCoveragePercent(sys);
    expect(parseSpy.calls).toBe(1);
    systemCoveragePercent(sys);
    expect(parseSpy.calls).toBe(1); // hit — no second parse
  });

  it("evicts the coldest key on overflow, not the whole cache", () => {
    const cold = system("cold-victim", 22);
    const warm = system("warm-survivor", 22);
    parseSpy.calls = 0;
    systemCoveragePercent(cold); // inserted first — oldest
    systemCoveragePercent(warm);
    expect(parseSpy.calls).toBe(2);

    // Build up to the cap, then re-touch `warm` so it is the most recent.
    for (let i = 0; i < PCT_CACHE_MAX - 2; i++) systemCoveragePercent(system(`filler-${i}`, 22));
    systemCoveragePercent(warm); // hit — refreshes recency

    // One more insert overflows and must evict exactly one key: the coldest,
    // `cold`. A clear()-all cache would drop `warm` too.
    systemCoveragePercent(system("overflow", 22));
    const after = parseSpy.calls;

    // `warm` survives: no re-parse.
    expect(systemCoveragePercent(warm)).toBe(5);
    expect(parseSpy.calls).toBe(after);
    // `cold` was evicted: its next lookup re-parses.
    expect(systemCoveragePercent(cold)).toBe(5);
    expect(parseSpy.calls).toBe(after + 1);
  });
});

// Issue #121: a failed index load left the viewer on fallback tokens with no
// in-product recovery. `retry` re-runs the *same* boot load (fetchBundled) —
// not a page reload — and re-settles the load states in place.
describe("useSystems retry", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  let current: ReturnType<typeof useSystems> | null = null;

  function Harness() {
    current = useSystems();
    return null;
  }

  async function mount(): Promise<void> {
    const { createRoot } = await import("react-dom/client");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(createElement(Harness));
    });
    // The fetch resolves on a microtask after the effect runs; flush it.
    await act(async () => {});
  }

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
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

  it("re-attempts the load on retry and clears the failure on success", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              slug: "recovered",
              name: "Recovered",
              css: "",
              groups: [],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    await mount();
    expect(current!.error).toBe("Failed to fetch");
    expect(current!.systems).toHaveLength(1); // seed fallback

    await act(async () => {
      current!.retry();
    });
    await act(async () => {});

    // Same path, second attempt: the loaded list replaces the fallback.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(current!.error).toBeNull();
    expect(current!.systems.map((s) => s.slug)).toEqual(["recovered"]);
    expect(current!.loading).toBe(false);
  });

  it("keeps the failure and the fallback when the retry fails again, without a loading flash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await mount();
    expect(current!.error).toBe("Failed to fetch");

    await act(async () => {
      current!.retry();
    });
    await act(async () => {});

    // The notice stays put: the reason is unchanged and `loading` never flips
    // back, so the alert element is not unmounted and re-announced.
    expect(current!.error).toBe("Failed to fetch");
    expect(current!.loading).toBe(false);
    expect(current!.systems).toHaveLength(1);
  });
});

// Issue #313: Export/Delete moved to the system menu beside the switcher,
// and rename/duplicate became possible. renameSystem changes the name only
// (the slug is unchanged, so links keep working); duplicateSystem copies
// through the addSystem path ("<name> copy", a free slug, made active).
// Both persist through the same localStorage path as the other mutations.
describe("useSystems rename + duplicate", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  let current: ReturnType<typeof useSystems> | null = null;

  const SEED: DesignSystem[] = [
    {
      slug: "perp-ultra-v2",
      name: "Perp Ultra v2",
      css: ":root { --color-bg: #000; }",
      groups: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      slug: "aurora",
      name: "Aurora",
      css: ":root { --color-bg: #fff; }",
      groups: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  function Harness() {
    current = useSystems();
    return null;
  }

  async function mountSeeded(): Promise<void> {
    localStorage.setItem("dsv.app.systems", JSON.stringify(SEED));
    const { createRoot } = await import("react-dom/client");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(createElement(Harness));
    });
    await act(async () => {});
  }

  function stored(): DesignSystem[] {
    return JSON.parse(localStorage.getItem("dsv.app.systems") as string) as DesignSystem[];
  }

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
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

  it("renames in place: the name changes, the slug is unchanged, the list persists", async () => {
    await mountSeeded();
    let renamed: DesignSystem | null = null;
    await act(async () => {
      renamed = current!.renameSystem("perp-ultra-v2", "Perp X");
    });
    await act(async () => {});

    expect(renamed!.slug, "slug unchanged so links keep working").toBe("perp-ultra-v2");
    expect(renamed!.name).toBe("Perp X");
    expect(current!.systems.find((s) => s.slug === "perp-ultra-v2")!.name).toBe("Perp X");
    expect(current!.systems.find((s) => s.slug === "aurora")!.name).toBe("Aurora");
    expect(stored().find((s) => s.slug === "perp-ultra-v2")!.name).toBe("Perp X");
  });

  it("ignores a blank rename", async () => {
    await mountSeeded();
    await act(async () => {
      current!.renameSystem("perp-ultra-v2", "   ");
    });
    await act(async () => {});

    expect(current!.systems.find((s) => s.slug === "perp-ultra-v2")!.name).toBe("Perp Ultra v2");
    expect(stored().find((s) => s.slug === "perp-ultra-v2")!.name).toBe("Perp Ultra v2");
  });

  it("duplicates as '<name> copy' with the same CSS, a free slug, made active", async () => {
    await mountSeeded();
    let dup: DesignSystem | null = null;
    await act(async () => {
      dup = current!.duplicateSystem("perp-ultra-v2");
    });
    await act(async () => {});

    expect(dup!.name).toBe("Perp Ultra v2 copy");
    expect(dup!.slug).toBe("perp-ultra-v2-copy");
    expect(dup!.css).toBe(":root { --color-bg: #000; }");
    expect(current!.activeSlug, "the copy becomes active").toBe(dup!.slug);
    expect(stored().map((s) => s.slug)).toContain("perp-ultra-v2-copy");

    // A second duplicate of the same source picks the next free slug.
    let dup2: DesignSystem | null = null;
    await act(async () => {
      dup2 = current!.duplicateSystem("perp-ultra-v2");
    });
    await act(async () => {});
    expect(dup2!.slug).toBe("perp-ultra-v2-copy-2");
    expect(current!.activeSlug).toBe("perp-ultra-v2-copy-2");
  });

  it("throws for unknown slugs", async () => {
    await mountSeeded();
    expect(() => current!.renameSystem("missing", "X")).toThrow("system to rename not found");
    expect(() => current!.duplicateSystem("missing")).toThrow("system to duplicate not found");
  });
});
