import { useMemo, useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Icon } from "../lib/icons.tsx";
import { SectionSearch } from "../shell/SectionSearch.tsx";
import { systemCoveragePercent } from "../systems/store.ts";
import type { DesignSystem } from "../systems/store.ts";
import type { CompareViewModel } from "./useCompareView.ts";
import { filterOptionGroups } from "./railFilter.ts";

/**
 * Compare tab's rail: the system picker (up to `maxColumns` systems, as a
 * vertical chip list) and, in "component" mode, the option-group picker
 * (Basics / Components / Extras / Screens) — legacy's toolbar row of system chips plus its
 * `<select>` of comparable components, reshaped for the shell's side rail
 * instead of a page-level toolbar. Component mode also carries a
 * SectionSearch filter (issue #38), since that `<select>`'s native
 * type-ahead is gone once the options are plain buttons. Whole-panel
 * open/close is owned by App.tsx, same as every other tab's rail.
 */
export function CompareRail({
  systems,
  view,
  open,
}: {
  systems: DesignSystem[];
  view: CompareViewModel;
  open: boolean;
}) {
  const { picked, toggle, maxColumns, mode, optionGroups, componentId, setComponentId } = view;
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const visibleGroups = useMemo(() => filterOptionGroups(optionGroups, query), [optionGroups, query]);
  const allLabels = ["systems", ...optionGroups.map((g) => g.label)];
  // Controlled (like Rail) instead of `defaultValue`, so a search can force
  // every surviving group open without discarding the user's own collapses.
  const [openGroups, setOpenGroups] = useState<string[]>(allLabels);
  const effectiveOpen = searching ? ["systems", ...visibleGroups.map((g) => g.label)] : openGroups;

  return (
    <div className="app-rail-clip" data-open={open}>
      <div className="app-rail-inner" inert={!open}>
        {mode === "component" && (
          <div className="cmp-rail-search">
            <SectionSearch value={query} onChange={setQuery} />
          </div>
        )}
        <Accordion.Root type="multiple" value={effectiveOpen} onValueChange={setOpenGroups}>
          <Accordion.Item value="systems" className="app-rail-group">
            <Accordion.Header>
              <Accordion.Trigger className="app-rail-group-label">
                <Icon name="chevronDown" size={11} className="app-rail-group-chevron" />
                <span>Systems</span>
                <span className="app-rail-count">
                  {picked.length}/{maxColumns}
                </span>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content>
              <div className="cmp-rail-systems">
                {systems.map((s) => {
                  const isOn = picked.includes(s.slug);
                  const locked = !isOn && picked.length >= maxColumns;
                  const pct = systemCoveragePercent(s);
                  return (
                    <label
                      key={s.slug}
                      className={`cmp-chip${isOn ? " on" : ""}`}
                      aria-disabled={locked || undefined}
                      title={locked ? `Max ${maxColumns} systems — unpick one first` : undefined}
                    >
                      <Checkbox.Root
                        className="dsv-check"
                        checked={isOn}
                        disabled={locked}
                        onCheckedChange={() => toggle(s.slug)}
                        aria-label={s.name}
                      >
                        <Checkbox.Indicator>
                          <Icon name="check" size={14} />
                        </Checkbox.Indicator>
                      </Checkbox.Root>
                      <span className="cmp-dot" aria-hidden="true" />
                      {s.name}
                      {pct != null && <span className="cmp-pct">{pct}%</span>}
                    </label>
                  );
                })}
              </div>
            </Accordion.Content>
          </Accordion.Item>

          {mode === "component" &&
            visibleGroups.map((group) => (
              <Accordion.Item key={group.label} value={group.label} className="app-rail-group">
                <Accordion.Header>
                  <Accordion.Trigger className="app-rail-group-label">
                    <Icon name="chevronDown" size={11} className="app-rail-group-chevron" />
                    <span>{group.label}</span>
                    <span className="app-rail-count">{group.items.length}</span>
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="app-rail-group-items">
                  {group.items.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className="app-rail-link"
                      aria-current={o.id === componentId ? "true" : undefined}
                      onClick={() => setComponentId(o.id)}
                    >
                      {o.label}
                    </button>
                  ))}
                </Accordion.Content>
              </Accordion.Item>
            ))}
        </Accordion.Root>
        {mode === "component" && searching && visibleGroups.length === 0 && (
          <p className="cmp-rail-empty">No components match “{query.trim()}”.</p>
        )}
      </div>
    </div>
  );
}
