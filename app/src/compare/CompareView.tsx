import * as Toggle from "@radix-ui/react-toggle";
import { CompareColumn } from "./CompareColumn.tsx";
import { DiffTable } from "./DiffTable.tsx";
import { coveragePercent } from "../systems/store.ts";
import type { CompareViewModel } from "./useCompareView.ts";
import "./compare.css";

/**
 * Compare tab main content: mode toggle + either the token-diff table or a
 * side-by-side column per picked system. Which systems and which component
 * are picked lives in the rail (CompareRail.tsx) — this just renders the
 * result. Ported from preview/src/compare.jsx's Compare screen, minus the
 * iframe postMessage bridge (preview/-only, see app/CLAUDE.md) and the
 * querystring mirroring (separate URL-state issue — TODO once that lands,
 * mirror `mode`/`picked`/`componentId` the way useTokensView will for its
 * own tab).
 */
export function CompareView({ view }: { view: CompareViewModel }) {
  const { mode, setMode, cols, active, styleFor, picked, maxColumns } = view;

  return (
    <div className="cmp-wrap">
      <header className="cmp-toolbar">
        <div className="cmp-seg">
          <Toggle.Root pressed={mode === "component"} onPressedChange={(on) => on && setMode("component")}>
            Component
          </Toggle.Root>
          <Toggle.Root pressed={mode === "diff"} onPressedChange={(on) => on && setMode("diff")}>
            Token diff
          </Toggle.Root>
        </div>
        <span className="cmp-hint">
          {picked.length}/{maxColumns} selected
        </span>
      </header>

      {cols.length < 2 ? (
        <p className="app-placeholder" style={{ padding: "var(--space-5)" }}>
          Select at least 2 systems in the rail to compare them.
        </p>
      ) : mode === "diff" ? (
        <DiffTable cols={cols} />
      ) : active ? (
        <div className="cmp-cols" data-count={cols.length}>
          {cols.map((s) => (
            <CompareColumn
              key={s.slug}
              name={s.name}
              style={styleFor.get(s.slug) ?? {}}
              pct={coveragePercent(s.coverage)}
              option={active}
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
