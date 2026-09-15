import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { COMPONENT_ENTRIES } from "../gallery/components/index.ts";
import { resolveSystemTokens } from "../systems/store.ts";
import type { DesignSystem } from "../systems/store.ts";
import { BASIC_OPTIONS } from "./registry.tsx";
import type { ComparableOption } from "./registry.tsx";

export type CompareMode = "component" | "diff";

/** One group of picker options — legacy's OPT_GROUPS. Extras/Screens aren't
   ported yet (separate issue), so only Basics + Components exist for now;
   add their groups here once that port lands — see app/CLAUDE.md's
   "Not yet implemented" note for the tracking issue. */
export interface OptionGroup {
  label: string;
  items: ComparableOption[];
}

const MAX_COLUMNS = 4;

/** Compare tab view model — mirrors useTokensView's shape (state + derived
   data, lifted to App.tsx, no Context/Redux). `systems` comes from
   useSystems() in App.tsx, same source the rest of the app reads. */
export function useCompareView(systems: DesignSystem[]) {
  const [picked, setPicked] = useState<string[]>(() => systems.slice(0, 2).map((s) => s.slug));
  const [mode, setMode] = useState<CompareMode>("component");
  const [componentId, setComponentId] = useState<string>(BASIC_OPTIONS[0]?.id ?? "");

  // Systems can be added/removed elsewhere (SystemSwitcher, Tokens tab) while
  // Compare sits inactive-but-mounted (Shell forceMounts every tab) — drop
  // any picked slug that no longer exists, same fallback as legacy's
  // fetchSystems().then(...) picked-repair.
  useEffect(() => {
    setPicked((cur) => {
      const valid = cur.filter((slug) => systems.some((s) => s.slug === slug));
      if (valid.length) return valid;
      return systems.slice(0, 2).map((s) => s.slug);
    });
  }, [systems]);

  const optionGroups = useMemo<OptionGroup[]>(
    () => [
      { label: "Basics", items: BASIC_OPTIONS },
      {
        label: "Components",
        items: COMPONENT_ENTRIES.map((e) => ({ id: `gallery-${e.id}`, label: e.label, Render: e.Body as ComponentType })),
      },
      // TODO: add "Extras" / "Screens" groups once that gallery port lands.
    ],
    [],
  );

  const allOptions = useMemo(() => optionGroups.flatMap((g) => g.items), [optionGroups]);
  const active = allOptions.find((o) => o.id === componentId) ?? allOptions[0] ?? null;

  const cols = useMemo(() => systems.filter((s) => picked.includes(s.slug)), [systems, picked]);

  const toggle = (slug: string) =>
    setPicked((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug].slice(-MAX_COLUMNS)));

  // One CSS-variable map per system — CompareColumn spreads this as inline
  // `style` so `var(--x)` inside that column resolves to its own tokens
  // instead of the page's :root (which only ever holds one active system).
  const styleFor = useMemo(() => {
    const map = new Map<string, Record<string, string>>();
    for (const s of systems) map.set(s.slug, Object.fromEntries(resolveSystemTokens(s).map((t) => [t.name, t.value])));
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
