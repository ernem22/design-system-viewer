import { useEffect } from "react";
import { fontFamiliesIn } from "./fonts.ts";

// Ported from preview/src/useSystemTokens.js (never import preview/ — it
// stays untouched). Systems name real webfonts but ship no @font-face, so
// whatever families the active system actually references is pulled from
// Google Fonts at runtime. Compare tab reuse: call loadGoogleFonts with the
// combined CSS of its picked columns.

const FONT_LINK_ID = "dsv-google-fonts"; // legacy single-link id, removed on sight
const FONT_LINK_ATTR = "data-dsv-font";

// One <link> per family on purpose: the css2 API answers 400 for an unknown
// family (Georgia, SFMono-Regular, self-hosted names…), and a single combined
// request would take every valid family down with it. Isolated links fail
// independently.
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

export function loadGoogleFonts(css: string): void {
  const wanted = new Map(fontFamiliesIn(css).map((f) => [familyHref(f), f]));

  // legacy single combined link from before — always drop it
  document.getElementById(FONT_LINK_ID)?.remove();

  const existing = [...document.querySelectorAll(`link[${FONT_LINK_ATTR}]`)];
  for (const link of existing) {
    const fam = (link as HTMLLinkElement).dataset.fam;
    const href = link.getAttribute("href");
    // keep exact-href matches AND pending title-case retries of wanted families
    const keep = (href !== null && wanted.has(href)) || (fam && [...wanted.values()].some((f) => titleCase(f) === fam));
    if (!keep) link.remove();
    else if (href !== null) wanted.delete(href);
  }
  for (const [, fam] of wanted) addFontLink(fam);
}

/** Loads Google Fonts for the families named by `css`; swaps/removes links
 *  as `css` changes (e.g. switching systems). No Context — call from App. */
export function useGoogleFonts(css: string): void {
  useEffect(() => {
    loadGoogleFonts(css);
  }, [css]);
}
