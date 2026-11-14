import { CompareColumn } from "./CompareColumn.tsx";
import { DiffTable } from "./DiffTable.tsx";
import { systemCoveragePercent } from "../systems/store.ts";
import type { CompareViewModel } from "./useCompareView.ts";
import "./compare.css";

/**
 * Compare tab main content: the comparison identity header plus either the
 * token-diff table or a side-by-side column per picked system. Which systems
 * are picked, the mode and the component live in the rail (CompareRail.tsx) —
 * this just names the result and renders it. Ported from
 * preview/src/compare.jsx's Compare screen, minus the iframe postMessage
 * bridge (preview/-only, see app/CLAUDE.md). Querystring mirroring lives in
 * lib/urlState.ts: useCompareView inits picked/mode/componentId from it and
 * App's sync effect writes them back.
 */
export function CompareView({ view, loading = false }: { view: CompareViewModel; loading?: boolean }) {
  const { mode, cols, active, styleFor } = view;
  const reference = cols[0];

  return (
    <div className="cmp-wrap">
      <header className="cmp-header">
        <h2 className="cmp-title">
          {mode === "diff" ? (
            "Token diff"
          ) : (
            <>
              Comparing: <span className="cmp-title-name">{active?.label ?? "—"}</span>
            </>
          )}
        </h2>
        <div className="cmp-meta">
          {reference && (
            <span className="cmp-meta-ref">
              Reference: <strong>{reference.name}</strong>
            </span>
          )}
          <span className="cmp-meta-count">
            {cols.length} system{cols.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      {loading ? (
        <p className="app-placeholder app-loading">Loading systems…</p>
      ) : cols.length < 2 ? (
        <p className="app-placeholder" style={{ padding: "var(--space-5)" }}>
          Select at least 2 systems in the rail to compare them. The first pick is the reference.
        </p>
      ) : mode === "diff" ? (
        <DiffTable cols={cols} />
      ) : active ? (
        <div className="cmp-cols" data-count={cols.length}>
          {cols.map((s, i) => (
            <CompareColumn
              key={s.slug}
              slug={s.slug}
              name={s.name}
              style={styleFor.get(s.slug) ?? {}}
              pct={systemCoveragePercent(s)}
              option={active}
              reference={i === 0}
            />
          ))}
        </div>
      ) : (
        <p className="app-placeholder" style={{ padding: "var(--space-5)" }}>
          No comparable components yet.
        </p>
      )}
    </div>
  );
}
