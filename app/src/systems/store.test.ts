// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

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
