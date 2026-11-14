// The rail redesign: a row is a *section* (the scroll target), grouped into
// the same Components / Extras / Screens families Compare uses. Demo-level
// rows are gone — a section row carries its demo count instead, so the "11"
// of "Component / Button 11" is still reachable without a row per demo.
import { describe, expect, it } from "vitest";
import { COMPONENT_ENTRIES } from "./components/index.ts";
import { buildRailGroups, EXTRA_SECTION_IDS } from "./registry.ts";
import type { EntryOutline } from "./registry.ts";

describe("buildRailGroups taxonomy", () => {
  it("groups every section into Components / Extras / Screens, in that order", () => {
    const groups = buildRailGroups(COMPONENT_ENTRIES, {}, "");
    expect(groups.map(([label]) => label)).toEqual(["Components", "Extras", "Screens"]);
  });

  it("splits the 12 non-screen sections 7 / 5 and keeps all 27 screens", () => {
    const groups = buildRailGroups(COMPONENT_ENTRIES, {}, "");
    const byLabel = new Map(groups);
    expect(byLabel.get("Components")).toHaveLength(7);
    expect(byLabel.get("Extras")).toHaveLength(5);
    expect(byLabel.get("Screens")).toHaveLength(27);
    // The extras family is exactly the shared EXTRA_SECTION_IDS set.
    expect(new Set(byLabel.get("Extras")!.map((l) => l.id))).toEqual(EXTRA_SECTION_IDS);
  });

  it("renders one row per section (12 + 27 = 39), never a row per demo", () => {
    const groups = buildRailGroups(COMPONENT_ENTRIES, {}, "");
    const ids = groups.flatMap(([, links]) => links.map((l) => l.id));
    expect(ids).toHaveLength(39);
    expect(new Set(ids).size).toBe(39);
    for (const id of ids) expect(COMPONENT_ENTRIES.some((e) => e.id === id)).toBe(true);
  });

  it("carries a section's demo count as its row count; screens have none", () => {
    const outline: EntryOutline = {
      forms: [
        { id: "forms-a", label: "A" },
        { id: "forms-b", label: "B" },
      ],
    };
    const groups = buildRailGroups(COMPONENT_ENTRIES, outline, "");
    const components = new Map(groups).get("Components")!;
    expect(components.find((l) => l.id === "forms")?.count).toBe(2);
    const screens = new Map(groups).get("Screens")!;
    expect(screens.every((l) => l.count === undefined)).toBe(true);
  });

  it("narrows to matching section rows and drops empty families", () => {
    const groups = buildRailGroups(COMPONENT_ENTRIES, {}, "log");
    const labels = groups.map(([label]) => label);
    // "Login" is a screen, "Activity log" too — Extras/Components drop out.
    expect(labels).toEqual(["Screens"]);
    const ids = groups[0][1].map((l) => l.id);
    expect(ids).toContain("screen-login");
    expect(ids).toContain("screen-activity");
    for (const [, links] of groups) {
      for (const l of links) {
        expect(l.label.toLocaleLowerCase("tr").includes("log")).toBe(true);
      }
    }
  });

  it("matches section labels for non-screen families too", () => {
    const groups = buildRailGroups(COMPONENT_ENTRIES, {}, "form");
    const components = new Map(groups).get("Components")!;
    const ids = components.map((l) => l.id);
    expect(ids).toContain("forms");
    expect(ids).toContain("form");
    expect(new Map(groups).has("Screens")).toBe(false);
  });
});
