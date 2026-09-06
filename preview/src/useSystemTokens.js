import { useEffect, useRef, useState } from "react";

const STYLE_ID = "dsv-tokens";

function injectCss(system) {
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
  el.textContent = css;
}

async function fetchSystem(slug) {
  try {
    const res = await fetch("/api/systems");
    if (res.ok) {
      const all = await res.json();
      if (!all.length) throw new Error("no-systems");
      return all.find((s) => s.slug === slug) || all[0];
    }
  } catch {}
  // static fallback — localStorage or bundled index.json
  try {
    const ls = JSON.parse(localStorage.getItem("dsv.systems") || "[]");
    if (ls.length) {
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
  try {
    const res = await fetch("/api/systems");
    if (res.ok) return res.json();
  } catch {}
  try {
    const ls = JSON.parse(localStorage.getItem("dsv.systems") || "[]");
    if (ls.length) return ls;
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
  const systemRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const initial = new URLSearchParams(location.search).get("sys");

    const apply = async (slug) => {
      try {
        const system = await fetchSystem(slug);
        if (!alive) return;
        systemRef.current = system;
        injectCss(system);
        document.title = `${system.name} — Preview`;
        setState({ system, error: null, loading: false });
      } catch (err) {
        if (!alive) return;
        systemRef.current = null;
        setState({ system: null, error: String(err.message || err), loading: false });
      }
    };

    apply(initial);

    const onMessage = (e) => {
      if (e.origin !== location.origin) return;
      if (e.data && e.data.type === "dsv:system") apply(e.data.slug);
    };
    window.addEventListener("message", onMessage);
    try { parent.postMessage({ type: "dsv:preview-ready" }, location.origin); } catch {}

    return () => {
      alive = false;
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return {
    ...state,
  };
}
