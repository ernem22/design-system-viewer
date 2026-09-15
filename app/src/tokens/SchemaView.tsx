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

/**
 * Schema checklist (old schemaView): every REFERENCE group with ✓/✗ per
 * token + the "Outside Schema" section for extras. Row click selects +
 * copies; Add/Update entry points arrive with the dialog pass.
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
          <table className="tok-raw">
            <tbody>
              {names.map((name) => {
                const value = valueMap.get(name);
                const hit = value !== undefined;
                return (
                  <tr
                    key={name}
                    data-token={name}
                    aria-selected={selected?.name === name || undefined}
                    title={hit ? "click to copy" : "missing — Add to create it"}
                    onClick={() => hit && onPick({ name, value: value as string })}
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
