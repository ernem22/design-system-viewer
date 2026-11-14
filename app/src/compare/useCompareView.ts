import { useEffect, useMemo, useRef, useState } from "react";
import { REFERENCE } from "../../../src/core/schema.js";
import { resolveSystemTokens } from "../systems/store.ts";
import type { DesignSystem } from "../systems/store.ts";
import { readViewUrl } from "../lib/urlState.ts";
import { BASIC_OPTIONS, COMPONENT_OPTIONS, EXTRA_OPTIONS, SCREEN_OPTIONS } from "./registry.tsx";
import type { ComparableOption } from "./registry.tsx";

export type CompareMode = "component" | "diff";

/** One group of picker options — legacy's OPT_GROUPS: Basics (compare-only
   mini demos) plus Components / Extras / Screens built from the real
   gallery sections, so the whole preview is comparable system-by-system. */
export interface OptionGroup {
  label: string;
  items: ComparableOption[];
}

const MAX_COLUMNS = 4;

/** Every schema token name. A column must explicitly neutralize the ones its
 *  system omits, or they resolve from document.documentElement (the ACTIVE
 *  system) and an incomplete system renders with another system's values. */
const SCHEMA_TOKEN_NAMES = (REFERENCE as { tokens: string[] }[]).flatMap((g) => g.tokens);

/** Default comparable (legacy's `?c=` default was "button", same first entry
 *  here) — shared by the state initializer below and App's URL writer so the
 *  default is omitted from links instead of hardcoded in two places. */
export const DEFAULT_COMPONENT_ID = BASIC_OPTIONS[0]?.id ?? "";

/** Every comparable id, for validating a deep-linked component param. */
const KNOWN_COMPONENT_IDS = new Set(
  [...BASIC_OPTIONS, ...COMPONENT_OPTIONS, ...EXTRA_OPTIONS, ...SCREEN_OPTIONS].map((o) => o.id),
);

/** Compare tab view model — mirrors useTokensView's shape (state + derived
   data, lifted to App.tsx, no Context/Redux). `systems` comes from
   useSystems() in App.tsx, same source the rest of the app reads. Every
   panel shows the base (light) values; a stored `themes.dark` block is
   never read. */
export function useCompareView(systems: DesignSystem[]) {
  // Deep-link init (legacy's compare.jsx read cmp/v/c the same way): unknown
  // values fall back to today's defaults, and the repair effect below drops
  // picked slugs with no matching system — so no querystring, same as before.
  const [picked, setPicked] = useState<string[]>(() => {
    // A hand-edited link can repeat a slug or exceed the column cap; dedupe
    // (first occurrence wins) and clamp, so ?cmp=a,a,b and ?cmp=a,b,c,d,e
    // both start from a valid selection.
    const linked = [...new Set(readViewUrl().cmp)].slice(0, MAX_COLUMNS);
    return linked.length > 0 ? linked : systems.slice(0, 2).map((s) => s.slug);
  });
  const [mode, setMode] = useState<CompareMode>(() =>
    readViewUrl().view === "diff" ? "diff" : "component",
  );
  const [componentId, setComponentId] = useState<string>(() => {
    const linked = readViewUrl().component;
    return linked && KNOWN_COMPONENT_IDS.has(linked) ? linked : DEFAULT_COMPONENT_ID;
  });

  // Distinguishes "first load" from "the user cleared it": the picked
  // initialiser above runs before the async systems fetch resolves, so an
  // empty list at mount is not a choice. An empty list after a toggle is.
  const userPickedRef = useRef(false);

  // Systems can be added/removed elsewhere (SystemSwitcher, Tokens tab) while
  // Compare sits inactive-but-mounted (Shell forceMounts every tab) — drop
  // any picked slug that no longer exists, same fallback as legacy's
  // fetchSystems().then(...) picked-repair.
  // Skipped while the list is still empty (first boot fetches it async) so a
  // deep-linked ?cmp= isn't wiped before the systems it names arrive. Once the
  // systems do arrive, an untouched-but-empty selection seeds the default.
  useEffect(() => {
    if (systems.length === 0) return;
    setPicked((cur) => {
      const valid = cur.filter((slug) => systems.some((s) => s.slug === slug));
      if (valid.length === cur.length) {
        if (cur.length === 0 && !userPickedRef.current) return systems.slice(0, 2).map((s) => s.slug);
        return cur;
      }
      if (valid.length) return valid;
      return systems.slice(0, 2).map((s) => s.slug);
    });
  }, [systems]);

  const optionGroups = useMemo<OptionGroup[]>(
    () => [
      { label: "Basics", items: BASIC_OPTIONS },
      { label: "Components", items: COMPONENT_OPTIONS },
      { label: "Extras", items: EXTRA_OPTIONS },
      { label: "Screens", items: SCREEN_OPTIONS },
    ],
    [],
  );

  const allOptions = useMemo(() => optionGroups.flatMap((g) => g.items), [optionGroups]);
  const active = allOptions.find((o) => o.id === componentId) ?? allOptions[0] ?? null;

  // Picked systems in selection order — CompareColumn's `styleFor` scope and
  // the diff table's group reads both derive from these. Driven by `picked`,
  // not `systems` (catalogue order), so a column keeps the position the user
  // picked it in, matching the rail's chip order.
  const cols = useMemo(() => {
    const bySlug = new Map(systems.map((s) => [s.slug, s]));
    return picked.flatMap((slug) => {
      const system = bySlug.get(slug);
      return system ? [system] : [];
    });
  }, [systems, picked]);

  const toggle = (slug: string) => {
    userPickedRef.current = true;
    setPicked((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug].slice(-MAX_COLUMNS)));
  };

  // One CSS-variable map per system — CompareColumn spreads this as inline
  // `style` so `var(--x)` inside that column resolves to its own tokens
  // instead of the page's :root (which only ever holds one active system).
  // A schema token the system omits is set to `initial` (the guaranteed-
  // invalid value) so `var(--x)` cannot inherit the active system's value.
  const styleFor = useMemo(() => {
    const map = new Map<string, Record<string, string>>();
    for (const s of systems) {
      const scope: Record<string, string> = Object.fromEntries(
        resolveSystemTokens(s).map((t) => [t.name, t.value]),
      );
      for (const name of SCHEMA_TOKEN_NAMES) {
        if (!Object.prototype.hasOwnProperty.call(scope, name)) scope[name] = "initial";
      }
      map.set(s.slug, scope);
    }
    return map;
  }, [systems]);

  return {
    picked,
    toggle,
    mode,
    setMode,
    componentId,
    setComponentId,
    optionGroups,
    active,
    cols,
    styleFor,
    maxColumns: MAX_COLUMNS,
  };
}

export type CompareViewModel = ReturnType<typeof useCompareView>;
