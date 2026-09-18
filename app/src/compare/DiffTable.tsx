import { Fragment, useMemo, useState } from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Icon } from "../lib/icons.tsx";
import type { DesignSystem } from "../systems/store.ts";

/* CSS-wide keywords the parser accepts as valid `color` values but which are
   not colors to paint a swatch with. happy-dom is also laxer than a browser
   (`none` is accepted there), so this keeps both sides honest. */
const NON_COLOR_KEYWORDS = new Set([
  "none",
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  "auto",
  "normal",
]);

let colorProbe: HTMLSpanElement | null | undefined;

/** A value is a color only when the CSS parser accepts it for `color`.
   A text regex (`/^[a-z]+$/i`) cannot separate a keyword like `bold` or a
   family like `Inter` from `red`; the parser can. It normalizes the value,
   so `#FFF`, `currentColor` and `var(--x)` all survive the round-trip. */
function isColor(v: string): boolean {
  const value = v.trim();
  if (!value || NON_COLOR_KEYWORDS.has(value.toLowerCase())) return false;
  if (colorProbe === undefined) {
    colorProbe = typeof document === "undefined" ? null : document.createElement("span");
  }
  if (!colorProbe) return false;
  colorProbe.style.color = "";
  colorProbe.style.color = value;
  return colorProbe.style.color !== "";
}

interface DiffRow {
  name: string;
  vals: (string | undefined)[];
  same: boolean;
  categories: string[];
}

interface DiffSection {
  label: string;
  rows: DiffRow[];
}

/** Full token-diff table across every category, for the systems picked as
   compare columns. Ported from preview/src/compare.jsx's DiffTable. */
export function DiffTable({ cols }: { cols: DesignSystem[] }) {
  const [onlyDiff, setOnlyDiff] = useState(true);

  /* A token can sit under a different `g.label` in each system. Union every
     label the token appears under (in first-seen order) instead of letting
     the first system's label win; the row is grouped by its first label. */
  const { catOrder, byCat, valueMaps, categories } = useMemo(() => {
    const catOrder: string[] = [];
    const byCat = new Map<string, Set<string>>();
    const categories = new Map<string, string[]>();
    const valueMaps = cols.map((s) => {
      const m = new Map<string, string>();
      for (const g of s.groups ?? []) {
        for (const t of g.tokens) {
          m.set(t.name, t.value);
          const labels = categories.get(t.name);
          if (!labels) categories.set(t.name, [g.label]);
          else if (!labels.includes(g.label)) labels.push(g.label);
        }
      }
      return m;
    });
    for (const [name, labels] of categories) {
      const primary = labels[0];
      if (!byCat.has(primary)) {
        byCat.set(primary, new Set());
        catOrder.push(primary);
      }
      byCat.get(primary)?.add(name);
    }
    return { catOrder, byCat, valueMaps, categories };
  }, [cols]);

  let diffs = 0;
  let total = 0;
  const sections: DiffSection[] = catOrder
    .map((label) => {
      const names = [...(byCat.get(label) ?? [])].sort();
      const rows = names
        .map((name) => {
          const vals = valueMaps.map((m) => m.get(name));
          const present = vals.filter((v) => v != null);
          const same = present.length === vals.length && present.every((v) => v === present[0]);
          total++;
          if (!same) diffs++;
          return { name, vals, same, categories: categories.get(name) ?? [] };
        })
        .filter((r) => !onlyDiff || !r.same);
      return rows.length ? { label, rows } : null;
    })
    .filter((s): s is DiffSection => s != null);

  return (
    <div className="cmp-diff">
      <div className="cmp-diff-bar">
        <span className="dsv-muted">
          <b>{total}</b> tokens · <b>{diffs}</b> different · <b>{total - diffs}</b> same
        </span>
        <label className="dsv-control-label" style={{ fontSize: "var(--font-size-sm)" }}>
          <Checkbox.Root className="dsv-check" checked={onlyDiff} onCheckedChange={(checked) => setOnlyDiff(checked === true)}>
            <Checkbox.Indicator>
              <Icon name="check" size={14} />
            </Checkbox.Indicator>
          </Checkbox.Root>
          only differences
        </label>
      </div>
      <table className="cmp-diff-table">
        <thead>
          <tr>
            <th>token</th>
            {cols.map((s) => (
              <th key={s.slug}>{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map(({ label, rows }) => (
            <Fragment key={label}>
              <tr className="cmp-diff-cat">
                <td colSpan={cols.length + 1}>{label}</td>
              </tr>
              {rows.map(({ name, vals, same, categories: cats }) => (
                <tr key={name} className={same ? "" : "is-diff"}>
                  <td className="cmp-diff-name">
                    {name}
                    {cats.length > 1 && (
                      <span
                        className="dsv-muted"
                        style={{ marginLeft: "var(--space-2)", fontSize: "var(--font-size-xs)" }}
                        title={cats.join(" · ")}
                      >
                        {cats.join(" · ")}
                      </span>
                    )}
                  </td>
                  {vals.map((v, i) => (
                    <td key={i} className="cmp-diff-val">
                      {v == null ? (
                        <span className="cmp-diff-missing">—</span>
                      ) : (
                        <span className="cmp-diff-cell">
                          {isColor(v) && <span className="cmp-diff-chip" style={{ background: v }} />}
                          <code>{v}</code>
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      {!sections.length && (
        <p className="dsv-muted" style={{ padding: "var(--space-4)" }}>
          No differences — selected systems match on these tokens.
        </p>
      )}
    </div>
  );
}
