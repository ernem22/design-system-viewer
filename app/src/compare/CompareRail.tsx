import { useId, useMemo, useState } from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as Toggle from "@radix-ui/react-toggle";
import { Icon } from "../lib/icons.tsx";
import { RailGroup } from "../shell/RailGroup.tsx";
import { systemCoveragePercent } from "../systems/store.ts";
import { REFERENCE_TOKEN_COUNT } from "../../../src/core/schema.js";
import type { DesignSystem } from "../systems/store.ts";
import type { CompareViewModel } from "./useCompareView.ts";
import { filterOptionGroups } from "./railFilter.ts";

/**
 * Compare tab's rail content. The mode switch lives here (one control, one
 * place), followed by the always-visible selection summary, the stable
 * catalogue of every system, and the single-select component picker.
 *
 * Two filter fields share one labelled pattern (`.cmp-rail-filter`): one
 * narrows the system catalogue, one narrows the component groups. The frame
 * that scrolls this content (and the whole-panel open/close state) is owned
 * once by Shell, same as every other tab's rail; this component is content
 * only.
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
  const { picked, toggle, maxColumns, mode, setMode, optionGroups, componentId, setComponentId } = view;
  // Force-mounted tabs (Shell keeps every tab mounted) duplicate a literal id;
  // wire labels and fields through useId so each rail instance is unique.
  const systemFilterId = useId();
  const componentFilterId = useId();
  const componentRadioName = useId();
  const [query, setQuery] = useState("");
  const [systemQuery, setSystemQuery] = useState("");
  const searching = query.trim().length > 0;
  const systemSearching = systemQuery.trim().length > 0;
  const visibleGroups = useMemo(() => filterOptionGroups(optionGroups, query), [optionGroups, query]);
  // Selected rows keep pick order (the first pick is the reference); the
  // catalogue below stays in its stable source order, so picking a system
  // never moves the row out from under the pointer.
  const bySlug = useMemo(() => new Map(systems.map((s) => [s.slug, s])), [systems]);
  const selected = useMemo(
    () =>
      picked.flatMap((slug) => {
        const s = bySlug.get(slug);
        return s ? [s] : [];
      }),
    [picked, bySlug],
  );
  const visibleSystems = useMemo(() => {
    const q = systemQuery.trim().toLocaleLowerCase("tr");
    return q ? systems.filter((s) => s.name.trim().toLocaleLowerCase("tr").includes(q)) : systems;
  }, [systems, systemQuery]);
  const atLimit = picked.length >= maxColumns;
  const pickerDisabled = mode === "diff";
  const allLabels = optionGroups.map((g) => g.label);
  // Controlled, so a search can force every surviving group open without
  // discarding the user's own collapses. Screens alone defaults collapsed
  // (legacy: 27 links), short groups open.
  const [openGroups, setOpenGroups] = useState<string[]>(() =>
    ["all", ...allLabels].filter((label) => !DEFAULT_COLLAPSED_GROUPS.includes(label)),
  );
  const toggleGroup = (label: string) =>
    setOpenGroups((cur) => (cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label]));
  const effectiveOpen = searching
    ? ["all", ...visibleGroups.map((g) => g.label)]
    : systemSearching
      ? Array.from(new Set([...openGroups, "all"]))
      : openGroups;

  return (
    <>
      <div className="cmp-rail-mode" role="group" aria-label="Compare mode">
        <div className="cmp-seg">
          <Toggle.Root pressed={mode === "component"} onPressedChange={(on) => on && setMode("component")}>
            Component
          </Toggle.Root>
          <Toggle.Root pressed={mode === "diff"} onPressedChange={(on) => on && setMode("diff")}>
            Token diff
          </Toggle.Root>
        </div>
      </div>

      <div className="app-rail-groups">
        <RailGroup
          value="selected-systems"
          label="Selected systems"
          count={`${picked.length}/${maxColumns}`}
          open
          onToggle={() => {}}
          staticLabel
        >
          <div className="cmp-rail-selected">
            {selected.map((s, index) => (
              <label
                key={s.slug}
                className="cmp-chip on"
                title={`Remove ${s.name} from the comparison`}
              >
                <Checkbox.Root
                  className="dsv-check"
                  checked
                  onCheckedChange={() => toggle(s.slug)}
                  aria-label={`Remove ${s.name} from the comparison`}
                >
                  <Checkbox.Indicator>
                    <Icon name="check" size={14} />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <span className="cmp-dot" aria-hidden="true" />
                <span className="cmp-chip-name">{s.name}</span>
                {index === 0 && <span className="cmp-ref-marker">Reference</span>}
              </label>
            ))}
            <p className="cmp-rail-hint" aria-live="polite">
              {selected.length === 0
                ? "Pick at least two systems below."
                : atLimit
                  ? `${maxColumns} of ${maxColumns} selected — deselect one to add another`
                  : `Select 2–${maxColumns} systems`}
            </p>
          </div>
        </RailGroup>

        <RailGroup
          value="all-systems"
          label="All systems"
          count={systems.length}
          open={effectiveOpen.includes("all")}
          onToggle={() => toggleGroup("all")}
        >
          <div className="cmp-rail-systems">
            <div className="cmp-rail-filter">
              <label htmlFor={systemFilterId}>Filter systems</label>
              <input
                id={systemFilterId}
                type="search"
                aria-label="Filter systems"
                value={systemQuery}
                onChange={(e) => setSystemQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSystemQuery("");
                }}
              />
            </div>
            {visibleSystems.map((s) => {
              const isOn = picked.includes(s.slug);
              const locked = !isOn && atLimit;
              const pct = systemCoveragePercent(s);
              return (
                <label
                  key={s.slug}
                  className={`cmp-chip${isOn ? " on" : ""}`}
                  data-disabled={locked || undefined}
                  title={locked ? `${s.name} — Max ${maxColumns} systems — deselect one first` : s.name}
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
                  {pct != null && pct < 100 && (
                    <span
                      className="cmp-pct"
                      title={`${pct}% of the ${REFERENCE_TOKEN_COUNT} schema tokens`}
                      aria-label={`${pct}% of ${REFERENCE_TOKEN_COUNT} schema tokens`}
                    >
                      {pct}%
                    </span>
                  )}
                </label>
              );
            })}
            {visibleSystems.length === 0 && (
              <p className="cmp-rail-hint">No systems match “{systemQuery.trim()}”.</p>
            )}
          </div>
        </RailGroup>

        <div className="cmp-rail-picker">
          <div className="cmp-rail-filter" data-disabled={pickerDisabled || undefined}>
            <label htmlFor={componentFilterId}>Filter components</label>
            <input
              id={componentFilterId}
              type="search"
              aria-label="Filter components"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
              disabled={pickerDisabled}
            />
          </div>
          {pickerDisabled && (
            <p className="cmp-rail-reason">Component picker is disabled in Token diff — switch to Component to pick one.</p>
          )}
        </div>

        {visibleGroups.map((group) => (
          <RailGroup
            key={group.label}
            value={group.label}
            label={group.label}
            count={group.items.length}
            open={effectiveOpen.includes(group.label)}
            onToggle={() => toggleGroup(group.label)}
            staticLabel={searching}
            contentClassName="app-rail-group-items"
          >
            {group.items.map((o) => (
              <label
                key={o.id}
                className="cmp-radio-row"
                data-disabled={pickerDisabled || undefined}
                title={o.label}
              >
                <input
                  type="radio"
                  name={componentRadioName}
                  value={o.id}
                  checked={o.id === componentId}
                  disabled={pickerDisabled}
                  onChange={() => setComponentId(o.id)}
                />
                <span className="cmp-radio-label">{o.label}</span>
              </label>
            ))}
          </RailGroup>
        ))}
      </div>

      {searching && visibleGroups.length === 0 && (
        <p className="cmp-rail-empty">No components match “{query.trim()}”.</p>
      )}
    </>
  );
}
