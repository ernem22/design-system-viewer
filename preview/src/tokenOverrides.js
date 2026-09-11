// Live "what-if" token editing for the single-system Preview. Two distinct,
// independent operations — kept separate on purpose:
//
//  1. Edit a token's VALUE — changes what the token itself equals, so it
//     rightfully changes every element that reads it, everywhere. Global by
//     nature: you're editing the design system's token, not one instance.
//  2. Swap which token a single component reads — "use --color-danger here
//     instead of --color-accent", scoped to just that component. Written as
//     a custom property directly on the component's own DOM node (not
//     :root), so it only affects that node's descendants via normal CSS
//     inheritance — every other place still reads the real --color-accent.
//
// Not available in Compare (ambiguous which column an edit would apply to)
// — TokenChip/Drawer trigger degrade to inert there (see usePortalContainer
// sibling pattern in ui.jsx).
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { REFERENCE } from "../../src/core/schema.js";
import { CATEGORIES } from "../../src/core/taxonomy.js";

const VALUE_STYLE_ID = "dsv-token-value-overrides";

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

/** Stable id for a <Demo title="…"> block — the unit component-scoped swaps attach to. */
export function demoId(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** A token's own resolved value, ignoring any component-level swap (base + value-edit layer only). */
export function baseValue(name) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  catch { return ""; }
}

export function useTokenOverridesProvider() {
  // { tokenName: "literal css value" } — edits the token itself, global.
  const [valueEdits, setValueEdits] = useState({});
  // { demoId: { tokenName: sourceTokenName } } — per-component swap, scoped.
  const [swaps, setSwaps] = useState({});
  const elRef = useRef(null);

  useEffect(() => {
    let el = elRef.current;
    if (!el) {
      el = document.getElementById(VALUE_STYLE_ID) || document.createElement("style");
      el.id = VALUE_STYLE_ID;
      elRef.current = el;
    }
    // Re-append even if already attached: appendChild moves an existing node
    // to the end, guaranteeing this stays the last <style> in <head> so it
    // wins the cascade over #dsv-tokens regardless of mount/effect order.
    document.head.appendChild(el);
    const entries = Object.entries(valueEdits);
    el.textContent = entries.length
      ? `:root{${entries.map(([name, value]) => `${name}:${value}`).join(";")}}`
      : "";
  }, [valueEdits]);

  useEffect(() => () => elRef.current?.remove(), []);

  // A swap's source is always resolved against the global layer (base value
  // or an active value-edit) — swapping never chains through another
  // component's scoped swap, which matches how the CSS itself resolves
  // var(--source) from a scoped block: upward through :root, not sideways
  // into an unrelated component.
  const globalValue = (name) => valueEdits[name] ?? baseValue(name);
  const valueInDemo = (id, name) => {
    const source = swaps[id]?.[name];
    return source ? globalValue(source) : globalValue(name);
  };

  return {
    valueEdits,
    swaps,
    globalValue,
    valueInDemo,
    setValueEdit: (name, value) => setValueEdits((o) => ({ ...o, [name]: value })),
    clearValueEdit: (name) => setValueEdits((o) => {
      if (!(name in o)) return o;
      const next = { ...o };
      delete next[name];
      return next;
    }),
    setSwap: (id, target, source) => setSwaps((o) => ({ ...o, [id]: { ...o[id], [target]: source } })),
    clearSwap: (id, target) => setSwaps((o) => {
      if (!o[id] || !(target in o[id])) return o;
      const nextDemo = { ...o[id] };
      delete nextDemo[target];
      const next = { ...o, [id]: nextDemo };
      if (!Object.keys(nextDemo).length) delete next[id];
      return next;
    }),
    clearSwapsIn: (id) => setSwaps((o) => {
      if (!o[id]) return o;
      const next = { ...o };
      delete next[id];
      return next;
    }),
    clearAll: () => { setValueEdits({}); setSwaps({}); },
  };
}

export function useTokenOverrides() {
  return useContext(TokenOverridesContext);
}
