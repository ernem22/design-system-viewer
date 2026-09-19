import { describe, expect, it } from "vitest";
import { filterOptionGroups } from "./railFilter.ts";
import type { OptionGroup } from "./useCompareView.ts";
import type { ComparableOption } from "./registry.tsx";

const opt = (id: string, label: string): ComparableOption => ({ id, label, Render: () => null });

const groups: OptionGroup[] = [
  { label: "Basics", items: [opt("button", "Button"), opt("input", "Input")] },
  { label: "Components", items: [opt("gallery-forms", "Forms"), opt("gallery-buttons", "Buttons")] },
  { label: "Screens", items: [opt("gallery-screen-login", "Login screen")] },
];

const labels = (gs: OptionGroup[]) => gs.map((g) => g.label);
const items = (gs: OptionGroup[], label: string) =>
  gs.find((g) => g.label === label)?.items.map((i) => i.label) ?? null;

describe("filterOptionGroups", () => {
  it("is a no-op for an empty or blank query", () => {
    expect(filterOptionGroups(groups, "")).toBe(groups);
    expect(filterOptionGroups(groups, "   ")).toBe(groups);
  });

  it("keeps only matching items and drops groups left empty", () => {
    const out = filterOptionGroups(groups, "but");
    expect(labels(out)).toEqual(["Basics", "Components"]);
    expect(items(out, "Basics")).toEqual(["Button"]);
    expect(items(out, "Components")).toEqual(["Buttons"]);
  });

  it("keeps every item when the group label itself matches", () => {
    const out = filterOptionGroups(groups, "basics");
    expect(labels(out)).toEqual(["Basics"]);
    expect(items(out, "Basics")).toEqual(["Button", "Input"]);
  });

  it("matches case-insensitively", () => {
    expect(labels(filterOptionGroups(groups, "SCREENS"))).toEqual(["Screens"]);
  });

  it("folds Turkish dotted/dotless I like the other rails", () => {
    const tr: OptionGroup[] = [{ label: "Ekstra", items: [opt("i", "İletişim"), opt("x", "İptal")] }];
    expect(labels(filterOptionGroups(tr, "iletişim"))).toEqual(["Ekstra"]);
    expect(labels(filterOptionGroups(tr, "iptal"))).toEqual(["Ekstra"]);
  });

  it("returns nothing when no group or item matches", () => {
    expect(filterOptionGroups(groups, "zzzz")).toEqual([]);
  });
});
