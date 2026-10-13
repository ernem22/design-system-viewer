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

function searchInput(el: HTMLElement): HTMLInputElement {
  const input =
    el.querySelector<HTMLInputElement>('input[aria-label="Search components"]') ??
    el.querySelector<HTMLInputElement>('input[type="search"]');
  if (!input) throw new Error("no search input in the compare rail");
  return input;
}

async function type(el: HTMLElement, value: string): Promise<void> {
  const input = searchInput(el);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const optionLabels = (el: HTMLElement): string[] =>
  [...el.querySelectorAll("button.app-rail-link")].map((b) => b.textContent ?? "");

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

describe("CompareRail component search", () => {
  it("renders a filter input in component mode only", async () => {
    const componentEl = await renderRail("component");
    expect(searchInput(componentEl)).toBeTruthy();

    act(() => root?.unmount());
    root = null;
    host?.remove();

    const diffEl = await renderRail("diff");
    expect(diffEl.querySelector('input[aria-label="Search components"]')).toBeNull();
  });

  it("filters the picker to matching options as the user types", async () => {
    const el = await renderRail();
    expect(optionLabels(el)).toContain("Input");

    await type(el, "button");
    expect(optionLabels(el)).toContain("Button");
    expect(optionLabels(el)).not.toContain("Input");
    expect(optionLabels(el)).not.toContain("Login screen");
  });

  it("matches options in every group, not just the first", async () => {
    const el = await renderRail();
    await type(el, "screen");
    expect(optionLabels(el)).toEqual(["Login screen"]);
  });

  it("keeps the system picker visible while filtering", async () => {
    const el = await renderRail();
    await type(el, "button");
    const chips = [...el.querySelectorAll(".cmp-chip")].map((c) => c.textContent ?? "");
    expect(chips).toHaveLength(2);
    expect(chips.some((c) => c.includes("Aurora"))).toBe(true);
    expect(chips.some((c) => c.includes("ChatGPT"))).toBe(true);
  });

  it("shows a no-match message and no option buttons when nothing matches", async () => {
    const el = await renderRail();
    await type(el, "zzzz");
    expect(optionLabels(el)).toEqual([]);
    expect(el.querySelector(".cmp-rail-empty")?.textContent).toContain("No components match");
  });

  it("collapses the Screens group by default, like the legacy rail", async () => {
    const el = await renderRail();
    expect(optionLabels(el)).toContain("Button");
    expect(optionLabels(el)).not.toContain("Login screen");
    const labels = [...el.querySelectorAll(".app-rail-group-label")].map((l) => l.textContent ?? "");
    expect(labels.some((l) => l.includes("Screens"))).toBe(true);
  });

  it("reveals every group while filtering, then restores the default collapse", async () => {
    const el = await renderRail();
    await type(el, "screen");
    expect(optionLabels(el)).toEqual(["Login screen"]);
    await type(el, "");
    expect(optionLabels(el)).toContain("Button");
    expect(optionLabels(el)).not.toContain("Login screen");
  });
});

// Issue #324: the Systems group listed all 38 systems in catalogue order
// with no finder, and the 4-system cap surfaced only as a tooltip. These
// mount the rail with a catalogue-sized list and drive the new field.
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

  function filterInput(el: HTMLElement): HTMLInputElement {
    const input = el.querySelector<HTMLInputElement>("#cmp-system-filter");
    if (!input) throw new Error("no Filter systems field in the compare rail");
    return input;
  }

  async function typeSystems(el: HTMLElement, value: string): Promise<void> {
    const input = filterInput(el);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  const chipNames = (el: HTMLElement): string[] =>
    [...el.querySelectorAll(".cmp-chip-name")].map((c) => c.textContent ?? "");

  it("renders a Filter systems field inside the Systems group", async () => {
    const el = await renderSystemsRail(["aurora", "chatgpt"]);
    expect(filterInput(el)).toBeTruthy();
    expect(el.querySelector('label[for="cmp-system-filter"]')?.textContent).toContain("Filter systems");
  });

  it("filters by name but keeps picked rows visible and first", async () => {
    const el = await renderSystemsRail(["aurora", "chatgpt"]);
    await typeSystems(el, "gemini");
    const names = chipNames(el);
    expect(names).toContain("Aurora");
    expect(names).toContain("ChatGPT");
    expect(names).toContain("Gemini New 1");
    expect(names).toContain("Gemini New 2");
    expect(names).toHaveLength(4);
    expect(names.slice(0, 2)).toEqual(["Aurora", "ChatGPT"]);
  });

  it("lists picked systems first in pick order without a filter", async () => {
    const el = await renderSystemsRail(["chatgpt", "aurora"]);
    expect(chipNames(el).slice(0, 2)).toEqual(["ChatGPT", "Aurora"]);
  });

  it("names the limit once four are picked", async () => {
    const two = await renderSystemsRail(["aurora", "chatgpt"]);
    expect(two.querySelector(".cmp-rail-hint")?.textContent).toContain("Pick 2–4 systems");
    expect(two.querySelector(".cmp-rail-hint")?.getAttribute("aria-live")).toBe("polite");

    act(() => root?.unmount());
    root = null;
    host?.remove();

    const four = await renderSystemsRail(["aurora", "chatgpt", "gemini-new-1", "gemini-new-2"]);
    expect(four.querySelector(".cmp-rail-hint")?.textContent).toContain("unpick one");
  });

  it("clears the filter on Escape", async () => {
    const el = await renderSystemsRail(["aurora", "chatgpt"]);
    await typeSystems(el, "gemini");
    expect(chipNames(el)).toHaveLength(4);
    await act(async () => {
      filterInput(el).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(chipNames(el)).toHaveLength(38);
  });
});
