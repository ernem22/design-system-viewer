import { useCallback } from "react";
import type { DesignSystem } from "../systems/store.ts";
import { download, systemToCss } from "./export.ts";
import { ContrastSection } from "./ContrastSection.tsx";
import { SchemaView } from "./SchemaView.tsx";
import { TokenGroup } from "./TokenGroup.tsx";
import { TokenToolbar } from "./TokenToolbar.tsx";
import type { TokensViewModel } from "./useTokensView.ts";
import { groupAnchor } from "./useTokensView.ts";
import "./TokensView.css";

/**
 * Tokens tab main column: lint row + toolbar + gallery/schema.
 * Click a token = copy + select it for the right-rail inspector; Update (or
 * double-click) opens the inline editor popover for that row.
 */
export function TokensView({
  system,
  view,
  onDelete,
  onMerge,
  onPatch,
}: {
  system: DesignSystem;
  view: TokensViewModel;
  onDelete: (slug: string) => void;
  onMerge: (css: string) => void;
  onPatch: (name: string, value: string) => void;
}) {
  const {
    warnings,
    visibleGroups,
    absentGroups,
    shownCount,
    searching,
    schemaMode,
    filter,
    pushToast,
    copyToken,
    editingName,
    onEdit,
  } = view;

  // Stable identity (like copyToken): the memo()'d row renderers receive
  // this, so it must not be a fresh closure every render.
  const handleSave = useCallback(
    (name: string, value: string) => {
      try {
        onPatch(name, value);
        pushToast(`${name} updated`, "ok");
      } catch (e) {
        pushToast(`Save failed: ${e instanceof Error ? e.message : String(e)}`, "err");
      }
    },
    [onPatch, pushToast],
  );

  return (
    <div className="tok-view">
      {warnings.length > 0 && (
        <details className="tok-warns">
          <summary>⚠ {warnings.length} possible value issues</summary>
          {warnings.map((w) => (
            <div key={w.name}>
              <code>
                {w.name}: {w.value}
              </code>{" "}
              — {w.msg}
            </div>
          ))}
        </details>
      )}
      <TokenToolbar
        view={view}
        system={system}
        onMerge={onMerge}
        onExportCss={() => download(`${system.slug}.css`, systemToCss(system), "text/css")}
        onExportJson={() =>
          download(`${system.slug}.json`, JSON.stringify(system, null, 2), "application/json")
        }
        onDelete={() => {
          onDelete(system.slug);
        }}
      />
      {schemaMode ? (
        <SchemaView
          view={view}
          onPick={copyToken}
          editingName={editingName}
          onEdit={onEdit}
          onSave={handleSave}
        />
      ) : (
        <div className="tok-gallery">
          {visibleGroups.map((v) => (
            <TokenGroup
              key={v.group.id}
              visible={v}
              showMissing={view.showMissing}
              selectedName={view.selected?.name ?? null}
              onPick={copyToken}
              editingName={editingName}
              onEdit={onEdit}
              onSave={handleSave}
            />
          ))}
          {view.showMissing &&
            absentGroups.map((g) => (
              <section className="tok-group" id={groupAnchor(g.id)} key={g.id}>
                <h2>
                  {g.label}
                  <span>0/{g.expected}</span>
                </h2>
                <div className="tok-missing">
                  missing: {g.missing.map((n) => <code key={n}>{n}</code>)}
                </div>
              </section>
            ))}
          {searching && !shownCount && (
            <div className="tok-empty">
              No tokens matching “<b>{filter.trim()}</b>”.
            </div>
          )}
          {/* Contrast is global to the system, not to the filter — legacy
              appendContrast only ran filter-less (and never in schema mode,
              which this branch already excludes). It reads the resolved
              value map, so a system's dark variant is measured too. */}
          {!searching && <ContrastSection values={view.valueMap} />}
        </div>
      )}
    </div>
  );
}
