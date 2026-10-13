import * as Select from "@radix-ui/react-select";
import { useMemo } from "react";
import { Icon } from "../lib/icons.tsx";
import "./AddSystemDialog.css";
import { systemCoveragePercent, type DesignSystem } from "./store.ts";
import { REFERENCE_TOKEN_COUNT } from "../../../src/core/schema.js";

interface SystemSwitcherProps {
  systems: DesignSystem[];
  active: DesignSystem | null;
  activeSlug: string;
  onSelect: (slug: string) => void;
}

/** Header system switcher — ported from the legacy dsv-topbar-sysbtn
   (preview/src/App.jsx), using Radix Select instead of a native <select>.
   Shown whenever there is at least one system; the Add-system affordance is
   the `+` icon in the topbar's action cluster (App.tsx), not a labelled
   button here — the switcher is for switching. */
export default function SystemSwitcher({
  systems,
  active,
  activeSlug,
  onSelect,
}: SystemSwitcherProps) {
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
  if (systems.length === 0) return null;
  return (
    <span className="app-syswrap">
      <Select.Root value={activeSlug} onValueChange={onSelect}>
      {/* The name ellipsises inside the trigger (shell.css max-width). `title`
          gives a sighted hover affordance for the clipped text, and folding
          the name into `aria-label` gives keyboard/AT users the full string
          the generic label otherwise hid. */}
      <Select.Trigger
        className="app-sysbtn"
        title={active?.name}
        aria-label={active ? `Active design system: ${active.name}` : "Active design system"}
      >
        <span className="app-sysbtn-name">
          <Select.Value placeholder="Select system" />
        </span>
        <Select.Icon className="app-sysbtn-chev">
          <Icon name="chevronDown" size={13} />
        </Select.Icon>
      </Select.Trigger>
      {activePct != null && activePct < 100 && (
        <span className="app-topbar-cov" title={`${activePct}% of the ${REFERENCE_TOKEN_COUNT} schema tokens`}>
          {activePct}%
        </span>
      )}
      <Select.Portal>
        <Select.Content className="app-select-content app-sysmenu" position="popper" sideOffset={6} align="start">
          {/* Scroll buttons (issue #334): with ~29+ systems the menu ran past
              the viewport bottom and nothing scrolled. Radix only mounts these
              while the viewport can scroll that way, so mouse users see there
              is more. lib/icons has no chevron-up glyph, so the up button
              reuses chevron-down rotated (shell.css). */}
          <Select.ScrollUpButton className="app-sysmenu-scroll app-sysmenu-scroll-up">
            <Icon name="chevronDown" size={13} />
          </Select.ScrollUpButton>
          <Select.Viewport>
            {systems.map((s) => {
              const pct = pctMap.get(s.slug) ?? null;
              return (
                <Select.Item key={s.slug} value={s.slug} className="app-select-item">
                  <Select.ItemIndicator className="app-select-item-indicator">
                    <Icon name="check" size={14} />
                  </Select.ItemIndicator>
                  <Select.ItemText>{s.name}</Select.ItemText>
                  {pct != null && pct < 100 && (
                    <span
                      className="app-sysmenu-pct"
                      title={`${pct}% of the ${REFERENCE_TOKEN_COUNT} schema tokens`}
                    >
                      {pct}%
                    </span>
                  )}
                </Select.Item>
              );
            })}
          </Select.Viewport>
          <Select.ScrollDownButton className="app-sysmenu-scroll">
            <Icon name="chevronDown" size={13} />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
    </span>
  );
}
