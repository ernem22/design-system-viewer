import { useEffect, useMemo, useRef, useState } from "react";
import { contrastRatio, rating, CONTRAST_PAIRS } from "../../../src/core/contrast.js";
import type { Token } from "../systems/store.ts";
import "./ContrastSection.css";

type ContrastPair = [fg: string, bg: string, label: string];

/** Root src/core/* is imported untyped on purpose (allowJs, checkJs off). */
const PAIRS = CONTRAST_PAIRS as ContrastPair[];

interface ContrastRow {
  fg: string;
  bg: string;
  label: string;
  ratio: number | null;
  badge: string;
  tone: "yes" | "mid" | "no";
}

/**
 * WCAG contrast check ported from the legacy viewer's appendContrast
 * (src/viewer/app.js). Ratios are resolved through a hidden probe +
 * getComputedStyle — never by re-parsing raw token strings — so
 * var()-referencing tokens, color-mix(), oklch, etc. resolve exactly as
 * the browser renders them. The section carries every token as an inline
 * custom property (like the legacy gallery wrap did), so measurement does
 * not depend on whatever tokens App.tsx has applied to :root, nor on
 * effect ordering when switching systems.
 */
export function ContrastSection({ tokens }: { tokens: Token[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const appliedRef = useRef<string[]>([]);
  const [rows, setRows] = useState<ContrastRow[]>([]);

  const names = useMemo(() => new Set(tokens.map((t) => t.name)), [tokens]);
  // Only pairs whose tokens the system actually defines — legacy skipped
  // the whole section when no pair was fully present, this returns null.
  const pairs = useMemo(
    () => PAIRS.filter(([fg, bg]) => names.has(fg) && names.has(bg)),
    [names],
  );

  useEffect(() => {
    const sec = sectionRef.current;
    if (!sec || pairs.length === 0) {
      setRows([]);
      return;
    }
    // Drop custom props for tokens removed since the last run, then carry
    // the current system (stale props would silently skew ratios).
    for (const n of appliedRef.current) if (!names.has(n)) sec.style.removeProperty(n);
    for (const t of tokens) sec.style.setProperty(t.name, t.value);
    appliedRef.current = tokens.map((t) => t.name);

    const probe = document.createElement("span");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden";
    sec.appendChild(probe);
    const cs = getComputedStyle(probe);
    const next: ContrastRow[] = pairs.map(([fg, bg, label]) => {
      probe.style.color = `var(${fg})`;
      probe.style.backgroundColor = `var(${bg})`;
      const ratio = contrastRatio(cs.color, cs.backgroundColor) as number | null;
      const rt = rating(ratio) as { label: string; pass: boolean | "large" | null };
      return {
        fg,
        bg,
        label,
        ratio,
        badge: rt.label,
        tone: rt.pass === true ? "yes" : rt.pass === "large" ? "mid" : "no",
      };
    });
    probe.remove();
    setRows(next);
  }, [tokens, names, pairs]);

  if (pairs.length === 0) return null;

  return (
    <section ref={sectionRef} className="tok-group tok-contrast" aria-label="Accessibility contrast">
      <h2>
        Accessibility / Contrast<span>WCAG AA · 4.5</span>
      </h2>
      <div className="tok-contrast-rows">
        {rows.map((r) => {
          const num = r.ratio == null ? "—" : r.ratio.toFixed(2);
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
