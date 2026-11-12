// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { RailGroup } from "./RailGroup.tsx";
import Rail from "./Rail.tsx";
import { CompareRail } from "../compare/CompareRail.tsx";
import { BASIC_OPTIONS } from "../compare/registry.tsx";
import type { OptionGroup } from "../compare/useCompareView.ts";
import type { CompareViewModel } from "../compare/useCompareView.ts";
import type { DesignSystem } from "../systems/store.ts";
import type { RailGroups } from "../lib/railTypes.ts";

// The shared rail group shell: label + chevron + count header both Rail and
// CompareRail hand-built before. It is presentational — collapse state and
// focus live in the callers — and hand-rolled (not Radix Accordion) so the
// rail can drive its own roving focus and swap the toggle for a static label.

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const railSrc = read("./Rail.tsx");
const compareRailSrc = read("../compare/CompareRail.tsx");
const railGroupSrc = read("./RailGroup.tsx");
const compareCss = read("../compare/compare.css");

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
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(node);
  });
  return host;
}

describe("shared rail group shell", () => {
  it("exists once in RailGroup and is imported by both rails", () => {
    expect(railGroupSrc).toContain("app-rail-group-label");
    expect(railGroupSrc).toContain("app-rail-group-chevron");
    expect(railGroupSrc).toContain("app-rail-count");
    expect(railSrc).toContain("RailGroup");
    expect(compareRailSrc).toContain("RailGroup");
    expect(railSrc).not.toContain('app-rail-group-label">');
    expect(compareRailSrc).not.toContain('app-rail-group-label">');
  });

  it("renders the label/chevron/count shell when open", async () => {
    const el = await renderInto(
      <RailGroup value="g" label="Basics" count={3} open onToggle={() => {}} contentClassName="app-rail-group-items">
        <span>body</span>
      </RailGroup>,
    );
    const trigger = el.querySelector(".app-rail-group-label");
    expect(trigger).toBeTruthy();
    expect(trigger!.getAttribute("aria-expanded")).toBe("true");
    expect(trigger!.querySelector(".app-rail-group-chevron")).toBeTruthy();
    expect(trigger!.querySelector(".app-rail-count")?.textContent).toBe("3");
    expect(trigger!.textContent).toContain("Basics");
    expect(el.querySelector(".app-rail-group-items")?.textContent).toContain("body");
  });

  it("renders a static label instead of a toggle while searching", async () => {
    const el = await renderInto(
      <RailGroup value="g" label="Basics" count={3} open staticLabel onToggle={() => {}}>
        <span>body</span>
      </RailGroup>,
    );
    expect(el.querySelector(".app-rail-group-label")).toBeNull();
    expect(el.querySelector(".app-rail-group-static")?.textContent).toContain("Basics");
  });

  it("both rails render their group headers through the shared shell", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const groups: RailGroups = [[
      "Basics",
      [
        { id: "alpha", label: "Alpha" },
        { id: "beta", label: "Beta" },
      ],
    ]];
    const railEl = await renderInto(
      <div className="app-rail-inner">
        <Rail groups={groups} />
      </div>,
    );
    expect(railEl.querySelector(".app-rail-group-label")).toBeTruthy();
    expect(railEl.querySelector(".app-rail-group-chevron")).toBeTruthy();
    expect(railEl.querySelector(".app-rail-count")?.textContent).toBe("2");
    act(() => root?.unmount());
    root = null;
    host?.remove();

    const optionGroups: OptionGroup[] = [{ label: "Basics", items: BASIC_OPTIONS }];
    const view = {
      picked: ["aurora"],
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
    const systems = [{ slug: "aurora", name: "Aurora", css: "" }] as unknown as DesignSystem[];
    const compareEl = await renderInto(<CompareRail systems={systems} view={view} />);
    const labels = [...compareEl.querySelectorAll(".app-rail-group-label")].map((l) => l.textContent ?? "");
    expect(labels.some((l) => l.includes("Systems"))).toBe(true);
    expect(labels.some((l) => l.includes("Basics"))).toBe(true);
    expect(compareEl.querySelector(".app-rail-group-chevron")).toBeTruthy();
    expect(compareEl.querySelector(".app-rail-count")).toBeTruthy();
  });

  it("never puts aria-disabled on a label; locked chips use data-disabled plus a native disabled checkbox", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const optionGroups: OptionGroup[] = [{ label: "Basics", items: BASIC_OPTIONS }];
    const view = {
      picked: ["aurora", "chatgpt"],
      toggle: () => {},
      mode: "component",
      setMode: () => {},
      componentId: "button",
      setComponentId: () => {},
      optionGroups,
      active: BASIC_OPTIONS[0],
      cols: [],
      styleFor: new Map(),
      maxColumns: 2,
    } as unknown as CompareViewModel;
    const systems = [
      { slug: "aurora", name: "Aurora", css: "" },
      { slug: "chatgpt", name: "ChatGPT", css: "" },
      { slug: "extra", name: "Extra", css: "" },
    ] as unknown as DesignSystem[];
    const el = await renderInto(<CompareRail systems={systems} view={view} />);
    expect(compareRailSrc).not.toContain("aria-disabled");
    expect(el.querySelector("label[aria-disabled]")).toBeNull();
    const locked = el.querySelector('label.cmp-chip[data-disabled="true"]');
    expect(locked).toBeTruthy();
    const box = locked!.querySelector('[role="checkbox"]');
    expect(box).toBeTruthy();
    expect(
      box!.hasAttribute("disabled") ||
        box!.getAttribute("data-disabled") !== null ||
        box!.getAttribute("aria-disabled") === "true",
    ).toBe(true);
    expect(compareCss).toContain('.cmp-chip[data-disabled="true"]');
    expect(compareCss).not.toContain('.cmp-chip[aria-disabled="true"]');
  });
});
