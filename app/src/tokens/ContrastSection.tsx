import { useEffect, useMemo, useRef } from "react";
import { CONTRAST_SECTION_ID, useContrastRows } from "./useContrastRows.ts";
import "./ContrastSection.css";

// Locale-shaped two-decimal ratio text via Intl (a bare toFixed hardcodes
// the en-US shape inline and bypasses the internationalisation API). The
// locale is pinned to en-US so the rendered ratio is stable on every machine
// — the suite pins "21.00" — rather than varying with the runtime locale.
const ratioFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * WCAG contrast check ported from the legacy viewer's appendContrast
 * (src/viewer/app.js). Ratios come from `useContrastRows` (hidden probe +
 * getComputedStyle, never raw string parsing). The section carries every
 * token as an inline custom property (like the legacy gallery wrap did), so
 * the chips resolve exactly this system even before App.tsx applies it to
 * :root, nor on effect ordering when switching systems.
 *
 * `values` is the same resolved per-token map the token panels display —
 * `tokenValueMap`'s css -> groups order — so the audit measures the
 * palette the user is actually shown.
 */
export function ContrastSection({ values }: { values: Map<string, string> }) {
  const sectionRef = useRef<HTMLElement>(null);
  const appliedRef = useRef<string[]>([]);
  const { rows, pairs } = useContrastRows(values);

  const names = useMemo(() => new Set(values.keys()), [values]);

  useEffect(() => {
    const sec = sectionRef.current;
    if (!sec) return;
    // Drop custom props for tokens removed since the last run, then carry
    // the current system (stale props would silently skew the chips).
    for (const n of appliedRef.current) if (!names.has(n)) sec.style.removeProperty(n);
    for (const [name, value] of values) sec.style.setProperty(name, value);
    appliedRef.current = [...values.keys()];
  }, [values, names]);

  if (pairs.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      id={CONTRAST_SECTION_ID}
      className="tok-group tok-contrast"
      aria-label="Accessibility contrast"
    >
      <h2>
        Accessibility / Contrast<span>WCAG AA · 4.5</span>
      </h2>
      <div className="tok-contrast-rows">
        {rows.map((r) => {
          const num = r.ratio == null ? "—" : ratioFormat.format(r.ratio);
          const title =
            r.ratio == null ? "could not calculate — color unresolved" : `ratio ${num}`;
          return (
            <div className="tok-contrast-row" key={`${r.fg}/${r.bg}`}>
              <div className="tok-contrast-label">
                <b>{r.label}</b>
                <span>
                  {r.fg} / {r.bg}
                </span>
              </div>
              <div className="tok-contrast-demo">
                <span
                  className="tok-contrast-chip"
                  style={{ color: `var(${r.fg})`, background: `var(${r.bg})` }}
                  aria-hidden="true"
                >
                  Aa
                </span>
                <span className="tok-contrast-num" title={title}>
                  {num}
                </span>
                <span className={`tok-contrast-badge ${r.tone}`}>{r.badge}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
