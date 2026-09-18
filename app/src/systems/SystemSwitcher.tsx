import * as Select from "@radix-ui/react-select";
import { useMemo } from "react";
import { Icon } from "../lib/icons.tsx";
import "./AddSystemDialog.css";
import { systemCoveragePercent, type DesignSystem } from "./store.ts";

interface SystemSwitcherProps {
  systems: DesignSystem[];
  active: DesignSystem | null;
  activeSlug: string;
  onSelect: (slug: string) => void;
  onAddClick: () => void;
}

/** Header system switcher — ported from the legacy dsv-topbar-sysbtn
   (preview/src/App.jsx), using Radix Select instead of a native <select>.
   Always shown (even with one system) so the Add-system affordance next to
   it stays discoverable. */
export default function SystemSwitcher({
  systems,
  active,
  activeSlug,
  onSelect,
  onAddClick,
}: SystemSwitcherProps) {
  const addButton = (
    <button type="button" className="tok-btn" title="Add a new design system" onClick={onAddClick}>
      + Add system
    </button>
  );
  // Menu-row pcts, recomputed only when the system list changes — not on each
  // unrelated App re-render (a search keystroke re-renders App; legacy preview
  // memoized this as `pctMap`).
  const pctMap = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const s of systems) m.set(s.slug, systemCoveragePercent(s));
    return m;
  }, [systems]);
  // The header reads `active` itself (memoized on its identity), not through
  // `pctMap`: `active` can be replaced while `systems` keeps its reference, in
  // which case a slug-keyed map would serve the previous entry's pct or null.
  const activePct = useMemo(() => systemCoveragePercent(active), [active]);
  if (systems.length === 0) return <span className="app-syswrap">{addButton}</span>;
  return (
    <span className="app-syswrap">
      <Select.Root value={activeSlug} onValueChange={onSelect}>
      <Select.Trigger className="app-sysbtn" aria-label="Active design system">
        <span className="app-sysbtn-name">
          <Select.Value placeholder="Select system" />
        </span>
        <Select.Icon className="app-sysbtn-chev">
          <Icon name="chevronDown" size={13} />
        </Select.Icon>
      </Select.Trigger>
      {activePct != null && (
        <span className="app-topbar-cov" title="Schema token coverage">
          {activePct}%
        </span>
      )}
      <Select.Portal>
        <Select.Content className="app-select-content app-sysmenu" position="popper" sideOffset={6} align="start">
          <Select.Viewport>
            {systems.map((s) => {
              const pct = pctMap.get(s.slug) ?? null;
              return (
                <Select.Item key={s.slug} value={s.slug} className="app-select-item">
                  <Select.ItemIndicator className="app-select-item-indicator">
                    <Icon name="check" size={14} />
                  </Select.ItemIndicator>
                  <Select.ItemText>{s.name}</Select.ItemText>
                  {pct != null && <span className="app-sysmenu-pct">{pct}%</span>}
                </Select.Item>
              );
            })}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
      {addButton}
    </span>
  );
}
