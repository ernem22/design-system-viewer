import { REFERENCE } from "../../../src/core/schema.js";
import type { Token } from "../systems/store.ts";
import { RefBadge } from "./rows.tsx";
import { schemaAnchor, type TokensViewModel } from "./useTokensView.ts";
import "./TokenGroup.css";
import "./SchemaView.css";

interface ReferenceGroup {
  id: string;
  label: string;
  tokens: string[];
}

/** Enter/Space on a schema row picks it. */
function schemaKeyDown(e: React.KeyboardEvent, onPick: () => void): void {
  if (e.key !== "Enter" && e.key !== " ") return;
  const target = e.target as HTMLElement | null;
  if (target && target.closest("button, input, select, textarea, a")) return;
  e.preventDefault();
  onPick();
}

/**
 * Schema checklist (old schemaView): every REFERENCE group with ✓/✗ per
 * token + the "Outside Schema" section for extras. Every row click selects
 * for the right-rail inspector (it never copies or edits in place): a present
 * token opens the inspector read state, a missing one opens its "Not set" /
 * Add-token state.
 */
export function SchemaView({
  view,
  onPick,
}: {
  view: TokensViewModel;
  onPick: (token: Token) => void;
}) {
  const { cov, valueMap, matchTok, selected } = view;
  const groups = REFERENCE as ReferenceGroup[];

  let shown = 0;
  const sections = groups.map((g) => {
    const names = g.tokens.filter(matchTok);
    if (!names.length) return null;
    shown += names.length;
    const covGroup = cov.groups.find((c) => c.id === g.id);
    const count = covGroup ? `${covGroup.present.length}/${covGroup.expected}` : `${names.length}`;
    return (
      <section className="tok-group" id={schemaAnchor(g.id)} key={g.id}>
        <h2>
          {g.label}
          <span>{count}</span>
        </h2>
        <div className="tok-tablewrap">
          {/* Shared column template (issue #312): table-layout: fixed sizes
              columns from this colgroup instead of each table's own content,
              so the value column starts at the same x in every group. The
              name track fits the longest schema name and wraps rather than
              ellipsizing; the value track takes the remainder. */}
          <table className="tok-raw" role="grid" aria-label={g.label}>
            <colgroup>
              <col className="tok-schema-col-name" />
              <col className="tok-schema-col-value" />
            </colgroup>
            <tbody>
              {names.map((name) => {
                const value = valueMap.get(name);
                const hit = value !== undefined;
                const token: Token = { name, value: value ?? "" };
                return (
                  <tr
                    key={name}
                    data-token={name}
                    aria-selected={selected?.name === name}
                    tabIndex={0}
                    title={
                      hit
                        ? "click to inspect and edit in the sidebar"
                        : "missing — click to add it in the sidebar"
                    }
                    onClick={() => onPick(token)}
                    onDoubleClick={() => onPick(token)}
                    onKeyDown={(e) => schemaKeyDown(e, () => onPick(token))}
                  >
                    <td className={hit ? "tok-yes" : "tok-no"}>
                      {hit ? "✓" : "✗"} {name}
                    </td>
                    <td>
                      {value ?? <span className="tok-missing-inline">— missing</span>}
                      {hit && <RefBadge value={value as string} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  });

  const extra = cov.extra.filter(matchTok);

  return (
    <div className="tok-schema">
      {sections}
      {extra.length > 0 && (
        <section className="tok-group">
          <h2>
            Outside Schema<span>{cov.extra.length}</span>
          </h2>
          <div className="tok-missing">
            Preview only ever reads the {cov.expected} names on this page — these render in the gallery but
            not there. Rename to the matching schema name to make them count.
          </div>
          <div className="tok-missing">{extra.map((n) => <code key={n}>{n}</code>)}</div>
        </section>
      )}
      {!shown && !extra.length && <div className="tok-empty">No tokens matching the filter.</div>}
    </div>
  );
}
