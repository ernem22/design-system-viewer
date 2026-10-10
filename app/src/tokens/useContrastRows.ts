import { useEffect, useMemo, useState } from "react";
import { contrastRatio, rating, CONTRAST_PAIRS } from "../../../src/core/contrast.js";

export type ContrastPair = [fg: string, bg: string, label: string];

/** Root src/core/* is imported untyped on purpose (allowJs, checkJs off). */
const PAIRS = CONTRAST_PAIRS as ContrastPair[];

export interface ContrastRow {
  fg: string;
  bg: string;
  label: string;
  ratio: number | null;
  badge: string;
  tone: "yes" | "mid" | "no";
}

/**
 * Anchor id of the gallery's contrast section. The Tokens panel's Health
 * block scrolls the content region to this id (through `.app-main`, never
 * `scrollIntoView` — see app/CLAUDE.md), so the target needs a stable id.
 */
export const CONTRAST_SECTION_ID = "tok-contrast";

/** One-flight cache so the gallery section and the Health summary share a
 *  single probe measurement per token map instead of measuring twice. */
const rowsCache = new WeakMap<Map<string, string>, ContrastRow[]>();
const NO_ROWS: ContrastRow[] = [];

/**
 * WCAG contrast rows for `values`, measured through a hidden probe +
 * getComputedStyle — never by re-parsing raw token strings — so
 * var()-referencing tokens, color-mix(), oklch, etc. resolve exactly as
 * the browser renders them. Memoised on `values`: the same map returns the
 * cached rows, so `ContrastSection` and the Tokens Health block share one
 * measurement per system.
 *
 * `values` is the same resolved per-token map the token panels display —
 * `tokenValueMap`'s css -> groups order — so the audit measures the
 * palette the user is actually shown.
 */
export function useContrastRows(values: Map<string, string>): {
  rows: ContrastRow[];
  pairs: ContrastPair[];
} {
  const names = useMemo(() => new Set(values.keys()), [values]);
  // Only pairs whose tokens the system actually defines — legacy skipped
  // the whole section when no pair was fully present, this returns none.
  const pairs = useMemo(
    () => PAIRS.filter(([fg, bg]) => names.has(fg) && names.has(bg)),
    [names],
  );
  const [rows, setRows] = useState<ContrastRow[]>(() => rowsCache.get(values) ?? NO_ROWS);

  useEffect(() => {
    const cached = rowsCache.get(values);
    if (cached) {
      setRows(cached);
      return;
    }
    if (pairs.length === 0) {
      setRows(NO_ROWS);
      return;
    }
    // A detached host carrying the current system: measurement must not
    // depend on whatever tokens App.tsx has applied to :root, nor on
    // effect ordering when switching systems.
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden";
    for (const [name, value] of values) host.style.setProperty(name, value);
    document.body.appendChild(host);
    const probe = document.createElement("span");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden";
    host.appendChild(probe);
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
    host.remove();
    rowsCache.set(values, next);
    setRows(next);
  }, [values, pairs]);

  return { rows, pairs };
}
