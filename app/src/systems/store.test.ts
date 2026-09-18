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
  coverageFingerprint,
  coveragePercent,
  PCT_CACHE_MAX,
  systemCoveragePercent,
  type DesignSystem,
} from "./store.ts";

// Issue #36: `pctCache` keyed the whole CSS string and `clear()`ed all 200
// warm entries on one overflow. These tests pin the two replacements:
// (1) a bounded LRU that evicts only the coldest key, and (2) a keyed
// fingerprint so a cache hit never hashes tens of KB. Because the tests run
// in-process with the shared module cache, ordering is deterministic.

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

describe("coverageFingerprint", () => {
  it("changes when the head of a same-length CSS changes", () => {
    const a = `${"x".repeat(100)}AAA`;
    const b = `${"x".repeat(100)}AAB`;
    expect(a.length).toBe(b.length);
    expect(coverageFingerprint(a)).not.toBe(coverageFingerprint(b));
  });

  it("changes when only the tail of a same-length CSS changes", () => {
    const a = `AAA${"x".repeat(100)}`;
    const b = `AAB${"x".repeat(100)}`;
    expect(a.length).toBe(b.length);
    expect(coverageFingerprint(a)).not.toBe(coverageFingerprint(b));
  });

  it("is stable for identical text", () => {
    expect(coverageFingerprint(":root { --a: 1; }")).toBe(coverageFingerprint(":root { --a: 1; }"));
  });
});

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
