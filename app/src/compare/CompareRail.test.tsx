// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { CompareRail } from "./CompareRail.tsx";
import { BASIC_OPTIONS } from "./registry.tsx";
import type { ComparableOption } from "./registry.tsx";
import type { OptionGroup } from "./useCompareView.ts";
import type { CompareViewModel } from "./useCompareView.ts";
import type { DesignSystem } from "../systems/store.ts";

// Issue #38: the Compare component picker rendered ~50 buttons across four
// accordion groups with no filter shot — 27 screens meant scrolling. These
// mount CompareRail exactly the way App does and drive its new search box.
// The rail was later restructured around the unified model: the mode switch
// lives here, the selected systems are an always-visible summary, the
// catalogue stays in stable order, and the component picker is a radio list.

let root: Root | null = null;
let host: HTMLDivElement | null = null;

const screenOption: ComparableOption = { id: "gallery-screen-login", label: "Login screen", Render: () => null };

function makeView(mode: "component" | "diff"): CompareViewModel {
  const optionGroups: OptionGroup[] = [
    { label: "Basics", items: BASIC_OPTIONS },
    { label: "Screens", items: [screenOption] },
  ];
  return {
    picked: ["aurora", "chatgpt"],
    toggle: () => {},
    mode,
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

const systems = [
  { slug: "aurora", name: "Aurora", css: "" },
  { slug: "chatgpt", name: "ChatGPT", css: "" },
] as unknown as DesignSystem[];

async function renderRail(mode: "component" | "diff" = "component"): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<CompareRail systems={systems} view={makeView(mode)} />);
  });
  return host;
}

function componentFilter(el: HTMLElement): HTMLInputElement {
  const input = el.querySelector<HTMLInputElement>('input[aria-label="Filter components"]');
  if (!input) throw new Error("no Filter components field in the compare rail");
  return input;
}

function systemFilter(el: HTMLElement): HTMLInputElement {
  const input = el.querySelector<HTMLInputElement>('input[aria-label="Filter systems"]');
  if (!input) throw new Error("no Filter systems field in the compare rail");
  return input;
}

async function type(el: HTMLElement, value: string): Promise<void> {
  const input = componentFilter(el);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const radioLabels = (el: HTMLElement): string[] =>
  [...el.querySelectorAll(".cmp-radio-row")].map((b) => b.textContent ?? "");

const catalogueNames = (el: HTMLElement): string[] =>
  [...el.querySelectorAll(".cmp-rail-systems .cmp-chip-name")].map((c) => c.textContent ?? "");

const selectedNames = (el: HTMLElement): string[] =>
  [...el.querySelectorAll(".cmp-rail-selected .cmp-chip-name")].map((c) => c.textContent ?? "");

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  vi.unstubAllGlobals();
});

beforeEach(() => {
  // React's act() refuses to flush unless this is set; Radix Accordion's
  // controlled-state updates surface the warning otherwise.
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

describe("CompareRail mode + filters", () => {
  it("puts the mode switch in the rail and keeps both filters in both modes", async () => {
    const componentEl = await renderRail("component");
    expect(componentEl.querySelector(".cmp-rail-mode")?.textContent).toContain("Component");
    expect(componentEl.querySelector(".cmp-rail-mode")?.textContent).toContain("Token diff");
    expect(componentFilter(componentEl).disabled).toBe(false);
    expect(systemFilter(componentEl)).toBeTruthy();

    act(() => root?.unmount());
    root = null;
    host?.remove();

    const diffEl = await renderRail("diff");
    expect(diffEl.querySelector(".cmp-rail-mode")?.textContent).toContain("Token diff");
    // The picker does not vanish in diff mode: it is visible, disabled, and
    // explains why.
    expect(componentFilter(diffEl).disabled).toBe(true);
    expect(diffEl.querySelector(".cmp-rail-reason")?.textContent).toContain("Token diff");
    expect(radioLabels(diffEl)).not.toHaveLength(0);
  });
});

describe("CompareRail component search", () => {
  it("filters the picker to matching options as the user types", async () => {
    const el = await renderRail();
    expect(radioLabels(el)).toContain("Input");

    await type(el, "button");
    expect(radioLabels(el)).toContain("Button");
    expect(radioLabels(el)).not.toContain("Input");
    expect(radioLabels(el)).not.toContain("Login screen");
  });

  it("matches options in every group, not just the first", async () => {
    const el = await renderRail();
    await type(el, "screen");
    expect(radioLabels(el)).toEqual(["Login screen"]);
  });

  it("keeps the system picker visible while filtering", async () => {
    const el = await renderRail();
    await type(el, "button");
    expect(selectedNames(el)).toEqual(["Aurora", "ChatGPT"]);
    expect(catalogueNames(el)).toEqual(["Aurora", "ChatGPT"]);
  });

  it("shows a no-match message and no option rows when nothing matches", async () => {
    const el = await renderRail();
    await type(el, "zzzz");
    expect(radioLabels(el)).toEqual([]);
    expect(el.querySelector(".cmp-rail-empty")?.textContent).toContain("No components match");
  });

  it("collapses the Screens group by default, like the legacy rail", async () => {
    const el = await renderRail();
    expect(radioLabels(el)).toContain("Button");
    expect(radioLabels(el)).not.toContain("Login screen");
    const labels = [...el.querySelectorAll(".app-rail-group-label")].map((l) => l.textContent ?? "");
    expect(labels.some((l) => l.includes("Screens"))).toBe(true);
  });

  it("reveals every group while filtering, then restores the default collapse", async () => {
    const el = await renderRail();
    await type(el, "screen");
    expect(radioLabels(el)).toEqual(["Login screen"]);
    await type(el, "");
    expect(radioLabels(el)).toContain("Button");
    expect(radioLabels(el)).not.toContain("Login screen");
  });
});

// Issue #324: the Systems group listed all 38 systems in catalogue order
// with no finder, and the 4-system cap surfaced only as a tooltip. These
// mount the rail with a catalogue-sized list and drive the filter.
describe("CompareRail systems filter", () => {
  const catalogue = [
    { slug: "aurora", name: "Aurora", css: "" },
    { slug: "chatgpt", name: "ChatGPT", css: "" },
    { slug: "gemini-new-1", name: "Gemini New 1", css: "" },
    { slug: "gemini-new-2", name: "Gemini New 2", css: "" },
    ...Array.from({ length: 34 }, (_, i) => ({
      slug: `sys-${String(i + 5).padStart(2, "0")}`,
      name: `System ${String(i + 5).padStart(2, "0")}`,
      css: "",
    })),
  ] as unknown as DesignSystem[];

  async function renderSystemsRail(picked: string[]): Promise<HTMLDivElement> {
    const { createRoot } = await import("react-dom/client");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const view = { ...makeView("component"), picked };
    await act(async () => {
      root!.render(<CompareRail systems={catalogue} view={view} />);
    });
    return host;
  }

  async function typeSystems(el: HTMLElement, value: string): Promise<void> {
    const input = systemFilter(el);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("renders a Filter systems field inside the catalogue group", async () => {
    const el = await renderSystemsRail(["aurora", "chatgpt"]);
    const input = systemFilter(el);
    expect(input).toBeTruthy();
    const label = [...el.querySelectorAll("label")].find((l) => l.textContent?.trim() === "Filter systems");
    expect(label?.getAttribute("for")).toBe(input.id);
    expect(input.id).toBeTruthy();
  });

  it("filters the catalogue by name without touching the selected summary", async () => {
    const el = await renderSystemsRail(["aurora", "chatgpt"]);
    await typeSystems(el, "gemini");
    expect(selectedNames(el)).toEqual(["Aurora", "ChatGPT"]);
    expect(catalogueNames(el)).toEqual(["Gemini New 1", "Gemini New 2"]);
  });

  it("keeps catalogue order stable even when the pick order is reversed", async () => {
    const el = await renderSystemsRail(["chatgpt", "aurora"]);
    // The selected summary follows pick order (first = reference) ...
    expect(selectedNames(el)).toEqual(["ChatGPT", "Aurora"]);
    // ... but the catalogue never reorders under the pointer.
    expect(catalogueNames(el).slice(0, 4)).toEqual([
      "Aurora",
      "ChatGPT",
      "Gemini New 1",
      "Gemini New 2",
    ]);
  });

  it("names the limit once four are picked", async () => {
    const two = await renderSystemsRail(["aurora", "chatgpt"]);
    expect(two.querySelector(".cmp-rail-selected .cmp-rail-hint")?.textContent).toContain(
      "Select 2–4 systems",
    );
    expect(two.querySelector(".cmp-rail-selected .cmp-rail-hint")?.getAttribute("aria-live")).toBe(
      "polite",
    );

    act(() => root?.unmount());
    root = null;
    host?.remove();

    const four = await renderSystemsRail(["aurora", "chatgpt", "gemini-new-1", "gemini-new-2"]);
    expect(four.querySelector(".cmp-rail-selected .cmp-rail-hint")?.textContent).toContain(
      "deselect one",
    );
  });

  it("clears the filter on Escape", async () => {
    const el = await renderSystemsRail(["aurora", "chatgpt"]);
    await typeSystems(el, "gemini");
    expect(catalogueNames(el)).toHaveLength(2);
    await act(async () => {
      systemFilter(el).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(catalogueNames(el)).toHaveLength(38);
  });
});

// Issue #325: the rail showed a "100%" pill on every complete system (38
// identical pills in the bundle). Only an incomplete system keeps a badge —
// a warning titled with the schema size. The summary chips carry no coverage
// badge, so the pill appears once per system (in the catalogue).
describe("CompareRail coverage badge below 100% only (#325)", () => {
  /** Real-css systems so `systemCoveragePercent` is exact: full vs 32%. */
  async function renderCoverageRail(): Promise<HTMLDivElement> {
    const { REFERENCE } = await import("../../../src/core/schema.js");
    const names: string[] = (REFERENCE as { tokens: string[] }[]).flatMap((g) => g.tokens);
    const cssFor = (count: number) =>
      `:root {\n${names.slice(0, count).map((n) => `${n}: #000;`).join("\n")}\n}`;
    const coverageSystems = [
      { slug: "perp-ultra-v2", name: "Perp Ultra v2", css: cssFor(names.length) },
      { slug: "figma", name: "Figma", css: cssFor(138) },
    ] as unknown as DesignSystem[];
    const { createRoot } = await import("react-dom/client");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const view = { ...makeView("diff"), picked: ["perp-ultra-v2", "figma"] };
    await act(async () => {
      root!.render(<CompareRail systems={coverageSystems} view={view} />);
    });
    return host;
  }

  it("shows a titled 32% pill only on the incomplete system", async () => {
    const el = await renderCoverageRail();
    expect(el.textContent).not.toContain("100%");
    const pills = [...el.querySelectorAll(".cmp-pct")];
    expect(pills).toHaveLength(1);
    expect(pills[0].textContent).toBe("32%");
    expect(pills[0].getAttribute("title")).toContain("432");
    // The pill sits on the figma catalogue row, not on the complete row.
    const figmaRow = [...el.querySelectorAll(".cmp-rail-systems .cmp-chip")].find((c) =>
      c.textContent?.includes("Figma"),
    )!;
    expect(figmaRow.querySelector(".cmp-pct")?.textContent).toBe("32%");
    const fullRow = [...el.querySelectorAll(".cmp-rail-systems .cmp-chip")].find((c) =>
      c.textContent?.includes("Perp Ultra v2"),
    )!;
    expect(fullRow.querySelector(".cmp-pct")).toBeNull();
  });
});
