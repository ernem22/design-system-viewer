import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { RailGroup } from "./RailGroup.tsx";
import { SectionSearch } from "./SectionSearch.tsx";
import { useScrollSpy } from "../lib/scrollspy.ts";
import { writeSectionHash } from "../lib/urlState.ts";
import type { RailGroups } from "../lib/railTypes.ts";

/** Search field wiring. When present, Rail renders the query box at the top of
    its frame — search lives in the rail, not the topbar. */
export interface RailSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  name?: string;
}

export interface RailProps {
  groups: RailGroups;
  /** True while a search query is narrowing `groups` — every group present
     then holds at least one match. Groups render open with static (non-toggle)
     headers, and the rail owns the empty state when nothing survives. */
  searching?: boolean;
  /** Mirror the current section into location.hash (deep-link section sync).
     True only for the visible tab's Rail — inactive tabs stay forceMounted
     (display:none) where every rect measures ~0 and the scan would report a
     bogus first section — and only after App's initial #hash restore. */
  syncSection?: boolean;
  /** False while this Rail's own tab is inactive. Inactive tabs stay
     forceMounted (display:none); without this gate their scrollspy would still
     recompute on every scroll of the one shared `.app-main` scroller — pure
     wasted DOM lookups producing meaningless geometry. */
  active?: boolean;
  /** When given, the rail renders its own search field bound to this state. */
  search?: RailSearch;
}

interface RailItem {
  key: string;
  id: string | null;
  header: boolean;
  family: string;
}

/** Sidebar content: sections grouped into collapsible families. Rows are
    *scroll targets* (sections), not demos — the id a clicked row lands on is
    the id the scrollspy reports, because both use one shared landing offset
    (see lib/scrollspy.ts), so the highlight needs no pin. The active row gets
    a per-row background + inset accent bar; the active family's sticky header
    keeps it marked even when its rows are offstage.

    Keyboard: the row list is ONE tab stop with roving focus (Up/Down move,
    Left/Right collapse/expand a header, Home/End jump to the ends, Enter
    follows). Focus starts on the active row and stays independent of
    activation — the spy never steals focus.

    The frame that scrolls this content is owned once by Shell (RailFrame.tsx);
    this component renders inside it and finds that scroller to auto-reveal the
    active row, so no tab can bring a second scroller. */
export default function Rail({ groups, searching = false, syncSection = false, active = true, search }: RailProps) {
  const labels = useMemo(() => groups.map(([label]) => label), [groups]);
  // Families default closed; the first one opens on first load (see below).
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !labels.length) return;
    initialized.current = true;
    setOpenGroups([labels[0]]);
  }, [labels]);

  const linkIds = useMemo(() => groups.flatMap(([, links]) => links.map((l) => l.id)), [groups]);
  const [activeId, refresh] = useScrollSpy(linkIds, active);

  // The family holding the current section opens when the spy ENTERS it. A
  // family the user collapsed is respected until they leave and re-enter it —
  // this tracks the previous family so scrolling within one never re-opens.
  const prevFamily = useRef<string | null>(null);
  useEffect(() => {
    if (!activeId) return;
    const family = groups.find(([, links]) => links.some((l) => l.id === activeId))?.[0] ?? null;
    if (!family || family === prevFamily.current) return;
    prevFamily.current = family;
    setOpenGroups((current) => (current.includes(family) ? current : [...current, family]));
  }, [activeId, groups]);

  // A new query forces every surviving family open and swaps its header for a
  // static label; clearing restores the user's own open set.
  const effectiveOpen = searching ? labels : openGroups;

  // Opening/closing a family shifts every offset below it without a resize or
  // an id change — rebuild the spy's offset cache so the next tick agrees.
  useEffect(() => {
    refresh();
  }, [effectiveOpen, refresh]);

  // Deep-link section sync via replaceState — no history entry per scroll,
  // and the querystring half of the URL is preserved (App owns that half).
  useEffect(() => {
    if (syncSection && activeId) writeSectionHash(activeId);
  }, [syncSection, activeId]);

  // Flat, ordered focus list. While searching, headers are static labels and
  // only rows are focusable.
  const items = useMemo<RailItem[]>(() => {
    const out: RailItem[] = [];
    for (const [label, links] of groups) {
      const open = searching || effectiveOpen.includes(label);
      if (!searching) out.push({ key: `g:${label}`, id: null, header: true, family: label });
      if (open) {
        for (const l of links) out.push({ key: `r:${l.id}`, id: l.id, header: false, family: label });
      }
    }
    return out;
  }, [groups, effectiveOpen, searching]);

  const activeFamily = useMemo(
    () => groups.find(([, links]) => links.some((l) => l.id === activeId))?.[0] ?? null,
    [groups, activeId],
  );

  // Which row carries the single tab stop. Starts on the active row; when the
  // current key disappears (family collapsed, query changed) it falls back to
  // the active row, then the first row. Activation never moves it while valid.
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  useEffect(() => {
    if (focusedKey && items.some((i) => i.key === focusedKey)) return;
    const activeKey = activeId ? `r:${activeId}` : null;
    setFocusedKey(activeKey && items.some((i) => i.key === activeKey) ? activeKey : items[0]?.key ?? null);
  }, [items, activeId, focusedKey]);

  const containerRef = useRef<HTMLDivElement>(null);
  const toggleGroup = useCallback((label: string) => {
    setOpenGroups((current) =>
      current.includes(label) ? current.filter((l) => l !== label) : [...current, label],
    );
  }, []);

  const focusItem = useCallback((key: string) => {
    setFocusedKey(key);
    const nodes = containerRef.current?.querySelectorAll<HTMLElement>("[data-rail-key]");
    const el = nodes && [...nodes].find((n) => n.dataset.railKey === key);
    el?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      // Arrow keys inside the search field move its caret, not the roving focus.
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const index = items.findIndex((i) => i.key === focusedKey);
      if (index === -1) return;
      const current = items[index];
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          focusItem(items[Math.min(items.length - 1, index + 1)].key);
          return;
        case "ArrowUp":
          event.preventDefault();
          focusItem(items[Math.max(0, index - 1)].key);
          return;
        case "Home":
          event.preventDefault();
          focusItem(items[0].key);
          return;
        case "End":
          event.preventDefault();
          focusItem(items[items.length - 1].key);
          return;
        case "ArrowRight":
          if (current.header) {
            event.preventDefault();
            setOpenGroups((c) => (c.includes(current.family) ? c : [...c, current.family]));
          }
          return;
        case "ArrowLeft":
          if (current.header) {
            event.preventDefault();
            setOpenGroups((c) => c.filter((l) => l !== current.family));
          }
          return;
        default:
          return;
      }
    },
    [items, focusedKey, focusItem],
  );

  // Keep the active row in view inside the rail's own frame — never the main
  // scroller. Skipped when the frame is unmeasured (hidden tab / happy-dom).
  useEffect(() => {
    if (!activeId) return;
    const container = containerRef.current;
    const inner = container?.closest<HTMLElement>(".app-rail-inner");
    if (!container || !inner || inner.clientHeight === 0) return;
    const nodes = container.querySelectorAll<HTMLElement>("[data-rail-key]");
    const row = [...nodes].find((n) => n.dataset.railKey === `r:${activeId}`);
    if (!row) return;
    const rowRect = row.getBoundingClientRect();
    const innerRect = inner.getBoundingClientRect();
    const top = rowRect.top - innerRect.top + inner.scrollTop;
    const bottom = top + rowRect.height;
    if (top < inner.scrollTop) inner.scrollTop = top;
    else if (bottom > inner.scrollTop + inner.clientHeight) inner.scrollTop = bottom - inner.clientHeight;
  }, [activeId]);

  return (
    <div className="app-rail-nav" ref={containerRef} onKeyDown={onKeyDown}>
      {search && (
        <SectionSearch
          value={search.value}
          onChange={search.onChange}
          placeholder={search.placeholder}
          ariaLabel={search.ariaLabel}
          name={search.name}
        />
      )}
      {groups.map(([label, links]) => (
        <RailGroup
          key={label}
          value={label}
          label={label}
          count={links.length}
          open={searching || effectiveOpen.includes(label)}
          onToggle={() => toggleGroup(label)}
          staticLabel={searching}
          active={label === activeFamily}
          headerKey={`g:${label}`}
          headerTabIndex={focusedKey === `g:${label}` ? 0 : -1}
          contentClassName="app-rail-group-items"
        >
          {links.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              className="app-rail-link"
              title={l.label}
              aria-current={l.id === activeId ? "location" : undefined}
              tabIndex={focusedKey === `r:${l.id}` ? 0 : -1}
              data-rail-key={`r:${l.id}`}
              onClick={() => setFocusedKey(`r:${l.id}`)}
            >
              <span className="app-rail-label">{l.label}</span>
              {l.count != null && <span className="app-rail-item-count">{l.count}</span>}
            </a>
          ))}
        </RailGroup>
      ))}
      {searching && items.length === 0 && (
        <p className="app-rail-empty">
          {search?.value.trim() ? <>No sections match “{search.value.trim()}”.</> : "No matches."}
        </p>
      )}
    </div>
  );
}
