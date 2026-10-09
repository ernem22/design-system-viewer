import { useMemo, useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Icon } from "../lib/icons.tsx";
import { RailGroup } from "../shell/RailGroup.tsx";
import { SectionSearch } from "../shell/SectionSearch.tsx";
import { systemCoveragePercent } from "../systems/store.ts";
import type { DesignSystem } from "../systems/store.ts";
import type { CompareViewModel } from "./useCompareView.ts";
import { filterOptionGroups } from "./railFilter.ts";

/**
 * Compare tab's rail content: the system picker (up to `maxColumns` systems, as a
 * vertical chip list) and, in "component" mode, the option-group picker
 * (Basics / Components / Extras / Screens) — legacy's toolbar row of system chips plus its
 * `<select>` of comparable components, reshaped for the shell's side rail
 * instead of a page-level toolbar. Component mode also carries a
 * SectionSearch filter (issue #38), since that `<select>`'s native
 * type-ahead is gone once the options are plain buttons. The frame that
 * scrolls it (and the whole-panel open/close state) is owned once by Shell,
 * same as every other tab's rail; this component is content only.
 */

// Legacy collapsed the long Screens group by default; short groups stay open.
const DEFAULT_COLLAPSED_GROUPS = ["Screens"];

export function CompareRail({
  systems,
  view,
}: {
  systems: DesignSystem[];
  view: CompareViewModel;
}) {
  const { picked, toggle, maxColumns, mode, optionGroups, componentId, setComponentId } = view;
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const visibleGroups = useMemo(() => filterOptionGroups(optionGroups, query), [optionGroups, query]);
  const allLabels = ["systems", ...optionGroups.map((g) => g.label)];
  // Controlled (like Rail) instead of `defaultValue`, so a search can force
  // every surviving group open without discarding the user's own collapses.
  // Screens alone defaults collapsed (legacy: 27 links), short groups open.
  const [openGroups, setOpenGroups] = useState<string[]>(() =>
    allLabels.filter((label) => !DEFAULT_COLLAPSED_GROUPS.includes(label)),
  );
  const effectiveOpen = searching ? ["systems", ...visibleGroups.map((g) => g.label)] : openGroups;

  return (
    <>
      {mode === "component" && (
        <div className="cmp-rail-search">
          <SectionSearch value={query} onChange={setQuery} />
        </div>
      )}
      <Accordion.Root type="multiple" value={effectiveOpen} onValueChange={setOpenGroups}>
        <RailGroup value="systems" label="Systems" count={`${picked.length}/${maxColumns}`}>
          <div className="cmp-rail-systems">
            {systems.map((s) => {
              const isOn = picked.includes(s.slug);
              const locked = !isOn && picked.length >= maxColumns;
              const pct = systemCoveragePercent(s);
              return (
                <label
                  key={s.slug}
                  className={`cmp-chip${isOn ? " on" : ""}`}
                  data-disabled={locked || undefined}
                  title={locked ? `${s.name} — Max ${maxColumns} systems — unpick one first` : s.name}
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
                  <span className="cmp-chip-name">{s.name}</span>
                  {pct != null && <span className="cmp-pct">{pct}%</span>}
                </label>
                );
              })}
            </div>
        </RailGroup>

        {mode === "component" &&
          visibleGroups.map((group) => (
            <RailGroup
              key={group.label}
              value={group.label}
              label={group.label}
              count={group.items.length}
              contentClassName="app-rail-group-items"
            >
              {group.items.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="app-rail-link"
                  title={o.label}
                  aria-current={o.id === componentId ? "true" : undefined}
                  onClick={() => setComponentId(o.id)}
                >
                  <span className="app-rail-label">{o.label}</span>
                </button>
              ))}
            </RailGroup>
          ))}
      </Accordion.Root>
      {mode === "component" && searching && visibleGroups.length === 0 && (
        <p className="cmp-rail-empty">No components match “{query.trim()}”.</p>
      )}
    </>
  );
}
