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

/** Folds entries + their discovered Demo children into the `[parentLabel,
   children][]` shape Rail expects — one entry per parent, its Demo blocks
   as children. Empty `query` keeps everything; otherwise a parent whose
   label matches keeps all its children, and a parent that doesn't match
   keeps only the children that do (dropped entirely if none do) — Rail's
   `searching` flag then force-opens whatever survives. */
export function buildRailGroups(
  entries: GalleryEntry[],
  outline: EntryOutline,
  query: string,
): RailGroups {
  // Screens hold no <Demo> blocks — link the section itself, or it would be
  // unreachable from the rail and invisible to scrollspy.
  const childrenOf = (e: GalleryEntry): RailLink[] => {
    const demos = outline[e.id] ?? [];
    return demos.length ? demos : [{ id: e.id, label: e.label }];
  };
  const q = searchKey(query);
  if (!q) return entries.map((e) => [e.label, childrenOf(e)]);

  const groups: RailGroups = [];
  for (const e of entries) {
    const children = childrenOf(e);
    const parentMatches = searchKey(e.label).includes(q);
    const visible = parentMatches ? children : children.filter((c) => searchKey(c.label).includes(q));
    if (parentMatches || visible.length > 0) groups.push([e.label, visible]);
  }
  return groups;
}
