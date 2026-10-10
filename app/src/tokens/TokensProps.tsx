import { useMemo } from "react";
import { coveragePercent } from "../systems/store.ts";
import { RefBadge } from "./rows.tsx";
import { TokenEditForm } from "./InlineEditor.tsx";
import "./InlineEditor.css";
import { isRef } from "./tokenUtils.ts";
import type { TokensViewModel } from "./useTokensView.ts";
import { CONTRAST_SECTION_ID, useContrastRows } from "./useContrastRows.ts";
import { categorize } from "../../../src/core/taxonomy.js";
import "./TokensProps.css";

/** Shared empty map for stub views (older tests build a view without
 *  tokens/valueMap): a stable reference keeps the contrast hook memoised. */
const EMPTY_VALUES = new Map<string, string>();

/**
 * Scroll the one shared content scroller (`.app-main`) to `el` without
 * moving the chrome. `scrollIntoView` walks every scrollable ancestor, so
 * it is not an in-app scroll primitive (see app/CLAUDE.md).
 */
function scrollMainTo(el: HTMLElement | null): boolean {
  if (!el) return false;
  const scroller = document.querySelector<HTMLElement>(".app-main");
  if (!scroller) return false;
  const margin = Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const top =
    el.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top +
    scroller.scrollTop -
    margin;
  scroller.scrollTo({ top });
  return true;
}

const scrollToContrast = (): boolean =>
  scrollMainTo(document.getElementById(CONTRAST_SECTION_ID));

const scrollToWarnings = (): boolean =>
  scrollMainTo(document.querySelector<HTMLElement>(".tok-warns"));

/** Font-stack tokens: the taxonomy's font-family category (covers both
 *  `--font-family-*` and the `--font-sans/serif/mono/display` shorthand
 *  the stored systems actually use). */
const isFamilyToken = (bare: string): boolean =>
  bare.includes("font-family") ||
  bare.includes("typeface") ||
  bare.includes("font-stack") ||
  /(^|-)font-(sans|serif|mono|body|heading|display|ui)$/.test(bare);

/** First family of a stack (`"Satoshi", fallback, sans-serif` → `Satoshi`). */
const firstFamily = (value: string): string =>
  value
    .split(",")[0]
    ?.trim()
    .replace(/^["']+|["']+$/g, "")
    .trim() ?? "";

/**
 * Right rail for the Tokens tab: coverage summary (the old toolbar ring, as
 * a compact block) + a system Health summary + the clicked token's
 * inspector + lint summary. Nothing to inspect yet → coverage + health +
 * warnings only; once a token is picked the inspector keeps the top of the
 * panel and Health folds into a collapsed details under it. The inspector
 * hosts the edit form: saving goes through `onPatch` with the same
 * "`--x updated`" toast the gallery popover used to show.
 */
export function TokensProps({
  view,
  onPatch,
}: {
  view: TokensViewModel;
  onPatch: (name: string, value: string) => void;
}) {
  const { cov, selected, warnings, tokens, valueMap, copyToken, editingName, onEdit, pushToast } =
    view;
  const pct = coveragePercent(cov) ?? 0;
  const tone = pct >= 80 ? "ok" : pct >= 50 ? "warn" : "bad";

  // Health inputs share the gallery's own sources: the resolved value map
  // (fonts), the parsed token list by taxonomy kind, and the same probe
  // measurement + pairs as ContrastSection (via the shared hook result, so
  // contrast is computed once per system).
  const values = valueMap ?? EMPTY_VALUES;
  const { rows: contrastRows, pairs: contrastPairs } = useContrastRows(values);
  const contrastPass = useMemo(
    () => contrastRows.filter((r) => r.tone === "yes").length,
    [contrastRows],
  );
  const families = useMemo(() => {
    const seen: string[] = [];
    for (const [name, value] of values) {
      if (!isFamilyToken(name.replace(/^--/, ""))) continue;
      const first = firstFamily(value);
      if (first && !seen.includes(first)) seen.push(first);
    }
    return seen;
  }, [values]);
  const kindsText = useMemo(() => {
    const counts = { color: 0, type: 0, length: 0, shadow: 0, motion: 0, other: 0 };
    for (const group of categorize(tokens ?? []) as { kind: string; tokens: unknown[] }[]) {
      if (group.kind === "color") counts.color += group.tokens.length;
      else if (group.kind === "type") counts.type += group.tokens.length;
      else if (group.kind === "length") counts.length += group.tokens.length;
      else if (group.kind === "shadow") counts.shadow += group.tokens.length;
      else if (group.kind === "motion") counts.motion += group.tokens.length;
      else counts.other += group.tokens.length;
    }
    return (
      `${counts.color} color · ${counts.type} type · ` +
      `${counts.length} size & spacing · ${counts.shadow} shadow · ` +
      `${counts.motion} motion · ${counts.other} other`
    );
  }, [tokens]);

  const healthRows = (
    <div className="tok-health">
      <div className="tok-health-row">
        <span className="tok-health-label">Contrast</span>
        <button type="button" className="tok-health-link" onClick={scrollToContrast}>
          {contrastPass} of {contrastPairs.length} pairs pass AA
        </button>
      </div>
      <div className="tok-health-row">
        <span className="tok-health-label">Value warnings</span>
        {warnings.length > 0 ? (
          <button type="button" className="tok-health-link" onClick={scrollToWarnings}>
            {warnings.length} {warnings.length === 1 ? "warning" : "warnings"}
          </button>
        ) : (
          <span className="tok-health-value">None</span>
        )}
      </div>
      <div className="tok-health-row">
        <span className="tok-health-label">Fonts</span>
        <span className="tok-health-value">
          {families.length > 0 ? families.join(" · ") : "—"}
        </span>
      </div>
      <div className="tok-health-row">
        <span className="tok-health-label">Tokens by kind</span>
        <span className="tok-health-value">{kindsText}</span>
      </div>
    </div>
  );

  return (
    <div className="tok-props">
      <div className="tok-props-block">
        <h3>Coverage</h3>
        <div className="tok-cov">
          <span className={`tok-cov-ring tok-cov-${tone}${pct >= 100 ? " tok-cov-3dig" : ""}`} role="img" aria-label={`${pct}% of schema tokens present`}>
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

      {!selected && (
        <div className="tok-props-block">
          <h3>Health</h3>
          {healthRows}
        </div>
      )}

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
            <TokenEditForm
              key={selected.name}
              token={selected}
              autoFocus={editingName === selected.name}
              onSave={(name, value) => {
                try {
                  onPatch(name, value);
                  pushToast(`${name} updated`, "ok");
                } catch (e) {
                  pushToast(`Save failed: ${e instanceof Error ? e.message : String(e)}`, "err");
                }
                onEdit(null);
              }}
              onCancel={() => onEdit(null)}
            />
          </div>
        ) : (
          <p className="tok-props-empty">Click a token in the gallery to inspect it here.</p>
        )}
      </div>

      {selected && (
        <details className="tok-health-fold">
          <summary>Health</summary>
          {healthRows}
        </details>
      )}

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
