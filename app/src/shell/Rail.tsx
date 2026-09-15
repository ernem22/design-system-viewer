import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { Icon } from "../lib/icons.tsx";
import { useScrollSpy } from "../lib/scrollspy.ts";
import type { RailGroups } from "../lib/railTypes.ts";

export interface RailProps {
  groups: RailGroups;
  /** True while a search query is narrowing `groups` — every group present
     is then guaranteed to hold at least one match, so all of them are
     forced open instead of leaving a result hidden behind a group the user
     collapsed earlier. */
  searching?: boolean;
  /** Whole-panel collapse state, owned by the parent (toggled from the
     topbar) so no floating edge handle sits next to the main scrollbar. */
  open: boolean;
}

/** Sidebar: shows sections grouped (collapse via Radix Accordion) and tracks
   which section is on screen — the active link gets `aria-current` plus a
   sliding highlight, and its group opens automatically if the user had
   collapsed it. Whole-panel collapse is owned by the parent via `open`. */
export default function Rail({ groups, searching = false, open }: RailProps) {
  // Memoized so `searching` mode (which uses this array as-is, see below)
  // doesn't hand Accordion/useLayoutEffect a new array identity every render.
  const labels = useMemo(() => groups.map(([label]) => label), [groups]);
  // Every group open by default. Not persisted: a fresh session always starts here.
  const [openGroups, setOpenGroups] = useState<string[]>(() => labels);

  const linkIds = useMemo(() => groups.flatMap(([, links]) => links.map((l) => l.id)), [groups]);
  // pinTo: clicking a link owns the highlight until the user's next own
  // scroll (see lib/scrollspy.ts) — the observer can't follow a click to a
  // demo that can never scroll up into its band (e.g. the last child).
  const [activeId, pinTo] = useScrollSpy(linkIds);

  // A collapsed group must never hide the section scrollspy just marked active.
  useEffect(() => {
    if (!activeId) return;
    const owner = groups.find(([, links]) => links.some((l) => l.id === activeId))?.[0];
    if (owner)
      setOpenGroups((current) => (current.includes(owner) ? current : [...current, owner]));
  }, [activeId, groups]);

  const effectiveOpenGroups = searching ? labels : openGroups;

  // Sliding highlight behind the active link, measured in the rail's own
  // content-space (viewport delta + scrollTop) so it scrolls natively with
  // the rail instead of needing a scroll listener.
  const innerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const rail = innerRef.current;
      const link =
        activeId && rail?.querySelector<HTMLAnchorElement>(`a[href="#${CSS.escape(activeId)}"]`);
      if (!rail || !link || !link.getClientRects().length) {
        setIndicator(null);
        return;
      }
      const railRect = rail.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      setIndicator({ top: linkRect.top - railRect.top + rail.scrollTop, height: linkRect.height });
    };
    measure();
    const raf = requestAnimationFrame(measure); // after this paint settles (collapse/filter reflow)
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [activeId, effectiveOpenGroups]);

  return (
    <div className="app-rail-clip" data-open={open}>
      <div className="app-rail-inner" ref={innerRef} inert={!open}>
        {indicator && (
          <span
            className="app-rail-indicator"
            style={{ top: indicator.top, height: indicator.height }}
            aria-hidden="true"
          />
        )}
        <Accordion.Root type="multiple" value={effectiveOpenGroups} onValueChange={setOpenGroups}>
          {groups.map(([label, links]) => (
            <Accordion.Item key={label} value={label} className="app-rail-group">
              <Accordion.Header>
                <Accordion.Trigger className="app-rail-group-label">
                  <Icon name="chevronDown" size={11} className="app-rail-group-chevron" />
                  <span>{label}</span>
                  <span className="app-rail-count">{links.length}</span>
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="app-rail-group-items">
                {links.map((l) => (
                  <a
                    key={l.id}
                    href={`#${l.id}`}
                    className="app-rail-link"
                    aria-current={l.id === activeId ? "true" : undefined}
                    onClick={() => pinTo(l.id)}
                  >
                    {l.label}
                  </a>
                ))}
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </div>
  );
}
