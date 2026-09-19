import { useEffect, useMemo, useRef, useState } from "react";
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

/** Default comparable (legacy's `?c=` default was "button", same first entry
 *  here) — shared by the state initializer below and App's URL writer so the
 *  default is omitted from links instead of hardcoded in two places. */
export const DEFAULT_COMPONENT_ID = BASIC_OPTIONS[0]?.id ?? "";

/** Every comparable id, for validating a deep-linked component param. */
const KNOWN_COMPONENT_IDS = new Set(
  [...BASIC_OPTIONS, ...COMPONENT_OPTIONS, ...EXTRA_OPTIONS, ...SCREEN_OPTIONS].map((o) => o.id),
);

/** A system whose `groups` carry the active variant's values, so consumers
   that read `groups` directly — the diff table's value maps — see exactly what
   the columns' `styleFor` scope paints. Dark tokens overlay the base groups by
   name (later wins, matching resolveSystemTokens); any token the base groups
   don't author is appended under a synthetic group so it still diffs. Variant
   off, or no dark theme: the system passes through untouched. Never mutates
   its input. */
function resolveForDiff(system: DesignSystem, dark: boolean): DesignSystem {
  const darkTokens = dark ? (system.themes?.dark ?? []) : [];
  if (!darkTokens.length) return system;
  const overrides = new Map(darkTokens.map((t) => [t.name, t.value]));
  const applied = new Set<string>();
  const groups = system.groups.map((g) => ({
    ...g,
    tokens: g.tokens.map((t) => {
      const value = overrides.get(t.name);
      if (value === undefined) return t;
      applied.add(t.name);
      return { ...t, value };
    }),
  }));
  const added = darkTokens.filter((t) => !applied.has(t.name));
  if (!added.length) return { ...system, groups };
  return {
    ...system,
    groups: [...groups, { id: "theme-dark", label: "Dark", kind: "raw", tokens: added }],
  };
}

/** Compare tab view model — mirrors useTokensView's shape (state + derived
   data, lifted to App.tsx, no Context/Redux). `systems` comes from
   useSystems() in App.tsx, same source the rest of the app reads. `dark`
   overlays each system's `themes.dark` onto its resolved tokens, the same
   variant App applies to `:root`; it defaults off so existing callers keep
   the light behaviour. */
export function useCompareView(systems: DesignSystem[], dark = false) {
  // Deep-link init (legacy's compare.jsx read cmp/v/c the same way): unknown
  // values fall back to today's defaults, and the repair effect below drops
  // picked slugs with no matching system — so no querystring, same as before.
  const [picked, setPicked] = useState<string[]>(() => {
    const linked = readViewUrl().cmp;
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

  // Dark-resolved copies (identity unchanged when dark is off, so the light
  // path allocates nothing new) — CompareColumn's `styleFor` scope and the
  // diff table's group reads both derive from these.
  const cols = useMemo(
    () => systems.filter((s) => picked.includes(s.slug)).map((s) => resolveForDiff(s, dark)),
    [systems, picked, dark],
  );

  const toggle = (slug: string) => {
    userPickedRef.current = true;
    setPicked((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug].slice(-MAX_COLUMNS)));
  };

  // One CSS-variable map per system — CompareColumn spreads this as inline
  // `style` so `var(--x)` inside that column resolves to its own tokens
  // instead of the page's :root (which only ever holds one active system).
  // Resolved through the active variant, so a column's components/contrast
  // readouts paint dark values whenever the system ships them and dark is on.
  const styleFor = useMemo(() => {
    const map = new Map<string, Record<string, string>>();
    for (const s of systems)
      map.set(s.slug, Object.fromEntries(resolveSystemTokens(s, dark).map((t) => [t.name, t.value])));
    return map;
  }, [systems, dark]);

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
