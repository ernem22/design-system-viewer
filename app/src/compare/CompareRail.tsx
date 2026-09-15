import * as Accordion from "@radix-ui/react-accordion";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Icon } from "../lib/icons.tsx";
import { coveragePercent } from "../systems/store.ts";
import type { DesignSystem } from "../systems/store.ts";
import type { CompareViewModel } from "./useCompareView.ts";

/**
 * Compare tab's rail: the system picker (up to `maxColumns` systems, as a
 * vertical chip list) and, in "component" mode, the option-group picker
 * (Basics / Components) — legacy's toolbar row of system chips plus its
 * `<select>` of comparable components, reshaped for the shell's side rail
 * instead of a page-level toolbar. Whole-panel open/close is owned by
 * App.tsx, same as every other tab's rail.
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
  const defaultOpen = ["systems", ...optionGroups.map((g) => g.label)];

  return (
    <div className="app-rail-clip" data-open={open}>
      <div className="app-rail-inner" inert={!open}>
        <Accordion.Root type="multiple" defaultValue={defaultOpen}>
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
                  const pct = coveragePercent(s.coverage);
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
            optionGroups.map((group) => (
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
      </div>
    </div>
  );
}
