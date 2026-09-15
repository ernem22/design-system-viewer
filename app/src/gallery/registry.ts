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
  const q = query.trim().toLowerCase();
  if (!q) return entries.map((e) => [e.label, outline[e.id] ?? []]);

  const groups: RailGroups = [];
  for (const e of entries) {
    const children = outline[e.id] ?? [];
    const parentMatches = e.label.toLowerCase().includes(q);
    const visible = parentMatches ? children : children.filter((c) => c.label.toLowerCase().includes(q));
    if (parentMatches || visible.length > 0) groups.push([e.label, visible]);
  }
  return groups;
}
