/* CSS value equality for the compare token diff (issue #281).
   Compares values after a normalisation that only removes notation
   differences CSS treats as equal. The table still displays each system's
   value exactly as authored; only the same/different decision changes. */

const HEX_IN_VALUE = /#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

/* `<length>` units. Time (`s`, `ms`), angle (`deg`, `grad`, `rad`, `turn`)
   and everything else are deliberately absent: `0` and `0ms` stay different. */
const LENGTH_UNITS = new Set([
  "px",
  "rem",
  "em",
  "rex",
  "rcap",
  "rch",
  "ex",
  "cap",
  "ch",
  "ic",
  "lh",
  "rlh",
  "vb",
  "vi",
  "vw",
  "vh",
  "vmin",
  "vmax",
  "svw",
  "svh",
  "svb",
  "svi",
  "svmin",
  "svmax",
  "lvw",
  "lvh",
  "lvb",
  "lvi",
  "lvmin",
  "lvmax",
  "dvw",
  "dvh",
  "dvb",
  "dvi",
  "dvmin",
  "dvmax",
  "cqw",
  "cqh",
  "cqi",
  "cqb",
  "cqmin",
  "cqmax",
  "cm",
  "mm",
  "q",
  "in",
  "pc",
  "pt",
]);

const ZERO_WITH_UNIT = /^([+-]?0+(?:\.0+)?)([a-z%]+)?$/i;

function expandHex(digits: string): string {
  const hex = digits.toLowerCase();
  if (hex.length === 3 || hex.length === 4) {
    return `#${[...hex].map((c) => c + c).join("")}`;
  }
  return `#${hex}`;
}

export function normalizeCssValue(value: string): string {
  let s = value.trim().replace(/\s+/g, " ");
  // Hex colour case and 3-/4-digit shorthand; embedded occurrences too.
  s = s.replace(HEX_IN_VALUE, (m) => expandHex(m.slice(1)));
  // A leading zero on decimals: `.5rem` -> `0.5rem`, `-.5rem` -> `-0.5rem`.
  // The lookbehind keeps `0.5` (and version-like `1.5`) untouched.
  s = s.replace(/(?<![\w.])\.(\d)/g, "0.$1");
  // A zero length with or without a unit is `0`; times/angles are not.
  const zero = s.match(ZERO_WITH_UNIT);
  if (zero && (!zero[2] || LENGTH_UNITS.has(zero[2].toLowerCase()))) return "0";
  return s;
}

export function cssValueEq(a: string, b: string): boolean {
  return normalizeCssValue(a) === normalizeCssValue(b);
}
