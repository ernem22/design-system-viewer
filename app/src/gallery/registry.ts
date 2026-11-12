import type { ComponentType } from "react";
import type { RailGroups, RailLink } from "../lib/railTypes.ts";

/** One gallery section: anchor id + the demo content it renders. */
export interface GalleryEntry {
  id: string;
  label: string;
  desc: string;
  Body: ComponentType;
}

/** Each entry's rendered Demo blocks, keyed by entry id — see
   lib/galleryOutline.ts, which discovers these from the DOM. */
export type EntryOutline = Record<string, RailLink[]>;

/** Turkish-aware fold (legacy preview search), so "İ"/"ı" queries match. */
const searchKey = (s: string) => s.trim().toLocaleLowerCase("tr");

const isScreen = (e: GalleryEntry) => e.id.startsWith("screen-");

/** Sections that are not Radix components but product patterns (issue-2
 *  Extras port). Shared with Compare, which splits its picker into the same
 *  Components / Extras / Screens families — one source, so the two rails agree. */
export const EXTRA_SECTION_IDS = new Set([
  "foundation",
  "patterns",
  "data-display",
  "status",
  "nav-extras",
]);

/** Folds entries into the `[parentLabel, sections][]` shape Rail expects. A
    rail row is a *section* (the scroll target), grouped into the same
    Components / Extras / Screens families Compare uses — the section is the
    unit, its demos stay reachable by deep-link (and via the section row's
    id), never as rows of their own.
    Each row carries the number of Demo blocks it holds as its count (the
    "items the row represents"); a screen holds none, so it has no count.
    Empty `query` keeps everything; otherwise only rows whose label matches
    survive, and a family with no surviving rows is dropped. */
export function buildRailGroups(
  entries: GalleryEntry[],
  outline: EntryOutline,
  query: string,
): RailGroups {
  const q = searchKey(query);
  const row = (e: GalleryEntry): RailLink => {
    const demos = (outline[e.id] ?? []).length;
    return demos ? { id: e.id, label: e.label, count: demos } : { id: e.id, label: e.label };
  };
  const groups: RailGroups = [];
  const push = (label: string, list: GalleryEntry[]) => {
    const rows = list.filter((e) => !q || searchKey(e.label).includes(q)).map(row);
    if (rows.length) groups.push([label, rows]);
  };
  push("Components", entries.filter((e) => !isScreen(e) && !EXTRA_SECTION_IDS.has(e.id)));
  push("Extras", entries.filter((e) => !isScreen(e) && EXTRA_SECTION_IDS.has(e.id)));
  push("Screens", entries.filter(isScreen));
  return groups;
}
