// Issue #328 RED: the whole app shipped as one ~1.06 MB chunk because every
// COMPONENT_ENTRIES Body was a static import, so the default Tokens tab pulled
// the Preview demo code (and all of Radix) before it was ever opened. Each Body
// must be a React.lazy component so its module lands in its own chunk.
//
// This fails on the parent commit: the Bodies are plain functions, so
// `$$typeof` is undefined, not the react.lazy sentinel.
import { describe, expect, it } from "vitest";
import { BODY_LOADERS, COMPONENT_ENTRIES } from "./index.ts";

const LAZY = Symbol.for("react.lazy");

describe("gallery bodies load lazily (issue #328)", () => {
  it("makes every entry Body a React.lazy component", () => {
    expect(COMPONENT_ENTRIES.length).toBeGreaterThan(0);
    for (const entry of COMPONENT_ENTRIES) {
      const marker = (entry.Body as { $$typeof?: symbol }).$$typeof;
      expect(marker, `${entry.id} Body is React.lazy`).toBe(LAZY);
    }
  });

  it("has exactly one loader per entry, keyed by entry id", () => {
    expect(Object.keys(BODY_LOADERS).sort()).toEqual(COMPONENT_ENTRIES.map((e) => e.id).sort());
    for (const load of Object.values(BODY_LOADERS)) expect(typeof load).toBe("function");
  });
});
