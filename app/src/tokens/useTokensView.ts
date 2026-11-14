import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lintTokens, parseTokens } from "../../../src/core/parse.js";
import { categorize } from "../../../src/core/taxonomy.js";
import { coverage } from "../../../src/core/schema.js";
import { systemTokenMap } from "../systems/store.ts";
import type { DesignSystem, Token, TokenGroup, TokenGroupKind } from "../systems/store.ts";
import type { RailGroups, RailLink } from "../lib/railTypes.ts";
import type { PushToast } from "../lib/toasts.ts";
import { readViewUrl } from "../lib/urlState.ts";

/** Anchor ids — Rail links point at these, so both sides share the builders. */
export const groupAnchor = (id: string) => `tok-group-${id}`;
export const schemaAnchor = (id: string) => `tok-schema-${id}`;

/** Rail parent labels per token kind, in the fixed KIND_ORDER below. */
export const KIND_LABELS: Record<TokenGroupKind, string> = {
  color: "Color",
  type: "Typography",
  length: "Size & Spacing",
  shadow: "Shadow",
  motion: "Motion",
  number: "Number",
  raw: "Other",
};

/** Gallery + rail group order: the palette first, component/raw groups last.
   Stored systems (e.g. perp-ultra-v2) keep component groups first, so the
   view sorts by kind once in the `groups` memo instead of following stored
   order. */
const KIND_ORDER: readonly TokenGroupKind[] = [
  "color",
  "type",
  "length",
  "shadow",
  "motion",
  "number",
  "raw",
];

const KIND_RANK: Record<TokenGroupKind, number> = {
  color: 0,
  type: 1,
  length: 2,
  shadow: 3,
  motion: 4,
  number: 5,
  raw: 6,
};

export interface CoverageGroup {
  id: string;
  label: string;
  expected: number;
  present: string[];
  missing: string[];
}

export interface CoverageInfo {
  groups: CoverageGroup[];
  extra: string[];
  expected: number;
  present: number;
  missing: number;
  extraCount: number;
}

export interface LintWarning {
  name: string;
  value: string;
  msg: string;
}

export interface VisibleGroup {
  group: TokenGroup;
  tokens: Token[];
  missing: string[];
}

/**
 * Backwards-compatible alias for `systemTokenMap` — the single source of truth
 * for a system's token values (shared by the Tokens tab, Preview, coverage,
 * Compare columns and the diff). Kept so existing imports/call sites do not
 * fork the merge order.
 */
export function tokenValueMap(system: DesignSystem | null): Map<string, string> {
  return systemTokenMap(system);
}

/** Turkish-locale match — the old viewer used plain toLowerCase, the
   preview side already had toLocaleLowerCase("tr"); the port carries it. */
const trLower = (s: string) => s.toLocaleLowerCase("tr");

/**
 * Tokens tab view model. Filter/showMissing/schemaMode/selected are view-local
 * (nothing here persists — the old viewer kept them in module state too);
 * systems data itself lives in systems/store.ts.
 */
export function useTokensView(system: DesignSystem | null, pushToast: PushToast) {
  // Seeded from ?f= / ?tv= so a copied Tokens link reopens with the same
  // filter and schema/gallery mode (an unknown tv falls back to gallery —
  // readViewUrl normalises it to null). App's URL effect keeps both in sync
  // while the Tokens tab is active.
  const [filter, setFilter] = useState(() => readViewUrl().f ?? "");
  const [showMissing, setShowMissing] = useState(true);
  const [schemaMode, setSchemaMode] = useState(() => readViewUrl().tv === "schema");
  const [selectedName, setSelectedName] = useState<string | null>(null);

  // Switching systems resets the view, like the old selectSystem did — but
  // the first arrival (async store load, or a mount already holding one)
  // keeps URL-seeded view state (?f= / ?tv=), so a copied Tokens link
  // reopens with its filter and mode instead of flashing then clearing them.
  const slug = system?.slug ?? "";
  const prevSlugRef = useRef(slug);
  useEffect(() => {
    const prev = prevSlugRef.current;
    prevSlugRef.current = slug;
    if (!prev || prev === slug) return;
    setFilter("");
    setSchemaMode(false);
    setSelectedName(null);
  }, [slug]);

  const css = system?.css ?? "";
  // The displayed/selectable values come from the shared source of truth
  // so SchemaView, the copy flow and Preview all agree.
  const tokens = useMemo(() => (css ? (parseTokens(css) as Token[]) : []), [css]);
  const valueMap = useMemo(() => tokenValueMap(system), [system]);

  // Coverage is always computed live: stored snapshots go stale when the
  // schema grows and then silently break "Show missing" + missing rows.
  const cov = useMemo(
    () => coverage(tokens.map((t) => t.name)) as CoverageInfo,
    [tokens],
  );
  const warnings = useMemo(() => (tokens.length ? (lintTokens(tokens) as LintWarning[]) : []), [tokens]);

  // Ordered by kind in the fixed KIND_ORDER (palette first, raw last):
  // the gallery (visibleGroups) and the rail (railGroups) both read from
  // this memo, so they stay in the same order. The sort is stable, so
  // groups of one kind keep their stored (or `categorize`) order.
  const groups = useMemo<TokenGroup[]>(
    () => {
      const base: TokenGroup[] = system?.groups?.length
        ? system.groups
        : (categorize(tokens) as TokenGroup[]);
      return [...base].sort(
        (a, b) => (KIND_RANK[a.kind] ?? KIND_ORDER.length) - (KIND_RANK[b.kind] ?? KIND_ORDER.length),
      );
    },
    [system, tokens],
  );

  const q = trLower(filter.trim());
  const searching = q.length > 0;
  const matchTok = (name: string) => !q || trLower(name).includes(q);

  const missingByCat = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const g of cov.groups) m.set(g.id, g.missing.filter(matchTok));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cov, q]);

  const visibleGroups = useMemo<VisibleGroup[]>(() => {
    const out: VisibleGroup[] = [];
    for (const group of groups) {
      const matched = group.tokens.filter((t) => matchTok(t.name));
      if (!matched.length) continue;
      out.push({ group, tokens: matched, missing: missingByCat.get(group.id) ?? [] });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, missingByCat, q]);

  // Reference categories the system has *nothing* for yet (old gallery's
  // 0/N sections) — only when showMissing is on.
  const absentGroups = useMemo(() => {
    if (!showMissing) return [];
    const seen = new Set(groups.map((g) => g.id));
    return cov.groups
      // Both conditions (legacy skipped `seen || present`): a category the
      // gallery already renders gets its missing row there, not twice.
      .filter((g) => !seen.has(g.id) && g.present.length === 0)
      .map((g) => ({ ...g, missing: g.missing.filter(matchTok) }))
      .filter((g) => g.missing.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cov, groups, showMissing, q]);

  const shownCount = useMemo(
    () => visibleGroups.reduce((n, g) => n + g.tokens.length, 0),
    [visibleGroups],
  );

  /** Left rail: token categories grouped by kind (gallery) or reference
     groups (schema) — the same Rail component Preview uses, new links. */
  const railGroups = useMemo<RailGroups>(() => {
    if (schemaMode) {
      const links: RailLink[] = [];
      for (const g of cov.groups) {
        const names = g.present.concat(g.missing).filter(matchTok);
        if (!names.length) continue;
        links.push({ id: schemaAnchor(g.id), label: g.label, count: `${g.present.length}/${g.expected}` });
      }
      return links.length ? [["Schema", links]] : [];
    }
    // visibleGroups already follows KIND_ORDER, so first-appearance here is that fixed order.
    const byKind = new Map<string, RailLink[]>();
    for (const { group, tokens: toks } of visibleGroups) {
      const label = KIND_LABELS[group.kind] ?? "Other";
      if (!byKind.has(label)) byKind.set(label, []);
      byKind.get(label)?.push({ id: groupAnchor(group.id), label: group.label, count: toks.length });
    }
    return [...byKind.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaMode, cov, visibleGroups, q]);

  // A schema token with no value still selects: the inspector owns the
  // "Not set" / Add-token state, so selection must not vanish for a missing
  // name (the gallery only lists present tokens; Schema lists both).
  const selected: Token | null = useMemo(() => {
    if (!selectedName) return null;
    return { name: selectedName, value: valueMap.get(selectedName) ?? "" };
  }, [selectedName, valueMap]);
  const selectedMissing = selected !== null && !valueMap.has(selected.name);

  // Stable identities: TokenGroup/rows.tsx renderers are memo()'d so 432+
  // token systems don't repaint every keystroke — a callback recreated each
  // render would defeat that memo for every row.
  /** Click-a-token: select it for the inspector + copy `--name: value;`
     (old copy-on-click, with the "Copy failed" fallback toast). */
  const copyToken = useCallback(
    (token: Token) => {
      setSelectedName(token.name);
      const text = `${token.name}: ${token.value};`;
      try {
        const clip = navigator.clipboard;
        if (!clip) return pushToast("Copy failed", "err");
        clip.writeText(text).then(
          () => pushToast(`${token.name} copied`, "ok"),
          () => pushToast("Copy failed", "err"),
        );
      } catch {
        pushToast("Copy failed", "err");
      }
    },
    [pushToast],
  );

  /** Rows: select-only. Clicking a token (gallery or schema) inspects it in
     the right rail; it never copies or opens an inline editor. Copy lives on
     the props-rail Copy button, which still calls copyToken. Stable identity
     so the memo()'d row renderers don't repaint every keystroke. */
  const selectToken = useCallback((token: Token) => setSelectedName(token.name), []);

  return {
    filter,
    setFilter,
    showMissing,
    setShowMissing,
    schemaMode,
    setSchemaMode,
    searching,
    matchTok,
    tokens,
    valueMap,
    cov,
    warnings,
    visibleGroups,
    absentGroups,
    shownCount,
    railGroups,
    selected,
    selectedMissing,
    setSelectedName,
    pushToast,
    copyToken,
    selectToken,
  };
}

export type TokensViewModel = ReturnType<typeof useTokensView>;
