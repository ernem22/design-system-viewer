// Live "what-if" token editing for the Preview tab. Two distinct,
// independent operations — kept separate on purpose:
//
//  1. Edit a token's VALUE — changes what the token itself equals, so it
//     rightfully changes every element that reads it, everywhere. Global by
//     nature: you're editing the design system's token, not one instance.
//     This writes through the existing `patchToken` store mutation (the
//     Tokens-tab write-flows plumbing) — there is no separate ephemeral
//     value-edit layer like the legacy preview had.
//  2. Swap which token a single component reads — "use --color-danger here
//     instead of --color-accent", scoped to just that component. Written as
//     a custom property directly on the component's own DOM node (not
//     :root), so it only affects that node's descendants via normal CSS
//     inheritance — every other place still reads the real --color-accent.
//
// Not available in Compare (ambiguous which column an edit would apply to) —
// Compare's renderers never mount the Demo/trigger below, so the feature
// simply doesn't render there.
//
// Ported from preview/src/tokenOverrides.js, except state: the legacy
// version used a React Context provider, but app/ keeps no Context for state
// (see app/CLAUDE.md) — so selection + swaps live in a tiny module-level
// external store (useSyncExternalStore) scoped to this Preview inspector
// instead. Same narrow scope as a Preview-local context, minus the provider.
import { useSyncExternalStore } from "react";
import { REFERENCE } from "../../../src/core/schema.js";
import { CATEGORIES } from "../../../src/core/taxonomy.js";
import { slugify } from "./slug.ts";

export type TokenKind = "color" | "type" | "length" | "shadow" | "motion" | "number" | "raw";

/** Every canonical token name and its schema group label. */
export const ALL_TOKENS: Array<{ name: string; group: string }> = (
  REFERENCE as Array<{ label: string; tokens: string[] }>
).flatMap((g) => g.tokens.map((name) => ({ name, group: g.label })));

const KIND_CACHE = new Map<string, TokenKind>();
/** color | type | length | shadow | motion | number | raw */
export function kindOf(name: string): TokenKind {
  const bare = name.replace(/^--/, "");
  const cached = KIND_CACHE.get(bare);
  if (cached) return cached;
  const hit = (CATEGORIES as Array<{ kind: TokenKind; test: (n: string) => boolean }>).find((c) => {
    try {
      return c.test(bare);
    } catch {
      return false;
    }
  });
  const kind = hit?.kind ?? "raw";
  KIND_CACHE.set(bare, kind);
  return kind;
}

/** Stable id for a <Demo title="…"> block — the unit component-scoped swaps
    attach to. Demo titles are unique across the gallery, so this is
    collision-free. Same folding as lib/slug.ts. */
export const demoId = slugify;

/** A token's own resolved value, ignoring any component-level swap. Used as
    the fallback when the active system doesn't define the token. */
export function baseValue(name: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  } catch {
    return "";
  }
}

/** Figma-style right panel selection: { id, title, tokens } of the Demo
    whose tokens the docked properties panel currently shows. Null = nothing
    selected. */
export interface InspectorScope {
  id: string;
  title: string;
  tokens: string[];
}

interface InspectorState {
  selected: InspectorScope | null;
  /** Small screens can't dock — the trigger opens the overlay dialog instead. */
  mobileOpen: boolean;
  /** { scopeId: { tokenName: sourceTokenName } } — per-component swaps. */
  swaps: Record<string, Record<string, string>>;
}

let state: InspectorState = { selected: null, mobileOpen: false, swaps: {} };
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): InspectorState {
  return state;
}

/** Shared inspector state — any Demo trigger or Preview panel subscribes. */
export function useInspector(): InspectorState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function selectScope(scope: InspectorScope | null): void {
  state = { ...state, selected: scope, mobileOpen: false };
  emit();
}

/** Desktop docks the scope into the persistent right properties panel;
    small screens keep the overlay dialog (same content, different shell). */
export function openScope(scope: InspectorScope): void {
  const mobile =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 760px)").matches
      : false;
  state = {
    ...state,
    selected: state.selected?.id === scope.id ? null : scope,
    mobileOpen: mobile && state.selected?.id !== scope.id,
  };
  emit();
}

export function setMobileOpen(open: boolean): void {
  if (state.mobileOpen === open) return;
  state = { ...state, mobileOpen: open };
  emit();
}

export function setSwap(scopeId: string, target: string, source: string): void {
  state = { ...state, swaps: { ...state.swaps, [scopeId]: { ...state.swaps[scopeId], [target]: source } } };
  emit();
}

export function clearSwap(scopeId: string, target: string): void {
  const demo = state.swaps[scopeId];
  if (!demo || !(target in demo)) return;
  const nextDemo = { ...demo };
  delete nextDemo[target];
  const next = { ...state.swaps, [scopeId]: nextDemo };
  if (Object.keys(nextDemo).length === 0) delete next[scopeId];
  state = { ...state, swaps: next };
  emit();
}

export function clearSwapsIn(scopeId: string): void {
  if (!state.swaps[scopeId]) return;
  const next = { ...state.swaps };
  delete next[scopeId];
  state = { ...state, swaps: next };
  emit();
}

export function clearAllSwaps(): void {
  if (Object.keys(state.swaps).length === 0) return;
  state = { ...state, swaps: {} };
  emit();
}
