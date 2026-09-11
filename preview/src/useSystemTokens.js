import { useEffect, useRef, useState } from "react";
import { fontFamiliesIn } from "./fonts.js";

const STYLE_ID = "dsv-tokens";
const FONT_LINK_ID = "dsv-google-fonts"; // legacy single-link id, removed on sight
const FONT_LINK_ATTR = "data-dsv-font";

// Systems name real webfonts but ship no @font-face — pull whatever families
// the active system actually references from Google Fonts. One <link> per
// family on purpose: the css2 API answers 400 for an unknown family (Georgia,
// SFMono-Regular, self-hosted names…), and a single combined request would
// take every valid family down with it. Isolated links fail independently.
const familyHref = (f) =>
  "https://fonts.googleapis.com/css2?" +
  `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700` +
  "&display=swap";

// Google matches family names case-sensitively ("inter" 400s, "Inter" 200s),
// and pasted CSS often gets the casing wrong. One automatic correction attempt.
const titleCase = (f) => f.split(" ").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");

function addFontLink(fam) {
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

export function loadGoogleFonts(css) {
  const wanted = new Map(fontFamiliesIn(css).map((f) => [familyHref(f), f]));

  // legacy single combined link from before — always drop it
  document.getElementById(FONT_LINK_ID)?.remove();

  const existing = [...document.querySelectorAll(`link[${FONT_LINK_ATTR}]`)];
  for (const link of existing) {
    const fam = link.dataset.fam;
    const href = link.getAttribute("href");
    // keep exact-href matches AND pending title-case retries of wanted families
    const keep = wanted.has(href) || (fam && [...wanted.values()].some((f) => titleCase(f) === fam));
    if (!keep) link.remove();
    else wanted.delete(href);
  }
  for (const [, fam] of wanted) addFontLink(fam);
}

function injectCss(system, dark) {
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el); // after fallback.css / components.css → wins
  }
  // Use the system's base tokens only (system.groups), not raw css with @media dark
  // so minimax light (#fafafa) doesn't get overridden by its dark @media when OS is dark
  let css = "";
  if (system?.groups) {
    const tokens = system.groups.flatMap(g => g.tokens);
    if (tokens.length) css = `:root{${tokens.map(t => `${t.name}:${t.value}`).join(";")}}`;
  } else {
    css = system?.css || "";
    // strip any @media dark block to keep base only
    css = css.replace(/@media[^{]*prefers-color-scheme\s*:\s*dark[^{]*\{[\s\S]*?\}\s*\}/gi, "");
  }
  // Optional dark variant: appended later in the same stylesheet so it wins.
  // system.themes.dark is [{name, value}] (minimax today, others later).
  const darkTokens = system?.themes?.dark;
  if (dark && darkTokens?.length) {
    css += `:root{${darkTokens.map(t => `${t.name}:${t.value}`).join(";")}}`;
    document.documentElement.dataset.theme = "dark";
  } else {
    delete document.documentElement.dataset.theme;
  }
  el.textContent = css;
}

const isStaticHost = () => location.hostname.includes("github.io") || location.protocol === "file:";

// Ordered source fallback: dev API → this browser's localStorage → the static
// bundle (relative path, then root-based for the Pages sub-path base). Returns
// [] when nothing resolves; callers decide whether empty is an error.
export async function fetchSystems() {
  if (!isStaticHost()) {
    try {
      const res = await fetch("/api/systems");
      if (res.ok) return res.json();
    } catch {}
  }
  try {
    const raw = localStorage.getItem("dsv.systems");
    if (raw !== null) return JSON.parse(raw);
  } catch {}
  for (const url of ["../systems/index.json", "./systems/index.json"]) {
    try {
      const r = await fetch(url);
      if (r.ok) return r.json();
    } catch {}
  }
  return [];
}

/**
 * Resolve the active system (from ?sys= or the parent's postMessage), inject
 * its raw CSS, and expose a dark-mode toggle (only meaningful when the system
 * ships a dark variant → `system.themes.dark`).
 *
 * @returns {{ system, error, loading, dark: boolean, setDark: (v:boolean)=>void, hasDark: boolean }}
 */
export function useSystemTokens() {
  const [state, setState] = useState({ system: null, error: null, loading: true });
  const [dark, setDark] = useState(false);
  const systemRef = useRef(null);
  const darkRef = useRef(false);

  useEffect(() => {
    let alive = true;
    const initial = new URLSearchParams(location.search).get("sys");

    const apply = async (slug) => {
      try {
        const all = await fetchSystems();
        if (!alive) return;
        if (!all.length) throw new Error("no-systems");
        const system = all.find((s) => s.slug === slug) || all[0];
        systemRef.current = system;
        injectCss(system, darkRef.current);
        loadGoogleFonts(system.css);
        document.title = `${system.name} — Preview`;
        setState({ system, error: null, loading: false });
      } catch (err) {
        if (!alive) return;
        systemRef.current = null;
        setState({ system: null, error: String(err.message || err), loading: false });
      }
    };

    apply(initial);

    // file:// serializes its origin as the string "null"
    const msgOrigin = location.origin === "null" ? "*" : location.origin;
    const onMessage = (e) => {
      if (e.origin !== location.origin && e.origin !== "null") return;
      if (e.data && e.data.type === "dsv:system") apply(e.data.slug);
    };
    window.addEventListener("message", onMessage);
    try { parent.postMessage({ type: "dsv:preview-ready" }, msgOrigin); } catch {}

    return () => {
      alive = false;
      window.removeEventListener("message", onMessage);
    };
  }, []);

  useEffect(() => {
    darkRef.current = dark;
    if (systemRef.current) injectCss(systemRef.current, dark);
  }, [dark]);

  const hasDark = !!(state.system?.themes?.dark?.length);

  return {
    ...state,
    dark, setDark, hasDark,
  };
}
