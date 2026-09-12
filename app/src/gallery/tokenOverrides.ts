// Live "what-if" token editing for the single-system gallery. Two distinct,
// independent operations — kept separate on purpose:
//
//  1. Edit a token's VALUE — changes what the token itself equals, so it
//     rightfully changes every element that reads it, everywhere. Global by
//     nature: you're editing the design system's token, not one instance.
//  2. Swap which token a single component reads — "use --color-danger here
//     instead of --color-accent", scoped to just that component. Written as
//     a custom property directly on the component's own DOM node (not
//     :root), so it only affects that node's descendants via normal CSS
//     inheritance.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { REFERENCE } from "../../../src/core/schema.js";
import { CATEGORIES } from "../../../src/core/taxonomy.js";

const VALUE_STYLE_ID = "app-token-value-overrides";

export interface TokenScope {
  id: string;
  title: string;
  tokens: string[];
}

export interface TokenOverrides {
  valueEdits: Record<string, string>;
  swaps: Record<string, Record<string, string>>;
  selected: TokenScope | null;
  selectScope: (scope: TokenScope | null) => void;
  clearSelection: () => void;
  globalValue: (name: string) => string;
  valueInDemo: (id: string, name: string) => string;
  setValueEdit: (name: string, value: string) => void;
  clearValueEdit: (name: string) => void;
  setSwap: (id: string, target: string, source: string) => void;
  clearSwap: (id: string, target: string) => void;
  clearSwapsIn: (id: string) => void;
  clearAll: () => void;
}

export const TokenOverridesContext = createContext<TokenOverrides | null>(null);

/** Every canonical token name and its schema group label. */
export const ALL_TOKENS: { name: string; group: string }[] = (
  REFERENCE as { label: string; tokens: string[] }[]
).flatMap((g) => g.tokens.map((name) => ({ name, group: g.label })));

const KIND_CACHE = new Map<string, string>();
/** color | type | length | shadow | motion | number | raw */
export function kindOf(name: string): string {
  const bare = name.replace(/^--/, "");
  const hit = KIND_CACHE.get(bare);
  if (hit) return hit;
  const found = (CATEGORIES as { kind: string; test: (n: string) => boolean }[]).find((c) => {
    try {
      return c.test(bare);
    } catch {
      return false;
    }
  });
  const kind = found?.kind ?? "raw";
  KIND_CACHE.set(bare, kind);
  return kind;
}

/** Stable id for a <Demo title="…"> block — the unit component-scoped swaps attach to. */
export function demoId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A token's own resolved value, ignoring any component-level swap (base + value-edit layer only). */
export function baseValue(name: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  } catch {
    return "";
  }
}

export function useTokenOverridesProvider(): TokenOverrides {
  // { tokenName: "literal css value" } — edits the token itself, global.
  const [valueEdits, setValueEdits] = useState<Record<string, string>>({});
  // { demoId: { tokenName: sourceTokenName } } — per-component swap, scoped.
  const [swaps, setSwaps] = useState<Record<string, Record<string, string>>>({});
  // Figma-style right panel selection. Null = nothing selected (panel shows
  // the global-edits empty state).
  const [selected, setSelected] = useState<TokenScope | null>(null);
  const elRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    let el = elRef.current;
    if (!el) {
      const found = document.getElementById(VALUE_STYLE_ID);
      el = found instanceof HTMLStyleElement ? found : document.createElement("style");
      el.id = VALUE_STYLE_ID;
      elRef.current = el;
    }
    // Re-append even if already attached: appendChild moves an existing node
    // to the end, guaranteeing this stays the last <style> in <head> so it
    // wins the cascade over the system layer regardless of mount order.
    document.head.appendChild(el);
    const entries = Object.entries(valueEdits);
    el.textContent = entries.length
      ? `:root{${entries.map(([name, value]) => `${name}:${value}`).join(";")}}`
      : "";
  }, [valueEdits]);

  useEffect(() => () => elRef.current?.remove(), []);

  // A swap's source is always resolved against the global layer (base value
  // or an active value-edit) — swapping never chains through another
  // component's scoped swap.
  const globalValue = (name: string): string => valueEdits[name] ?? baseValue(name);
  const valueInDemo = (id: string, name: string): string => {
    const source = swaps[id]?.[name];
    return source ? globalValue(source) : globalValue(name);
  };

  return {
    valueEdits,
    swaps,
    selected,
    selectScope: (scope) => setSelected(scope),
    clearSelection: () => setSelected(null),
    globalValue,
    valueInDemo,
    setValueEdit: (name, value) => setValueEdits((o) => ({ ...o, [name]: value })),
    clearValueEdit: (name) =>
      setValueEdits((o) => {
        if (!(name in o)) return o;
        const next = { ...o };
        delete next[name];
        return next;
      }),
    setSwap: (id, target, source) => setSwaps((o) => ({ ...o, [id]: { ...o[id], [target]: source } })),
    clearSwap: (id, target) =>
      setSwaps((o) => {
        if (!o[id] || !(target in o[id])) return o;
        const nextDemo = { ...o[id] };
        delete nextDemo[target];
        const next = { ...o, [id]: nextDemo };
        if (Object.keys(nextDemo).length === 0) delete next[id];
        return next;
      }),
    clearSwapsIn: (id) =>
      setSwaps((o) => {
        if (!o[id]) return o;
        const next = { ...o };
        delete next[id];
        return next;
      }),
    clearAll: () => {
      setValueEdits({});
      setSwaps({});
    },
  };
}

export function useTokenOverrides(): TokenOverrides | null {
  return useContext(TokenOverridesContext);
}
