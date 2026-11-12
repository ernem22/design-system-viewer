import { useId, type ReactNode } from "react";
import { Icon } from "../lib/icons.tsx";

export interface RailGroupProps {
  /** Readable prefix for this group's unique header/items id (the group
      label); uniqueness itself comes from useId(). */
  value: string;
  /** Visible group heading. */
  label: ReactNode;
  /** Group count — the number of child rows it holds. */
  count: ReactNode;
  /** Whether the group body is expanded. */
  open: boolean;
  /** Toggle the group open/closed (ignored when `staticLabel`). */
  onToggle: () => void;
  /** Group body: links for Rail, chips or picker buttons for Compare. */
  children: ReactNode;
  /** Content wrapper class. Rail and Compare option groups use
      "app-rail-group-items"; omit it for Compare's systems group, which wraps
      its own .cmp-rail-systems div. */
  contentClassName?: string;
  /** Search active: render the header as a static label, not a toggle (there
      is nothing left to collapse while results are narrowed). */
  staticLabel?: boolean;
  /** The family holding the current section — marked even when its rows are
      scrolled offstage, so the collapsed family still reads as current. */
  active?: boolean;
  /** Roving-focus wiring (Rail only): the header button's tab stop and key. */
  headerTabIndex?: number;
  headerKey?: string;
}

/** Shared rail group shell: the label + chevron + count header both Rail and
    CompareRail hand-built before. Presentational only — collapse state, focus
    and scrollspy tracking stay in the callers. The header is an `<h2>` so the
    outline does not jump h1 → h3 (the rail sits before main in the DOM); the
    button inside owns the visual scale. Hand-rolled (not Radix Accordion) so
    the rail can drive its own roving focus and swap the toggle for a static
    label while searching. */
export function RailGroup({
  value,
  label,
  count,
  open,
  onToggle,
  children,
  contentClassName,
  staticLabel = false,
  active = false,
  headerTabIndex,
  headerKey,
}: RailGroupProps) {
  // useId makes the items id unique per instance: every tab's rail is
  // force-mounted, so a value-only id would repeat across the Preview rail and
  // CompareRail (Components/Extras/Screens twice), leaving a header's
  // aria-controls pointing at a hidden twin.
  const itemsId = `rail-group-items-${value}-${useId()}`;
  return (
    <div className="app-rail-group" data-active={active || undefined}>
      <h2 className="app-rail-group-heading">
        {staticLabel ? (
          <span className="app-rail-group-static">
            <span className="app-rail-group-text">{label}</span>
            <span className="app-rail-count">{count}</span>
          </span>
        ) : (
          <button
            type="button"
            className="app-rail-group-label"
            aria-expanded={open}
            aria-controls={itemsId}
            tabIndex={headerTabIndex}
            data-rail-key={headerKey}
            onClick={onToggle}
          >
            <Icon name="chevronDown" size={11} className="app-rail-group-chevron" />
            <span className="app-rail-group-text">{label}</span>
            <span className="app-rail-count">{count}</span>
          </button>
        )}
      </h2>
      {open && (
        <div className={contentClassName} id={itemsId}>
          {children}
        </div>
      )}
    </div>
  );
}
