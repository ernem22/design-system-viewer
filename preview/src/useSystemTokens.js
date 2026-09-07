import { useEffect, useRef, useState } from "react";
import { fontFamiliesIn } from "./fonts.js";

const STYLE_ID = "dsv-tokens";
const FONT_LINK_ID = "dsv-google-fonts";

// Systems name real webfonts but ship no @font-face — pull whatever families
// the active system actually references from Google Fonts. Unknown/self-hosted
// names are silently dropped by the API (no 400s), so this is safe to try for
// every system, not just a hardcoded few.
export function loadGoogleFonts(css) {
  const families = fontFamiliesIn(css);

  let link = document.getElementById(FONT_LINK_ID);
  if (!families.length) { link?.remove(); return; }

  const href = "https://fonts.googleapis.com/css2?" +
    families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&") +
    "&display=swap";
  if (link?.href === href) return;
  if (!link) {
    link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = href;
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

async function fetchSystem(slug) {
  if (!isStaticHost()) {
    try {
      const res = await fetch("/api/systems");
      if (res.ok) {
        const all = await res.json();
        if (!all.length) throw new Error("no-systems");
        return all.find((s) => s.slug === slug) || all[0];
      }
    } catch {}
  }
  try {
    const raw = localStorage.getItem("dsv.systems");
    if (raw !== null) {
      const ls = JSON.parse(raw);
      if (!ls.length) throw new Error("no-systems");
      return ls.find((s) => s.slug === slug) || ls[0];
    }
  } catch {}
  try {
    const r = await fetch("../systems/index.json");
    if (r.ok) {
      const all = await r.json();
      if (!all.length) throw new Error("no-systems");
      return all.find((s) => s.slug === slug) || all[0];
    }
  } catch {}
  try {
    const r2 = await fetch("./systems/index.json");
    if (r2.ok) {
      const all = await r2.json();
      if (!all.length) throw new Error("no-systems");
      return all.find((s) => s.slug === slug) || all[0];
    }
  } catch {}
  throw new Error("no-systems");
}
async function fetchAllSystems() {
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
  try {
    const r = await fetch("../systems/index.json");
    if (r.ok) return r.json();
  } catch {}
  try {
    const r2 = await fetch("./systems/index.json");
    if (r2.ok) return r2.json();
  } catch {}
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
        const system = await fetchSystem(slug);
        if (!alive) return;
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
