import { useMemo } from "react";
import { lintTokens, parseTokens } from "../../../src/core/parse.js";
import { coverage } from "../../../src/core/schema.js";
import type { Token } from "../systems/store.ts";
import type { CoverageInfo, LintWarning } from "./useTokensView.ts";

/**
 * Live summary under a paste box (legacy updatePreview): pasted count,
 * coverage of the combined name set (`baseCss` = the system being merged
 * into, empty for a new system), extras that Preview won't read, value
 * warnings and the missing-token list.
 */
export function CssPreview({ css, baseCss = "" }: { css: string; baseCss?: string }) {
  const preview = useMemo(() => {
    if (!css.trim()) return null;
    const base = baseCss ? (parseTokens(baseCss) as Token[]) : [];
    const pasted = parseTokens(css) as Token[];
    const names = new Set([...base, ...pasted].map((t) => t.name));
    return {
      added: pasted.length,
      cov: coverage([...names]) as CoverageInfo,
      lint: lintTokens(pasted) as LintWarning[],
    };
  }, [css, baseCss]);

  if (!preview) {
    return (
      <div className="tok-dialog-preview" aria-live="polite">
        <p className="tok-dialog-meta">Awaiting CSS block…</p>
      </div>
    );
  }
  const { added, cov, lint } = preview;
  const missingGroups = cov.groups.filter((g) => g.missing.length);
  return (
    <div className="tok-dialog-preview" aria-live="polite">
      <b>{added}</b> tokens pasted · coverage{" "}
      <b className={cov.missing ? "" : "ok"}>
        {cov.present}/{cov.expected}
      </b>{" "}
      · {cov.missing ? <span className="warn">{cov.missing} missing</span> : <span className="ok">complete</span>}
      {cov.extraCount > 0 && <span className="warn"> · {cov.extraCount} extra</span>}
      {lint.length > 0 && <span className="warn"> · {lint.length} value warnings</span>}
      {cov.extraCount > 0 && (
        <details>
          <summary className="warn">extra — won&apos;t render in Preview</summary>
          <div>
            Preview only reads the {cov.expected} schema names (see Schema view). Rename these to match, or
            they&apos;ll just sit unused:
          </div>
          {cov.extra.map((n) => (
            <code key={n}>{n}</code>
          ))}
        </details>
      )}
      {lint.length > 0 && (
        <details open>
          <summary className="warn">value warnings</summary>
          {lint.map((w) => (
            <div key={w.name}>
              <code>
                {w.name}: {w.value}
              </code>{" "}
              — {w.msg}
            </div>
          ))}
        </details>
      )}
      {missingGroups.length > 0 && (
        <details>
          <summary>missing token list</summary>
          {missingGroups.map((g) => (
            <div key={g.id}>
              <div className="tok-dialog-grp">
                {g.label} — {g.present.length}/{g.expected}
              </div>
              {g.missing.map((n) => (
                <code key={n}>{n}</code>
              ))}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
