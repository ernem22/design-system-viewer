import { Fragment, useMemo, useState } from "react";
import type { DesignSystem } from "../systems/store.ts";

const isColor = (v: string) => /^(#|rgb|hsl|oklch|color\()/i.test(v.trim()) || /^[a-z]+$/i.test(v.trim());

interface DiffRow {
  name: string;
  vals: (string | undefined)[];
  same: boolean;
}

interface DiffSection {
  label: string;
  rows: DiffRow[];
}

/** Full token-diff table across every category, for the systems picked as
   compare columns. Ported from preview/src/compare.jsx's DiffTable. */
export function DiffTable({ cols }: { cols: DesignSystem[] }) {
  const [onlyDiff, setOnlyDiff] = useState(true);

  const { catOrder, byCat, valueMaps } = useMemo(() => {
    const catOrder: string[] = [];
    const byCat = new Map<string, Set<string>>();
    const nameCat = new Map<string, string>();
    const valueMaps = cols.map((s) => {
      const m = new Map<string, string>();
      for (const g of s.groups ?? []) {
        if (!byCat.has(g.label)) {
          byCat.set(g.label, new Set());
          catOrder.push(g.label);
        }
        for (const t of g.tokens) {
          m.set(t.name, t.value);
          if (!nameCat.has(t.name)) {
            nameCat.set(t.name, g.label);
            byCat.get(g.label)?.add(t.name);
          }
        }
      }
      return m;
    });
    for (const [name, label] of nameCat) byCat.get(label)?.add(name);
    return { catOrder, byCat, valueMaps };
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
          return { name, vals, same };
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
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
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
              {rows.map(({ name, vals, same }) => (
                <tr key={name} className={same ? "" : "is-diff"}>
                  <td className="cmp-diff-name">{name}</td>
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
