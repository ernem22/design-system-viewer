// Issue #317: the 27 screen sections ("Data viz", "Files", … "Command
// palette") each rendered as a separate rail parent with a single child —
// themselves — pushing every section below the fold. They fold into one
// "Screens" parent with one child link per screen, in registry order.
import { describe, expect, it } from "vitest";
import { COMPONENT_ENTRIES } from "./components/index.ts";
import { buildRailGroups } from "./registry.ts";

describe("buildRailGroups screens folding (issue #317)", () => {
  it("folds every screen-* entry into exactly one Screens parent", () => {
    const groups = buildRailGroups(COMPONENT_ENTRIES, {}, "");
    const screens = groups.filter(([label]) => label === "Screens");
    expect(screens).toHaveLength(1);
    const ids = screens[0][1].map((c) => c.id);
    expect(ids).toContain("screen-login");
    expect(ids).toContain("screen-command");
    // No other parent holds a screen section.
    for (const [label, links] of groups) {
      if (label === "Screens") continue;
      for (const l of links) expect(l.id.startsWith("screen-")).toBe(false);
    }
  });

  it("keeps registry order with one child link per screen", () => {
    const groups = buildRailGroups(COMPONENT_ENTRIES, {}, "");
    const screens = groups.find(([label]) => label === "Screens");
    expect(screens).toBeTruthy();
    const expected = COMPONENT_ENTRIES.filter((e) => e.id.startsWith("screen-")).map(
      (e) => ({ id: e.id, label: e.label }),
    );
    expect(screens![1]).toEqual(expected);
  });

  it("filters inside Screens on search, keeping only matching children", () => {
    const groups = buildRailGroups(COMPONENT_ENTRIES, {}, "log");
    const screens = groups.find(([label]) => label === "Screens");
    expect(screens).toBeTruthy();
    const ids = screens![1].map((c) => c.id);
    // "Login" and "Activity log" both match "log".
    expect(ids).toContain("screen-login");
    expect(ids).toContain("screen-activity");
    for (const c of screens![1]) {
      expect(c.label.toLocaleLowerCase("tr").includes("log")).toBe(true);
    }
  });

  it("leaves non-screen entries as one parent per entry", () => {
    const groups = buildRailGroups(COMPONENT_ENTRIES, {}, "");
    const forms = groups.find(([label]) => label === "Forms");
    expect(forms).toBeTruthy();
    expect(forms![1]).toEqual([{ id: "forms", label: "Forms" }]);
  });
});
