import { describe, expect, it } from "vitest";
import { tokensForEntry } from "./tokenUsage.ts";

describe("tokensForEntry", () => {
  it("resolves screen bodies by entry id, not by (minifiable) function name", () => {
    expect(tokensForEntry("screen-dashboard").length).toBeGreaterThan(0);
  });

  it("returns [] for an unknown entry", () => {
    expect(tokensForEntry("nope")).toEqual([]);
  });
});
