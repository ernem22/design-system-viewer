// Live "what-if" token editing for the Preview tab. Two distinct,
// independent operations — kept separate on purpose:
//
//  1. Edit a token's VALUE — changes what the token itself equals, so it
//     rightfully changes every element that reads it, everywhere. Global by
//     nature: you're editing the design system's token, not one instance.
//     EPHEMERAL: an override lives in this module's store, never in the
//     system's stored css/groups, and Reset drops it — a Preview what-if is
//     not an edit to the saved system (the Tokens tab's inline editor is the
//     persistent write-through path). Same two layers as the legacy preview
//     (preview/src/tokenOverrides.js `valueEdits` + `swaps`, both cleared by
//     its Reset), restored here after #27 shipped with write-through only.
//  2. Swap which token a single component reads — "use --color-danger here
//     instead of --color-accent", scoped to just that component. Written as
//     a custom property directly on the component's own DOM node (not
//     :root), so it only affects that node's descendants via normal CSS
//     inheritance — every other place still reads the real --color-accent.
//
// Resolution precedence, light and dark alike: valueEdit > swap > authored
// value. A swap's source is resolved from the token's own authored/edited
// value, never sideways through another component's scoped swap (legacy).
// An override is keyed by token name only, so it applies in whichever system
// defines that token and comes back untouched when you switch back — an
// override on a token no system currently defines is kept, not dropped.
//
// Not available in Compare (ambiguous which column an edit would apply to) —
// Compare's renderers never mount the Demo/trigger below, so the feature
// simply doesn't render there.
//
// Ported from preview/src/tokenOverrides.js, except state: the legacy
// version used a React Context provider, but app/ keeps no Context for state
// (see app/CLAUDE.md) — so selection + swaps + valueEdits live in a tiny
// module-level external store (useSyncExternalStore) scoped to this Preview
// inspector instead. Same narrow scope as a Preview-local context, minus the
// provider. A value override applies through `resolvedValue`, which the
// Preview panels call with the active system's own value map — keeping
// tokenValueMap (css -> groups -> themes.dark) as the authored layer and this
// override layer strictly above it, so there is one resolution order, not two.
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

/** The authored value of a token in the active system, before any override —
    the Preview panel passes `tokenValueMap(system, dark).get` here, so the
    resolution order below sits on top of the one shared source rather than
    re-deriving it. A token the system doesn't author returns "" (name-value
    convention for "not defined anywhere"). */
export type AuthoredValueOf = (name: string) => string;

/** Authored value, else the token's live computed `:root` value, else "". */
function authoredOrComputed(authored: AuthoredValueOf, name: string): string {
  return authored(name) || baseValue(name);
}

/** Global value of a token: the ephemeral override wins, then the authored
    value (css -> groups -> themes.dark via the caller's map), then whatever
    the page computed. This is the top of the precedence chain and the value a
    swap's *source* resolves through.

    `overrides` defaults to the live store, but React callers pass the
    `valueEdits` from their `useInspector()` snapshot so the expression depends
    on a value the hook can see (and re-renders when it changes) instead of
    reading module state behind the hook's back. */
export function resolvedValue(
  authored: AuthoredValueOf,
  name: string,
  overrides: Record<string, string> = state.valueEdits,
): string {
  return overrides[name] ?? authoredOrComputed(authored, name);
}

/** What one component actually reads for a token: if it is swapped, resolve
    the swapped-to token through the global layer; otherwise resolve this
    token. Symmetric with resolvedValue, one level up the chain. */
export function valueInScope(authored: AuthoredValueOf, scopeId: string, name: string): string {
  const source = state.swaps[scopeId]?.[name];
  return resolvedValue(authored, source ?? name);
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
  /** { tokenName: "literal css value" } — global, ephemeral value overrides. */
  valueEdits: Record<string, string>;
}

let state: InspectorState = { selected: null, mobileOpen: false, swaps: {}, valueEdits: {} };
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

/** Read-only snapshot for callers that aren't React (tests, and the count
    helper below). Components must subscribe via `useInspector` instead so a
    change re-renders them. */
export function getInspectorState(): InspectorState {
  return state;
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

/** Global ephemeral value override — same shape as legacy's setValueEdit.
    Stored by token name only (not by system), so it survives switching the
    active system and returns when that system comes back. */
export function setValueEdit(name: string, value: string): void {
  if (state.valueEdits[name] === value) return;
  state = { ...state, valueEdits: { ...state.valueEdits, [name]: value } };
  emit();
}

/** Drop one token's value override. No-op when it isn't overridden. */
export function clearValueEdit(name: string): void {
  if (!(name in state.valueEdits)) return;
  const next = { ...state.valueEdits };
  delete next[name];
  state = { ...state, valueEdits: next };
  emit();
}

/** The global override for a token, or undefined when it reads as authored.
    `valueEdited` is the "is this token overridden?" predicate the inspector
    row uses to render the edited badge. */
export function getValueEdit(name: string): string | undefined {
  return state.valueEdits[name];
}

/** Reset: drops BOTH layers, swaps and value edits — the whole point of
    #27 (legacy's clearAll did the same). Counting/clearing only swaps left
    edited values behind the button named "Reset every token edit". */
export function clearAll(): void {
  if (Object.keys(state.swaps).length === 0 && Object.keys(state.valueEdits).length === 0) return;
  state = { ...state, swaps: {}, valueEdits: {} };
  emit();
}

/** How many overrides Reset would drop, across both layers — feeds the pill
    count. Read it from the `useInspector()` snapshot (`countOverrides`) so
    the same subscription that re-renders the inspector re-renders the pill. */
export function countOverrides(snapshot: InspectorState): number {
  const edits = Object.keys(snapshot.valueEdits).length;
  const swaps = Object.values(snapshot.swaps).reduce((n, m) => n + Object.keys(m).length, 0);
  return edits + swaps;
}
