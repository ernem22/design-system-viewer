// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import * as Accordion from "@radix-ui/react-accordion";
import { RailGroup } from "./RailGroup.tsx";
import Rail from "./Rail.tsx";
import { CompareRail } from "../compare/CompareRail.tsx";
import { BASIC_OPTIONS } from "../compare/registry.tsx";
import type { OptionGroup } from "../compare/useCompareView.ts";
import type { CompareViewModel } from "../compare/useCompareView.ts";
import type { DesignSystem } from "../systems/store.ts";
import type { RailGroups } from "../lib/railTypes.ts";

// Issue #17: Rail and CompareRail hand-built the same Accordion group shell
// (label + chevron + count). Both now compose this shared RailGroup, and
// CompareRail's system chips no longer put aria-disabled on a <label>.
// Importing RailGroup here is itself the RED guard: on the parent commit the
// module does not exist, so this file fails before the change and passes after.

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

describe("issue #17 shared rail group shell", () => {
  it("exists once in RailGroup and is imported by both rails", () => {
    // The shell markup lives in exactly one place.
    expect(railGroupSrc).toContain("app-rail-group-label");
    expect(railGroupSrc).toContain("app-rail-group-chevron");
    expect(railGroupSrc).toContain("app-rail-count");
    // Both rails compose it instead of hand-building Accordion.Item shells.
    expect(railSrc).toContain("RailGroup");
    expect(compareRailSrc).toContain("RailGroup");
    expect(railSrc).not.toContain("app-rail-group-label\">");
    expect(compareRailSrc).not.toContain("app-rail-group-label\">");
  });

  it("renders the label/chevron/count shell", async () => {
    const el = await renderInto(
      <Accordion.Root type="multiple" value={["g"]}>
        <RailGroup value="g" label="Basics" count={3} contentClassName="app-rail-group-items">
          <span>body</span>
        </RailGroup>
      </Accordion.Root>,
    );
    const trigger = el.querySelector(".app-rail-group-label");
    expect(trigger).toBeTruthy();
    expect(trigger!.querySelector(".app-rail-group-chevron")).toBeTruthy();
    expect(trigger!.querySelector(".app-rail-count")?.textContent).toBe("3");
    expect(trigger!.textContent).toContain("Basics");
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
    // No widget-less aria-disabled anywhere in the rail.
    expect(compareRailSrc).not.toContain("aria-disabled");
    expect(el.querySelector("label[aria-disabled]")).toBeNull();
    // The locked (maxed-out, unpicked) chip still reads as disabled.
    const locked = el.querySelector('label.cmp-chip[data-disabled="true"]');
    expect(locked).toBeTruthy();
    // Native disabled semantics live on the checkbox itself (Radix renders a
    // disabled <button role="checkbox">); the <label> only carries the visual hook.
    const box = locked!.querySelector('[role="checkbox"]');
    expect(box).toBeTruthy();
    expect(
      box!.hasAttribute("disabled") ||
        box!.getAttribute("data-disabled") !== null ||
        box!.getAttribute("aria-disabled") === "true",
    ).toBe(true);
    // The visual dim hook moved with it.
    expect(compareCss).toContain('.cmp-chip[data-disabled="true"]');
    expect(compareCss).not.toContain('.cmp-chip[aria-disabled="true"]');
  });
});
