import { useCallback, useEffect, useMemo, useState } from "react";
import { lintTokens, parseTokens } from "../../../src/core/parse.js";
import { categorize } from "../../../src/core/taxonomy.js";
import { coverage } from "../../../src/core/schema.js";
import type { DesignSystem, Token, TokenGroup, TokenGroupKind } from "../systems/store.ts";
import type { RailGroups, RailLink } from "../lib/railTypes.ts";
import type { PushToast } from "../lib/toasts.ts";

/** Anchor ids — Rail links point at these, so both sides share the builders. */
export const groupAnchor = (id: string) => `tok-group-${id}`;
export const schemaAnchor = (id: string) => `tok-schema-${id}`;

/** Rail parent labels per token kind, in first-appearance order. */
export const KIND_LABELS: Record<TokenGroupKind, string> = {
  color: "Color",
  type: "Typography",
  length: "Size & Spacing",
  shadow: "Shadow",
  motion: "Motion",
  number: "Number",
  raw: "Other",
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
 * Single source of truth for a system's token values, shared by the Tokens
 * tab and the Preview inspector. Resolved per token in the order App feeds
 * `:root`: `css` first (the authored source), then `groups` over the top
 * token-by-token (groups win, so a groups/css divergence resolves to the value
 * actually applied), then the active `themes.dark` override (what
 * store.resolveSystemTokens adds when dark is on). Reading `css` per token
 * instead of wholesale keeps a token authored only in `css` visible rather
 * than dropping it. `dark` comes from the caller because the toggle lives in
 * App; absent a caller it defaults off. Pure and read-only: no override is
 * dropped and the store is never mutated by rendering.
 */
export function tokenValueMap(system: DesignSystem | null, dark = false): Map<string, string> {
  const values = new Map<string, string>();
  for (const t of parseTokens(system?.css ?? "") as Token[]) values.set(t.name, t.value);
  for (const group of system?.groups ?? []) {
    for (const t of group.tokens) values.set(t.name, t.value);
  }
  if (dark) {
    for (const t of system?.themes?.dark ?? []) values.set(t.name, t.value);
  }
  return values;
}

/** Turkish-locale match — the old viewer used plain toLowerCase, the
   preview side already had toLocaleLowerCase("tr"); the port carries it. */
const trLower = (s: string) => s.toLocaleLowerCase("tr");

/**
 * Tokens tab view model. Filter/showMissing/schemaMode/selected/editingName
 * are view-local (nothing here persists — the old viewer kept them in module
 * state too); systems data itself lives in systems/store.ts.
 */
export function useTokensView(system: DesignSystem | null, pushToast: PushToast, dark = false) {
  const [filter, setFilter] = useState("");
  const [showMissing, setShowMissing] = useState(true);
  const [schemaMode, setSchemaMode] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  // Token whose inline editor popover is open (single-open; only one
  // TokenEditControl renders open at a time).
  const [editingName, setEditingName] = useState<string | null>(null);

  // Switching systems resets the view, like the old selectSystem did.
  const slug = system?.slug ?? "";
  useEffect(() => {
    setFilter("");
    setSchemaMode(false);
    setSelectedName(null);
    setEditingName(null);
  }, [slug]);

  const css = system?.css ?? "";
  // `tokens` stays CSS-derived for coverage/lint (their documented source),
  // but the displayed/selectable values come from the shared source of truth
  // so SchemaView, the copy flow and Preview all agree.
  const tokens = useMemo(() => (css ? (parseTokens(css) as Token[]) : []), [css]);
  // `dark` is part of the key: the map overlays themes.dark when it is on, so a
  // stale [system]-only memo would serve light values across a dark toggle.
  const valueMap = useMemo(() => tokenValueMap(system, dark), [system, dark]);

  // Coverage is always computed live: stored snapshots go stale when the
  // schema grows and then silently break "Show missing" + missing rows.
  const cov = useMemo(
    () => coverage(tokens.map((t) => t.name)) as CoverageInfo,
    [tokens],
  );
  const warnings = useMemo(() => (tokens.length ? (lintTokens(tokens) as LintWarning[]) : []), [tokens]);

  const groups = useMemo<TokenGroup[]>(
    () => (system?.groups?.length ? system.groups : (categorize(tokens) as TokenGroup[])),
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
        links.push({ id: schemaAnchor(g.id), label: `${g.label} · ${g.present.length}/${g.expected}` });
      }
      return links.length ? [["Schema", links]] : [];
    }
    const byKind = new Map<string, RailLink[]>();
    for (const { group, tokens: toks } of visibleGroups) {
      const label = KIND_LABELS[group.kind] ?? "Other";
      if (!byKind.has(label)) byKind.set(label, []);
      byKind.get(label)?.push({ id: groupAnchor(group.id), label: `${group.label} · ${toks.length}` });
    }
    return [...byKind.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaMode, cov, visibleGroups, q]);

  const selected: Token | null = useMemo(() => {
    if (!selectedName) return null;
    const value = valueMap.get(selectedName);
    return value === undefined ? null : { name: selectedName, value };
  }, [selectedName, valueMap]);

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

  /** Inline-editor target: Update button or double-click opens the token's
     Popover, closing it (or opening another) clears the target. Stable
     identity so the memo()'d row renderers don't repaint every keystroke. */
  const onEdit = useCallback((token: Token | null) => {
    setEditingName(token?.name ?? null);
  }, []);

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
    setSelectedName,
    editingName,
    onEdit,
    pushToast,
    copyToken,
  };
}

export type TokensViewModel = ReturnType<typeof useTokensView>;
