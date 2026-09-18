import { useEffect, useMemo } from "react";
import { fontFamiliesIn } from "./fonts.ts";

// Ported from preview/src/useSystemTokens.js (never import preview/ — it
// stays untouched). Systems name real webfonts but ship no @font-face, so
// whatever families a system actually references is pulled from Google Fonts
// at runtime. Loading is scoped per consumer (issue #40): the active system's
// families serve Tokens/Preview, the Compare tab owns its picked columns'
// fonts. Each scope only ever diffs its own <link>s, so a Compare pick cannot
// add/remove/rewrite another consumer's links.

const FONT_LINK_ID = "dsv-google-fonts"; // legacy single-link id, removed on sight
const FONT_LINK_ATTR = "data-dsv-font";
// Written to the DOM on purpose: it both partitions the diff and makes
// "which tab owns this link" observable to a running-app test.
const FONT_SCOPE_ATTR = "data-dsv-font-scope";

export type FontScope = "active" | "compare";

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

function addFontLink(fam: string, scope: FontScope): void {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.setAttribute(FONT_LINK_ATTR, "");
  link.setAttribute(FONT_SCOPE_ATTR, scope);
  link.dataset.fam = fam;
  link.onerror = () => {
    link.remove();
    const fixed = titleCase(fam);
    if (
      fixed !== fam &&
      !document.querySelector(
        `link[${FONT_LINK_ATTR}][${FONT_SCOPE_ATTR}="${scope}"][data-fam="${CSS.escape(fixed)}"]`,
      )
    ) {
      // single retry with corrected casing; its own failure just removes it
      const retry = document.createElement("link");
      retry.rel = "stylesheet";
      retry.setAttribute(FONT_LINK_ATTR, "");
      retry.setAttribute(FONT_SCOPE_ATTR, scope);
      retry.dataset.fam = fixed;
      retry.onerror = () => retry.remove();
      retry.href = familyHref(fixed);
      document.head.appendChild(retry);
    }
  };
  link.href = familyHref(fam);
  document.head.appendChild(link);
}

function loadFontFamilies(families: string[], scope: FontScope): void {
  const wanted = new Map(families.map((f) => [familyHref(f), f]));

  // legacy single combined link from before — always drop it
  document.getElementById(FONT_LINK_ID)?.remove();

  // Only this scope's links are candidates; other consumers' links stay put.
  const existing = [
    ...document.querySelectorAll(`link[${FONT_LINK_ATTR}][${FONT_SCOPE_ATTR}="${scope}"]`),
  ];
  for (const link of existing) {
    const fam = (link as HTMLLinkElement).dataset.fam;
    const href = link.getAttribute("href");
    // keep exact-href matches AND pending title-case retries of wanted families
    const keep =
      (href !== null && wanted.has(href)) || (fam && [...wanted.values()].some((f) => titleCase(f) === fam));
    if (!keep) link.remove();
    else if (href !== null) wanted.delete(href);
  }
  for (const [, fam] of wanted) addFontLink(fam, scope);
}

/** Loads Google Fonts for the families named by `css` in one consumer
 *  `scope`, swapping/removing only that scope's links. */
export function loadGoogleFonts(css: string, scope: FontScope = "active"): void {
  loadFontFamilies(fontFamiliesIn(css), scope);
}

/** Loads Google Fonts for the families named by `css` into `scope`; swaps or
 *  removes only that scope's links as `css` changes. The effect keys on the
 *  extracted family set, not the raw css string, so a token edit that leaves
 *  the families alone does not touch `<link>`s. No Context — call from App. */
export function useGoogleFonts(css: string, scope: FontScope = "active"): void {
  // Family names cannot contain newlines (see FAMILY_NAME), so this join is a
  // faithful set key for the effect dependency.
  const key = useMemo(() => fontFamiliesIn(css).join("\n"), [css]);
  useEffect(() => {
    loadFontFamilies(key ? key.split("\n") : [], scope);
  }, [key, scope]);
}
