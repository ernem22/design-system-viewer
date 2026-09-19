import type { OptionGroup } from "./useCompareView.ts";

/** Turkish-aware fold, matching the gallery/tokens search (see
   gallery/registry.ts's `searchKey`), so "İ"/"ı" queries match. */
const fold = (s: string) => s.trim().toLocaleLowerCase("tr");

/** Narrows the Compare rail's option groups the same way `buildRailGroups`
   narrows Preview's: a group whose own label matches keeps every item, a
   group that doesn't keeps only matching items (and is dropped when none
   do). An empty query is a no-op. */
export function filterOptionGroups(groups: OptionGroup[], query: string): OptionGroup[] {
  const q = fold(query);
  if (!q) return groups;
  const out: OptionGroup[] = [];
  for (const group of groups) {
    const items = fold(group.label).includes(q)
      ? group.items
      : group.items.filter((o) => fold(o.label).includes(q));
    if (items.length) out.push({ label: group.label, items });
  }
  return out;
}
