// Shared by useSystemTokens.js (dynamic Google Fonts loading) and App.jsx
// (the "not bundled" note) — both need the same list of font family names a
// system actually references.
const GENERIC_FONT = /^(sans-serif|serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|-apple-system|blinkmacsystemfont|inherit|initial|cursive|fantasy|math|emoji)$/i;

/**
 * A plausible webfont family name: starts with a letter, then letters,
 * digits, spaces or hyphens. Rejects sizes (2.5rem, 16px), var() refs,
 * shorthands (16px/1.5) and anything with quotes/backslashes — any of those
 * in a Google Fonts URL poisons the whole request (400, no fonts at all).
 */
const FAMILY_NAME = /^[A-Za-z][A-Za-z0-9 \-]*$/;

/**
 * Distinct, non-generic font-family names named by any --font-* token.
 * Size tokens (--font-size-*, --font-*-display-* sizes) are skipped by name;
 * whatever slips through is rejected by the value check below.
 * @param {string} css
 * @returns {string[]}
 */
export function fontFamiliesIn(css) {
  if (!css) return [];
  return [...css.matchAll(/--(font-[\w-]*(?:sans|serif|mono|family|body|heading|display|ui)[\w-]*)\s*:\s*([^;{}]+)/gi)]
    .filter((m) => !/size/i.test(m[1]))
    // strip quotes, collapse inner whitespace ("DM   Serif" → "DM Serif"):
    // double spaces would encode as "++" and Google 400s those too
    .map((m) => m[2].split(",")[0].trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " "))
    .filter((f, i, a) => f && FAMILY_NAME.test(f) && !GENERIC_FONT.test(f) && a.findIndex((x) => x.toLowerCase() === f.toLowerCase()) === i);
}
