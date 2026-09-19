import { systemCoveragePercent } from "../systems/store.ts";
import type { CompareViewModel } from "./useCompareView.ts";

/** Compare tab's right rail: coverage of each picked system, at a glance —
   the diff table's own bar already carries live diff counts, so this panel
   doesn't duplicate them. */
export function CompareProps({ view }: { view: CompareViewModel }) {
  const { cols, mode } = view;
  return (
    <div className="cmp-props">
      <div className="cmp-props-block">
        <h3>Selected systems</h3>
        {cols.length ? (
          <ul className="cmp-props-list">
            {cols.map((s) => {
              const pct = systemCoveragePercent(s);
              return (
                <li key={s.slug}>
                  <span>{s.name}</span>
                  <span className="cmp-props-pct">{pct != null ? `${pct}%` : "—"}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="cmp-props-empty">Pick systems in the rail to compare them.</p>
        )}
      </div>
      <div className="cmp-props-block">
        <h3>View</h3>
        <p className="cmp-props-empty">
          {mode === "diff"
            ? "Token diff — every category, side by side."
            : "Component — the same demo rendered once per system's own tokens."}
        </p>
      </div>
    </div>
  );
}
