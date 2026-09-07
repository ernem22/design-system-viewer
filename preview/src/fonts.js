// Shared by useSystemTokens.js (dynamic Google Fonts loading) and App.jsx
// (the "not bundled" note) — both need the same list of font family names a
// system actually references.
const GENERIC_FONT = /^(sans-serif|serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|-apple-system|blinkmacsystemfont|inherit|initial|cursive|fantasy|math|emoji)$/i;

/**
 * Distinct, non-generic font-family names named by any --font-* token.
 * @param {string} css
 * @returns {string[]}
 */
export function fontFamiliesIn(css) {
  if (!css) return [];
  return [...css.matchAll(/--font-[\w-]*(?:sans|serif|mono|family|body|heading|display|ui)[\w-]*\s*:\s*([^;{}]+)/gi)]
    .map((m) => m[1].split(",")[0].trim().replace(/^["']|["']$/g, ""))
    .filter((f, i, a) => f && !GENERIC_FONT.test(f) && a.findIndex((x) => x.toLowerCase() === f.toLowerCase()) === i);
}
