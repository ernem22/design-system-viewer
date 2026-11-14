// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import type { DesignSystem } from "../systems/store.ts";
import { tokenValueMap, useTokensView } from "./useTokensView.ts";
import type { TokensViewModel } from "./useTokensView.ts";

// Issue #37: Preview and Tokens must read token values from one place. These
// pin that place and its merge order: `css` first, then `groups` per token
// (groups win — what App applies to `:root` and the gallery renders).
// Dark mode is retired (#277): a stored `themes.dark` block is never read.

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

  it("keeps a token authored only in css when groups exist", () => {
    const sys = system({
      css: `:root { ${TOKEN}: #222222; --new: #333333; }`,
      groups: [
        {
          id: "color-accent",
          label: "Accent / Brand",
          kind: "color",
          tokens: [{ name: TOKEN, value: "#111111" }],
        },
      ],
    });
    const map = tokenValueMap(sys);
    // groups still wins for the token both sources author…
    expect(map.get(TOKEN)).toBe("#111111");
    // …while the css-only token is not dropped.
    expect(map.get("--new")).toBe("#333333");
  });

  it("ignores a stored themes.dark block (#277)", () => {
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
      themes: { dark: [{ name: TOKEN, value: "#000000" }] },
    });
    expect(tokenValueMap(sys).get(TOKEN)).toBe("#111111");
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

// Issue #278: a copied Tokens link carries ?f= (filter) and ?tv=schema
// (schema mode). The hook seeds both from the URL on load; on the parent
// commit both initialisers were constants, so the filter mounted empty and
// the view never opened in schema mode.

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

async function rerender(system: DesignSystem | null): Promise<void> {
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

function demoSystem(slug = "demo"): DesignSystem {
  return {
    ...system({ css: `:root { ${TOKEN}: #222222; --color-bg: #ffffff; }` }),
    slug,
    name: slug,
  };
}

describe("useTokensView shareable state (#278)", () => {
  it("seeds the filter and schema mode from ?f= and ?tv=", async () => {
    window.history.replaceState({}, "", "/?f=color&tv=schema");
    await mount(demoSystem());
    expect(view!.filter).toBe("color");
    expect(view!.searching).toBe(true);
    expect(view!.schemaMode).toBe(true);
  });

  it("falls back to an empty filter and gallery mode by default", async () => {
    await mount(demoSystem());
    expect(view!.filter).toBe("");
    expect(view!.schemaMode).toBe(false);
  });

  it("falls back to gallery mode for an unknown tv value", async () => {
    window.history.replaceState({}, "", "/?tv=bogus");
    await mount(demoSystem());
    expect(view!.schemaMode).toBe(false);
  });

  it("keeps the seeded state across the async first-system arrival", async () => {
    window.history.replaceState({}, "", "/?f=color&tv=schema");
    await mount(null);
    expect(view!.filter).toBe("color");
    await rerender(demoSystem());
    expect(view!.filter).toBe("color");
    expect(view!.schemaMode).toBe(true);
  });

  it("still resets the view when switching between loaded systems", async () => {
    await mount(demoSystem("aurora"));
    await act(async () => {
      view!.setFilter("color");
      view!.setSchemaMode(true);
    });
    expect(view!.filter).toBe("color");
    await rerender(demoSystem("carbon"));
    expect(view!.filter).toBe("");
    expect(view!.schemaMode).toBe(false);
  });
});
