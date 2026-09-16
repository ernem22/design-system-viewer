import { useMemo } from "react";
import * as Toggle from "@radix-ui/react-toggle";
import { CompareColumn } from "./CompareColumn.tsx";
import { DiffTable } from "./DiffTable.tsx";
import { useGoogleFonts } from "../lib/googleFonts.ts";
import { coveragePercent } from "../systems/store.ts";
import type { CompareViewModel } from "./useCompareView.ts";
import "./compare.css";

/**
 * Compare tab main content: mode toggle + either the token-diff table or a
 * side-by-side column per picked system. Which systems and which component
 * are picked lives in the rail (CompareRail.tsx) — this just renders the
 * result. Ported from preview/src/compare.jsx's Compare screen, minus the
 * iframe postMessage bridge (preview/-only, see app/CLAUDE.md). Querystring
 * mirroring lives in lib/urlState.ts: useCompareView inits picked/mode/
 * componentId from it and App's sync effect writes them back.
 */
export function CompareView({ view }: { view: CompareViewModel }) {
  const { mode, setMode, cols, active, styleFor, picked, maxColumns } = view;

  // Dynamic Google Fonts for the compared systems' --font-* families (keyed
  // on the picked columns' raw css so switching/adding compare systems — or
  // token edits that change a family — swaps fonts). Stale links are removed
  // inside loadGoogleFonts, like the main view's useGoogleFonts in App.tsx.
  // Ported from preview/src/compare.jsx (never import preview/).
  const compareCss = useMemo(() => cols.map((s) => s.css).join("\n"), [cols]);
  useGoogleFonts(compareCss);

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
