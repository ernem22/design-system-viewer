import { useCallback, useEffect, useMemo, useState } from "react";
import { lintTokens, parseTokens } from "../../../src/core/parse.js";
import { categorize } from "../../../src/core/taxonomy.js";
import { coverage } from "../../../src/core/schema.js";
import type { DesignSystem, Token, TokenGroup, TokenGroupKind } from "../systems/store.ts";
import type { RailGroups, RailLink } from "../lib/railTypes.ts";

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

export interface Toast {
  id: number;
  msg: string;
  tone: "ok" | "err";
}

let toastId = 0;

/** Turkish-locale match — the old viewer used plain toLowerCase, the
   preview side already had toLocaleLowerCase("tr"); the port carries it. */
const trLower = (s: string) => s.toLocaleLowerCase("tr");

/**
 * Tokens tab view model. Filter/showMissing/schemaMode/selected are
 * view-local (nothing here persists — the old viewer kept them in module
 * state too); systems data itself lives in systems/store.ts.
 */
export function useTokensView(system: DesignSystem | null) {
  const [filter, setFilter] = useState("");
  const [showMissing, setShowMissing] = useState(true);
  const [schemaMode, setSchemaMode] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Switching systems resets the view, like the old selectSystem did.
  const slug = system?.slug ?? "";
  useEffect(() => {
    setFilter("");
    setSchemaMode(false);
    setSelectedName(null);
  }, [slug]);

  const css = system?.css ?? "";
  const tokens = useMemo(() => (css ? (parseTokens(css) as Token[]) : []), [css]);
  const valueMap = useMemo(() => new Map(tokens.map((t) => [t.name, t.value])), [tokens]);

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
      .filter((g) => !seen.has(g.id) || g.present.length === 0)
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
  const pushToast = useCallback((msg: string, tone: Toast["tone"] = "ok") => {
    const id = ++toastId;
    setToasts((cur) => [...cur, { id, msg, tone }]);
    setTimeout(() => setToasts((cur) => cur.filter((t) => t.id !== id)), 2600);
  }, []);

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
    toasts,
    pushToast,
    copyToken,
  };
}

export type TokensViewModel = ReturnType<typeof useTokensView>;
