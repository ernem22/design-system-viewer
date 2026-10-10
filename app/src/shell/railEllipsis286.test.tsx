// @vitest-environment happy-dom
// Issue #286: long names break the rails — a system name wraps to 7 lines and
// token counts wrap alone. RED on the parent: a Tokens rail link's label bakes
// the count into the same text node ("Component / Button · 11"), and
// `.app-rail-link` has no ellipsis/nowrap rule, so names wrap instead of
// truncating to one line with the count in its own column.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import Rail from "./Rail.tsx";
import { CompareRail } from "../compare/CompareRail.tsx";
import { BASIC_OPTIONS } from "../compare/registry.tsx";
import type { CompareViewModel } from "../compare/useCompareView.ts";
import type { OptionGroup } from "../compare/useCompareView.ts";
import type { DesignSystem } from "../systems/store.ts";
import type { RailLink } from "../lib/railTypes.ts";
import { PreviewSystems } from "../preview/PreviewSystems.tsx";
import { useTokensView } from "../tokens/useTokensView.ts";
import type { TokensViewModel } from "../tokens/useTokensView.ts";

const LONG_NAME = "Northwind Industries Holdings — Enterprise Design Language v12";

// Stylesheet invariants are read from text (happy-dom has no layout engine),
// like shellContract.test.ts.
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const shellCss = stripComments(
  readFileSync(resolve(process.cwd(), "src/shell/shell.css"), "utf8"),
);
const compareCss = stripComments(
  readFileSync(resolve(process.cwd(), "src/compare/compare.css"), "utf8"),
);

function declarationsFor(css: string, selector: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m !== null; m = re.exec(css)) {
    if (m[1].split(",").map((s) => s.trim()).includes(selector)) bodies.push(m[2]);
  }
  return bodies;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  vi.unstubAllGlobals();
});

async function renderInto(node: React.ReactNode): Promise<HTMLElement> {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(node);
  });
  return host;
}

function demoSystem(): DesignSystem {
  return {
    slug: "perp-ultra-v2",
    name: "perp / ultra v2",
    css: ":root { --color-a: #111111; --color-b: #222222; }",
    groups: [
      {
        id: "button",
        label: "Component / Button",
        kind: "color",
        tokens: [
          { name: "--color-a", value: "#111111" },
          { name: "--color-b", value: "#222222" },
        ],
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as unknown as DesignSystem;
}

let tokensView: TokensViewModel | null = null;
function TokensHarness({ system }: { system: DesignSystem | null }) {
  tokensView = useTokensView(system, () => {});
  return null;
}

function compareView(): CompareViewModel {
  const optionGroups: OptionGroup[] = [{ label: "Basics", items: BASIC_OPTIONS }];
  return {
    picked: [],
    toggle: () => {},
    mode: "component",
    setMode: () => {},
    componentId: "button",
    setComponentId: () => {},
    optionGroups,
    active: BASIC_OPTIONS[0],
    cols: [],
    styleFor: new Map(),
    maxColumns: 4,
  } as unknown as CompareViewModel;
}

describe("rail long names stay on one line (issue #286)", () => {
  it("carries the Tokens count as data, not baked into the label string", async () => {
    await renderInto(<TokensHarness system={demoSystem()} />);
    const links = tokensView!.railGroups.flatMap(([, ls]) => ls);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      // RED on the parent: "Component / Button · 2" in one text node.
      expect(link.label).not.toContain("·");
      expect(link.count).toBeDefined();
    }
    expect(links[0].label).toBe("Component / Button");
    expect(String(links[0].count)).toBe("2");
  });

  it("clips rail names with an ellipsis instead of wrapping", () => {
    // The link row never wraps; the name truncates inside its own span.
    const link = declarationsFor(shellCss, ".app-rail-link").join("\n");
    expect(link).toMatch(/white-space:\s*nowrap/);
    const name = declarationsFor(shellCss, ".app-rail-label").join("\n");
    expect(name).toMatch(/white-space:\s*nowrap/);
    expect(name).toMatch(/overflow:\s*hidden/);
    expect(name).toMatch(/text-overflow:\s*ellipsis/);
  });

  it("keeps the rail count in its own tabular-nums column, never under the name", () => {
    const count = declarationsFor(shellCss, ".app-rail-item-count").join("\n");
    expect(count).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(count).toMatch(/white-space:\s*nowrap/);
    // New rail rules resolve sizes from viewer tokens — no literal sizes.
    for (const selector of [".app-rail-label", ".app-rail-item-count"]) {
      for (const body of declarationsFor(shellCss, selector)) {
        expect(body, selector).not.toMatch(/\d+px/);
      }
    }
  });

  it("renders a Rail link as one titled line with the count beside it", async () => {
    const link = { id: "alpha", label: LONG_NAME, count: 11 } as unknown as RailLink;
    const el = await renderInto(
      <div className="app-rail-inner">
        <Rail groups={[["Systems", [link]]]} />
      </div>,
    );
    const anchor = el.querySelector<HTMLAnchorElement>("a.app-rail-link");
    expect(anchor).toBeTruthy();
    // Full name stays available as accessible text.
    expect(anchor!.getAttribute("title")).toBe(LONG_NAME);
    expect(anchor!.querySelector(".app-rail-label")?.textContent).toBe(LONG_NAME);
    // Count rides in its own column, not inside the name's text node.
    expect(anchor!.querySelector(".app-rail-label")?.textContent).not.toContain("11");
    expect(anchor!.querySelector(".app-rail-item-count")?.textContent).toBe("11");
  });

  it("keeps Compare chips on one line with the % in its own column", async () => {
    const systems = [{ slug: "nw", name: LONG_NAME, css: "" }] as unknown as DesignSystem[];
    const el = await renderInto(<CompareRail systems={systems} view={compareView()} />);
    const chip = el.querySelector(".cmp-chip");
    expect(chip).toBeTruthy();
    expect(chip!.getAttribute("title")).toContain(LONG_NAME);
    expect(chip!.querySelector(".cmp-chip-name")?.textContent).toBe(LONG_NAME);
    // The % badge keeps tabular numbers and never wraps under the name.
    const pct = declarationsFor(compareCss, ".cmp-pct").join("\n");
    expect(pct).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(pct).toMatch(/white-space:\s*nowrap/);
    const name = declarationsFor(compareCss, ".cmp-chip-name").join("\n");
    expect(name).toMatch(/text-overflow:\s*ellipsis/);
    expect(name).toMatch(/white-space:\s*nowrap/);
  });

  it("titles Compare option buttons and Preview system rows with their full name", async () => {
    const systems = [{ slug: "nw", name: LONG_NAME, css: "" }] as unknown as DesignSystem[];
    const compareEl = await renderInto(<CompareRail systems={systems} view={compareView()} />);
    const option = compareEl.querySelector("button.app-rail-link");
    expect(option).toBeTruthy();
    expect(option!.getAttribute("title")).toBe(option!.querySelector(".app-rail-label")?.textContent);

    const previewEl = await renderInto(
      <PreviewSystems systems={systems} activeSlug="nw" onSelect={() => {}} />,
    );
    const row = previewEl.querySelector("button.app-rail-link");
    expect(row).toBeTruthy();
    expect(row!.getAttribute("title")).toBe(LONG_NAME);
    expect(row!.querySelector(".app-rail-label")?.textContent).toBe(LONG_NAME);
  });
});
