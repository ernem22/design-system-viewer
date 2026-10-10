/** One clickable row in the Rail (a parent section or a demo under it).
   Lives in lib/ (not shell/ or gallery/) since both sides need the same
   shape without either importing the other. */
export interface RailLink {
  id: string;
  label: string;
  /** Trailing count shown in its own right-aligned tabular-nums column
     (issue #286) — carried as data so the name truncates on its own line
     while the count stays visible. Absent for plain outline links. */
  count?: string | number;
}

/** What every tab feeds the shared Rail: parent labels with their links.
   Preview builds it from COMPONENT_ENTRIES + outline, Tokens from its
   categories — different builders, one shape. */
export type RailGroup = [label: string, links: RailLink[]];
export type RailGroups = RailGroup[];
