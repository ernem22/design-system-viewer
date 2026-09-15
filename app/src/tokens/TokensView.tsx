import type { DesignSystem } from "../systems/store.ts";
import { download, systemToCss } from "./export.ts";
import { SchemaView } from "./SchemaView.tsx";
import { TokenGroup } from "./TokenGroup.tsx";
import { TokenToolbar } from "./TokenToolbar.tsx";
import type { TokensViewModel } from "./useTokensView.ts";
import { groupAnchor } from "./useTokensView.ts";
import "./TokensView.css";

/**
 * Tokens tab main column: lint row + toolbar + gallery/schema + toasts.
 * Click a token = copy + select it for the right-rail inspector (the Update
 * affordance returns with the inline-editor pass).
 */
export function TokensView({
  system,
  view,
  onDelete,
}: {
  system: DesignSystem;
  view: TokensViewModel;
  onDelete: (slug: string) => void;
}) {
  const { warnings, visibleGroups, absentGroups, shownCount, searching, schemaMode, filter, toasts, pushToast, copyToken } =
    view;

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
        onExportCss={() => download(`${system.slug}.css`, systemToCss(system), "text/css")}
        onExportJson={() =>
          download(`${system.slug}.json`, JSON.stringify(system, null, 2), "application/json")
        }
        onDelete={() => {
          onDelete(system.slug);
          pushToast("System deleted", "ok");
        }}
      />
      {schemaMode ? (
        <SchemaView view={view} onPick={copyToken} />
      ) : (
        <div className="tok-gallery">
          {visibleGroups.map((v) => (
            <TokenGroup
              key={v.group.id}
              visible={v}
              showMissing={view.showMissing}
              selectedName={view.selected?.name ?? null}
              onPick={copyToken}
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
        </div>
      )}
      <div className="tok-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`tok-toast tok-toast-${t.tone}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
