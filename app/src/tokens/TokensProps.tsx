import { coveragePercent } from "../systems/store.ts";
import { RefBadge } from "./rows.tsx";
import { isRef } from "./tokenUtils.ts";
import type { TokensViewModel } from "./useTokensView.ts";
import "./TokensProps.css";

/**
 * Right rail for the Tokens tab: coverage summary (the old toolbar ring, as
 * a compact block) + the clicked token's inspector + lint summary. Nothing
 * to inspect yet → coverage + warnings only.
 */
export function TokensProps({ view }: { view: TokensViewModel }) {
  const { cov, selected, warnings, copyToken } = view;
  const pct = coveragePercent(cov) ?? 0;
  const tone = pct >= 80 ? "ok" : pct >= 50 ? "warn" : "bad";

  return (
    <div className="tok-props">
      <div className="tok-props-block">
        <h3>Coverage</h3>
        <div className="tok-cov">
          <span className={`tok-cov-ring tok-cov-${tone}`} role="img" aria-label={`${pct}% of schema tokens present`}>
            <svg viewBox="0 0 36 36" aria-hidden="true">
              <circle className="tok-rr-track" cx="18" cy="18" r="15.5" pathLength={100} />
              <circle
                className="tok-rr-val"
                cx="18"
                cy="18"
                r="15.5"
                pathLength={100}
                strokeDasharray={`${pct} 100`}
                transform="rotate(-90 18 18)"
              />
            </svg>
            <b>
              {pct}
              <i>%</i>
            </b>
          </span>
          <span className="tok-cov-text">
            <b>
              {cov.present}/{cov.expected}
            </b>{" "}
            tokens · <b className={cov.missing ? "tok-miss" : "tok-zero"}>{cov.missing}</b> missing ·{" "}
            <b className={cov.extraCount ? "tok-extra" : "tok-zero"}>{cov.extraCount}</b> extra
          </span>
        </div>
      </div>

      <div className="tok-props-block">
        <h3>Token</h3>
        {selected ? (
          <div className="tok-inspector">
            <code className="tok-inspector-name">{selected.name}</code>
            <code className="tok-inspector-value">{selected.value}</code>
            <div className="tok-inspector-meta">
              {isRef(selected.value) ? (
                <span>
                  references another token <RefBadge value={selected.value} />
                </span>
              ) : (
                <span>raw value</span>
              )}
            </div>
            <button className="tok-btn" onClick={() => copyToken(selected)}>
              Copy `--name: value;`
            </button>
          </div>
        ) : (
          <p className="tok-props-empty">Click a token in the gallery to inspect it here.</p>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="tok-props-block">
          <h3>Value warnings · {warnings.length}</h3>
          <ul className="tok-warn-list">
            {warnings.slice(0, 8).map((w) => (
              <li key={w.name} title={w.msg}>
                <code>{w.name}</code>
              </li>
            ))}
          </ul>
          {warnings.length > 8 && <p className="tok-props-empty">+{warnings.length - 8} more in the gallery</p>}
        </div>
      )}
    </div>
  );
}
