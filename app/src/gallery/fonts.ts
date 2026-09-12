// Font families a system actually references — pulled from Google Fonts at
// runtime since systems name real webfonts but ship no @font-face.
const GENERIC_FONT =
  /^(sans-serif|serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|-apple-system|blinkmacsystemfont|inherit|initial|cursive|fantasy|math|emoji)$/i;

/**
 * A plausible webfont family name: starts with a letter, then letters,
 * digits, spaces or hyphens. Rejects sizes (2.5rem, 16px), var() refs,
 * shorthands (16px/1.5) and anything with quotes/backslashes — any of those
 * in a Google Fonts URL poisons the whole request (400, no fonts at all).
 */
const FAMILY_NAME = /^[A-Za-z][A-Za-z0-9 -]*$/;

const FONT_LINK_ATTR = "data-app-font";

const familyHref = (f: string): string =>
  "https://fonts.googleapis.com/css2?" +
  `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700` +
  "&display=swap";

// Google matches family names case-sensitively ("inter" 400s, "Inter" 200s),
// and pasted CSS often gets the casing wrong. One automatic correction attempt.
const titleCase = (f: string): string =>
  f
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

function addFontLink(fam: string): void {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.setAttribute(FONT_LINK_ATTR, "");
  link.dataset.fam = fam;
  link.onerror = () => {
    link.remove();
    const fixed = titleCase(fam);
    if (fixed !== fam && !document.querySelector(`link[${FONT_LINK_ATTR}][data-fam="${CSS.escape(fixed)}"]`)) {
      // single retry with corrected casing; its own failure just removes it
      const retry = document.createElement("link");
      retry.rel = "stylesheet";
      retry.setAttribute(FONT_LINK_ATTR, "");
      retry.dataset.fam = fixed;
      retry.onerror = () => retry.remove();
      retry.href = familyHref(fixed);
      document.head.appendChild(retry);
    }
  };
  link.href = familyHref(fam);
  document.head.appendChild(link);
}

/**
 * Distinct, non-generic font-family names named by any --font-* token.
 * Size tokens (--font-size-*, --font-*-display-* sizes) are skipped by name;
 * whatever slips through is rejected by the value check below.
 */
export function fontFamiliesIn(css: string | null | undefined): string[] {
  if (!css) return [];
  return [...css.matchAll(/--(font-[\w-]*(?:sans|serif|mono|family|body|heading|display|ui)[\w-]*)\s*:\s*([^;{}]+)/gi)]
    .filter((m) => !/size/i.test(m[1]))
    .map((m) =>
      m[2]
        .split(",")[0]
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/\s+/g, " "),
    )
    .filter(
      (f, i, a) =>
        f && FAMILY_NAME.test(f) && !GENERIC_FONT.test(f) && a.findIndex((x) => x.toLowerCase() === f.toLowerCase()) === i,
    );
}

/**
 * Pull whatever families the active system references from Google Fonts. One
 * <link> per family: the css2 API answers 400 for an unknown family, and a
 * single combined request would take every valid family down with it.
 */
export function loadGoogleFonts(css: string): void {
  const wanted = new Map(fontFamiliesIn(css).map((f) => [familyHref(f), f]));

  const existing = [...document.querySelectorAll(`link[${FONT_LINK_ATTR}]`)];
  for (const link of existing) {
    const fam = (link as HTMLLinkElement).dataset.fam;
    const href = link.getAttribute("href");
    // keep exact-href matches AND pending title-case retries of wanted families
    const keep =
      (href !== null && wanted.has(href)) ||
      (fam !== undefined && [...wanted.values()].some((f) => titleCase(f) === fam));
    if (!keep) link.remove();
    else if (href !== null) wanted.delete(href);
  }
  for (const [, fam] of wanted) addFontLink(fam);
}
