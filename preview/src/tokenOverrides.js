// Live "what-if" token swaps for the single-system Preview: pick a Demo's
// token chip, search for another token of the same kind, and every element
// using that token re-renders with the new one — instantly, in-memory only.
// Not available in Compare (ambiguous which column an override would apply
// to) — TokenChip degrades to a plain, non-interactive <code> there.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { REFERENCE } from "../../src/core/schema.js";
import { CATEGORIES } from "../../src/core/taxonomy.js";

const STYLE_ID = "dsv-token-overrides";

export const TokenOverridesContext = createContext(null);

/** Every canonical token name, its schema group label, and its taxonomy kind. */
export const ALL_TOKENS = REFERENCE.flatMap((g) =>
  g.tokens.map((name) => ({ name, group: g.label })),
);

const KIND_CACHE = new Map();
/** color | type | length | shadow | motion | number | raw */
export function kindOf(name) {
  const bare = name.replace(/^--/, "");
  if (KIND_CACHE.has(bare)) return KIND_CACHE.get(bare);
  const hit = CATEGORIES.find((c) => {
    try { return c.test(bare); } catch { return false; }
  });
  const kind = hit?.kind ?? "raw";
  KIND_CACHE.set(bare, kind);
  return kind;
}

/**
 * Owns the override map ({ tokenName: sourceTokenName }) and keeps a
 * dedicated stylesheet in sync. Each override is written as
 * `--target: var(--source);` — a reference, not a resolved value — so it
 * keeps tracking the active system (and dark-mode toggle) automatically.
 */
export function useTokenOverridesProvider() {
  const [overrides, setOverrides] = useState({});
  const elRef = useRef(null);

  useEffect(() => {
    let el = elRef.current;
    if (!el) {
      el = document.getElementById(STYLE_ID) || document.createElement("style");
      el.id = STYLE_ID;
      elRef.current = el;
    }
    // Re-append even if already attached: appendChild moves an existing node
    // to the end, guaranteeing this stays the last <style> in <head> so it
    // wins the cascade over #dsv-tokens regardless of mount/effect order.
    document.head.appendChild(el);
    const entries = Object.entries(overrides);
    el.textContent = entries.length
      ? `:root{${entries.map(([target, source]) => `${target}:var(${source})`).join(";")}}`
      : "";
  }, [overrides]);

  useEffect(() => () => elRef.current?.remove(), []);

  return {
    overrides,
    setOverride: (target, source) => setOverrides((o) => ({ ...o, [target]: source })),
    clearOverride: (target) => setOverrides((o) => {
      if (!(target in o)) return o;
      const next = { ...o };
      delete next[target];
      return next;
    }),
    clearAll: () => setOverrides({}),
  };
}

export function useTokenOverrides() {
  return useContext(TokenOverridesContext);
}
