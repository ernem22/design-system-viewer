import { describe, expect, it } from "vitest";
import type { DesignSystem } from "../systems/store.ts";
import { tokenValueMap } from "./useTokensView.ts";

// Issue #37: Preview and Tokens must read token values from one place. These
// pin that place: `groups` first (what App applies to :root and the gallery
// renders), `css` only as the fallback — the legacy order from
// src/viewer/app.js:443.

const TOKEN = "--color-accent";

function system(partial: Partial<DesignSystem>): DesignSystem {
  return {
    slug: "demo",
    name: "Demo",
    css: "",
    groups: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("tokenValueMap", () => {
  it("prefers groups over css when the two diverge", () => {
    const sys = system({
      css: `:root { ${TOKEN}: #222222; }`,
      groups: [
        {
          id: "color-accent",
          label: "Accent / Brand",
          kind: "color",
          tokens: [{ name: TOKEN, value: "#111111" }],
        },
      ],
    });
    expect(tokenValueMap(sys).get(TOKEN)).toBe("#111111");
  });

  it("falls back to parsing css when there are no groups", () => {
    const sys = system({ css: `:root { ${TOKEN}: #222222; }`, groups: [] });
    expect(tokenValueMap(sys).get(TOKEN)).toBe("#222222");
  });

  it("still returns the authored value when both sources agree", () => {
    const sys = system({
      css: `:root { ${TOKEN}: #4f46e5; }`,
      groups: [
        {
          id: "color-accent",
          label: "Accent / Brand",
          kind: "color",
          tokens: [{ name: TOKEN, value: "#4f46e5" }],
        },
      ],
    });
    expect(tokenValueMap(sys).get(TOKEN)).toBe("#4f46e5");
  });

  it("does not mutate the system it reads", () => {
    const groups = [
      {
        id: "color-accent",
        label: "Accent / Brand",
        kind: "color" as const,
        tokens: [{ name: TOKEN, value: "#111111" }],
      },
    ];
    const sys = system({ css: `:root { ${TOKEN}: #222222; }`, groups });
    const before = JSON.stringify(sys);
    tokenValueMap(sys);
    expect(JSON.stringify(sys)).toBe(before);
    expect(tokenValueMap(sys).get(TOKEN)).toBe("#111111");
  });

  it("returns an empty map for a null system", () => {
    expect(tokenValueMap(null).size).toBe(0);
  });
});
