// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import SystemSwitcher from "./SystemSwitcher.tsx";
import { systemCoveragePercent, type DesignSystem, type TokenGroup, type Token } from "./store.ts";
import { REFERENCE } from "../../../src/core/schema.js";

// Issue #36: the switcher re-parsed every system's full CSS on every App
// re-render (each search keystroke), because `systemCoveragePercent(s)` ran
// per menu row + header. These tests mount the real switcher, count the
// coverage evaluations through SystemSwitcher's own import binding, and
// re-render with unchanged `systems` the way App does while typing. The
// memo must keep the count flat across those re-renders while the rendered
// percentages stay exactly right.

let root: Root | null = null;
let host: HTMLDivElement | null = null;

// ESM exports are live bindings only from the module side; a test cannot
// reassign another module's binding. Instead the mocked module wraps the
// real implementation once at import time, and the test counts through it.
vi.mock("./store.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./store.ts")>();
  return {
    ...actual,
    systemCoveragePercent: (system: DesignSystem | null | undefined) => {
      counters.calls++;
      return actual.systemCoveragePercent(system);
    },
  };
});

const counters = { calls: 0 };
const real = systemCoveragePercent;
const REFERENCE_NAMES: string[] = (REFERENCE as { tokens: string[] }[]).flatMap((g) => g.tokens);

function group(tokens: Token[]): TokenGroup {
  return { id: "color-accent", label: "Accent", kind: "color", tokens };
}

/** Real stored shape, built by hand so the test controls the CSS and skips
    the localStorage-touching boot path. Tokens are real reference names, so
    the expected pct is exact (present/expected of the schema). */
function system(slug: string, count: number): DesignSystem {
  const tokens: Token[] = REFERENCE_NAMES.slice(0, count).map((name) => ({ name, value: "#000" }));
  return {
    slug,
    name: `System ${slug}`,
    css: `:root {\n${tokens.map((t) => `${t.name}: ${t.value};`).join("\n")}\n}`,
    groups: [group(tokens)],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

async function render(systems: DesignSystem[], active: DesignSystem | null) {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  counters.calls = 0;
  await act(async () => {
    root!.render(
      <SystemSwitcher
        systems={systems}
        active={active}
        activeSlug={active?.slug ?? ""}
        onSelect={() => {}}
      />,
    );
  });
}

async function rerender(systems: DesignSystem[], active: DesignSystem | null) {
  await act(async () => {
    root!.render(
      <SystemSwitcher
        systems={systems}
        active={active}
        activeSlug={active?.slug ?? ""}
        onSelect={() => {}}
      />,
    );
  });
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  counters.calls = 0;
});

describe("SystemSwitcher coverage memo", () => {
  it("evaluates coverage once per system plus the active header on first render", async () => {
    const systems = [system("aurora", 22), system("chatgpt", 44)];
    await render(systems, systems[0]);
    expect(counters.calls).toBe(3); // two menu rows + the active header
  });

  it("does not re-evaluate coverage when re-rendered with the same list", async () => {
    const systems = [system("aurora", 22), system("chatgpt", 44)];
    await render(systems, systems[0]);
    expect(counters.calls).toBe(3);

    // App re-renders on every search keystroke with the same `systems`
    // prop; the switcher's memo must absorb those without re-parsing.
    counters.calls = 0;
    for (let i = 0; i < 5; i++) await rerender(systems, systems[0]);
    expect(counters.calls).toBe(0);
  });

  it("re-evaluates when the systems prop identity changes, keeping pcts correct", async () => {
    const first = system("aurora", 22);
    const second = system("chatgpt", 44);
    await render([first], first);
    expect(counters.calls).toBe(2); // one menu row + the active header

    // A mutation produces a new list identity; only then does coverage run.
    counters.calls = 0;
    await rerender([first, second], first);
    expect(counters.calls).toBe(2);
    expect(host!.querySelector(".app-topbar-cov")?.textContent).toBe("5%");
  });

  it("renders the header pct and every menu row pct from the memo", async () => {
    const systems = [system("aurora", 22), system("chatgpt", 44)];
    const expected = systems.map((s) => real(s));
    expect(expected).toEqual([5, 10]);
    await render(systems, systems[1]);

    // The trigger only shows the active system's badge; the menu rows carry
    // the rest through the same memoized map.
    expect(host!.querySelector(".app-topbar-cov")?.textContent).toBe("10%");
  });

  it("tracks a changed active even while the systems reference is stable", async () => {
    const systems = [system("aurora", 22), system("chatgpt", 44)];
    await render(systems, systems[1]);
    expect(host!.querySelector(".app-topbar-cov")?.textContent).toBe("10%");

    // `systems` keeps its identity, so `pctMap` is not rebuilt, while the
    // active object is replaced with a different CSS under the same slug. A
    // slug-keyed map would keep serving the stale 10%; the header must read
    // the `active` object it was given.
    counters.calls = 0;
    await rerender(systems, system("chatgpt", 22));
    expect(host!.querySelector(".app-topbar-cov")?.textContent).toBe("5%");
    expect(counters.calls).toBe(1); // only the active header re-evaluated
  });
});
