import { useCallback, useEffect, useState } from "react";
import { buildSystem, mergeSystem, parseTokens } from "../../../src/core/parse.js";
import { categorize } from "../../../src/core/taxonomy.js";
import { coverage } from "../../../src/core/schema.js";
import { readViewUrl } from "../lib/urlState.ts";

export interface Token {
  name: string;
  value: string;
}

/** Token category — mirrors src/core/taxonomy.js Category (id/kind drive
   the gallery renderer dispatch, so the type must carry them, not just
   label/tokens). */
export type TokenGroupKind = "color" | "type" | "length" | "shadow" | "motion" | "number" | "raw";

export interface TokenGroup {
  id: string;
  label: string;
  kind: TokenGroupKind;
  tokens: Token[];
}

export interface DesignSystem {
  slug: string;
  name: string;
  css: string;
  groups: TokenGroup[];
  coverage?: { present: number; expected: number };
  themes?: { dark?: Token[] };
  createdAt: string;
  updatedAt: string;
}

export function coveragePercent(cov: DesignSystem["coverage"]): number | null {
  return cov?.expected ? Math.round((cov.present / cov.expected) * 100) : null;
}

const SYSTEMS_KEY = "dsv.app.systems";
const ACTIVE_KEY = "dsv.app.active";
const LEGACY_SYSTEMS_KEY = "dsv.systems";

/* Offline fallback only — first boot normally loads the bundled repo
   systems (see fetchBundled). */
const SEED_CSS = `
--color-bg: #0a0a0f;
--color-surface: #14141a;
--color-surface-raised: #1c1c22;
--color-surface-overlay: #23232c;
--color-surface-sunken: #08080c;
--color-surface-inverse: #f0f0f3;
--color-text: #f0f0f3;
--color-text-secondary: #a1a1b0;
--color-text-muted: #71717a;
--color-text-disabled: #52525c;
--color-text-link: #818cf8;
--color-text-inverse: #0a0a0f;
--color-text-on-accent: #ffffff;
--color-border: #25252e;
--color-border-subtle: #1c1c22;
--color-border-strong: #3a3a46;
--color-divider: #25252e;
--color-accent: #6366f1;
--color-accent-hover: #818cf8;
--color-accent-active: #4f46e5;
--color-accent-subtle: #232344;
--color-accent-muted: #34346a;
--color-accent-border: #4c4ca8;
--color-accent-text: #a5b4fc;
--color-on-accent: #ffffff;
--color-accent-secondary: #22d3ee;
--color-success: #22c55e;
--color-on-success: #06210f;
--color-warning: #f59e0b;
--color-on-warning: #2a1a02;
--color-danger: #ef4444;
--color-on-danger: #2a0a0a;
--color-info: #38bdf8;
--color-on-info: #08222e;
--color-input-bg: #14141a;
--color-input-border: #2e2e3a;
--color-input-border-focus: #4c4ca8;
--color-input-placeholder: #71717a;
--color-input-text: #f0f0f3;
--color-focus-ring: #6366f1;
--color-hover-overlay: rgba(255,255,255,0.06);
--font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
--font-size-xs: 11px;
--font-size-sm: 12.5px;
--font-size-base: 14px;
--font-size-lg: 16px;
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
--line-height-tight: 1.25;
--line-height-normal: 1.6;
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 14px;
--radius-full: 999px;
--border-width-thin: 1px;
--shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
--shadow-md: 0 4px 16px rgba(0,0,0,0.45);
--duration-fast: 150ms;
--duration-normal: 250ms;
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--z-modal: 1400;
--icon-stroke-width: 2;
--focus-ring-width: 2px;
--focus-ring-offset: 2px;
--focus-ring-radius: 6px;
--touch-target-min: 44px;
`;

function seed(): DesignSystem[] {
  return [buildSystem({ name: "Aurora", css: SEED_CSS }) as DesignSystem];
}

/** Stored systems predate the id/kind type (or were hand-edited) — rebuild
   their groups from source CSS instead of rendering a dispatch with no key. */
function ensureGroups(sys: DesignSystem): DesignSystem {
  const groups = sys.groups;
  if (
    Array.isArray(groups) &&
    groups.length > 0 &&
    groups.every((g) => typeof g.id === "string" && typeof g.kind === "string")
  )
    return sys;
  try {
    return { ...sys, groups: categorize(parseTokens(sys.css ?? "")) as TokenGroup[] };
  } catch {
    return sys;
  }
}

function isPristineSeed(list: DesignSystem[]): boolean {
  if (list.length !== 1) return false;
  const [only] = list;
  return only.createdAt === only.updatedAt && only.css === seed()[0].css;
}

/** null = never saved in this browser (boot from the bundled index);
   [] = the user deleted everything, which must survive a reload. The
   legacy viewer's key is read once so its saved systems carry over. */
function readStored(): DesignSystem[] | null {
  for (const key of [SYSTEMS_KEY, LEGACY_SYSTEMS_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      const arr: unknown = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;
      // Earlier builds auto-persisted the seed on first boot; an untouched
      // copy means "never saved", or the bundled systems would never load.
      if (key === SYSTEMS_KEY && isPristineSeed(arr as DesignSystem[])) return null;
      return (arr as DesignSystem[]).map(ensureGroups);
    } catch {
      /* corrupted entry — try the next source */
    }
  }
  return null;
}

/** The reason a reachable host gave for a failed index response — the same
   status-line shape lib/cssImport.ts reports, so one failure reads the same
   wherever the app shows it. */
function fetchFailure(res: Response): string {
  return `${res.status} ${res.statusText}`.trim();
}

/** The repo's systems, served/emitted by the vite plugin in vite.config.ts.
   Unreachable (plain file://, stripped deploy) → the built-in seed, and the
   reason is carried back with it so Preview can report the failure instead of
   looking silently empty (issue #91). The seed fallback itself is unchanged:
   the gallery keeps rendering with fallback tokens. An index that answers 200
   but ships no systems is not a failure — it falls back without an error. */
async function fetchBundled(): Promise<{ list: DesignSystem[]; error: string | null }> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}systems/index.json`);
    if (res.ok) {
      const arr: unknown = await res.json();
      if (Array.isArray(arr) && arr.length > 0)
        return { list: (arr as DesignSystem[]).map(ensureGroups), error: null };
    } else {
      return { list: seed(), error: fetchFailure(res) };
    }
  } catch (e) {
    return { list: seed(), error: e instanceof Error ? e.message : String(e) };
  }
  return { list: seed(), error: null };
}

function readActive(list: DesignSystem[]): string {
  try {
    // A deep-linked ?sys= wins over the persisted choice (unknown slugs
    // fall through).
    const linked = readViewUrl().sys;
    if (linked && list.some((s) => s.slug === linked)) return linked;
    const saved = localStorage.getItem(ACTIVE_KEY);
    if (saved && list.some((s) => s.slug === saved)) return saved;
  } catch {
    /* ignore */
  }
  return list[0]?.slug ?? "";
}

/** localStorage-backed systems source, first booted from the bundled index. */
export function useSystems() {
  const [stored] = useState(readStored);
  const [systems, setSystems] = useState<DesignSystem[]>(() => stored ?? []);
  const [loading, setLoading] = useState(stored === null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSlug, setActiveSlugState] = useState<string>(() => readActive(systems));

  useEffect(() => {
    if (stored !== null) return;
    let alive = true;
    fetchBundled().then(({ list, error }) => {
      if (!alive) return;
      setSystems(list);
      setActiveSlugState(readActive(list));
      setLoadError(error);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [stored]);

  const setActiveSlug = useCallback((slug: string) => {
    setActiveSlugState(slug);
    try {
      localStorage.setItem(ACTIVE_KEY, slug);
    } catch {
      /* ignore */
    }
  }, []);

  const active = systems.find((s) => s.slug === activeSlug) ?? systems[0] ?? null;

  const persist = useCallback((list: DesignSystem[]) => {
    try {
      localStorage.setItem(SYSTEMS_KEY, JSON.stringify(list));
    } catch {
      /* private mode / quota — run in-memory */
    }
  }, []);

  /** Every mutation rebuilds through buildSystem/mergeSystem (groups +
     coverage + warnings stay derived, never hand-edited) and persists. */
  const addSystem = useCallback(
    (name: string, css: string): DesignSystem => {
      const built = buildSystem({ name, css }) as DesignSystem;
      if (systems.some((s) => s.slug === built.slug))
        throw new Error(`"${built.slug}" already exists — use Add Tokens to merge`);
      const next = [...systems, built];
      setSystems(next);
      persist(next);
      setActiveSlug(built.slug);
      return built;
    },
    [systems, persist, setActiveSlug],
  );

  const mergeCss = useCallback(
    (slug: string, css: string): DesignSystem => {
      const existing = systems.find((s) => s.slug === slug);
      if (!existing) throw new Error("system to merge not found");
      const merged = mergeSystem(existing, css) as DesignSystem;
      const next = systems.map((s) => (s.slug === slug ? merged : s));
      setSystems(next);
      persist(next);
      return merged;
    },
    [systems, persist],
  );

  /** Single-token write — the inline editor's path. One bare line,
     last-write-wins, same merge pipeline as a pasted block. */
  const patchToken = useCallback(
    (slug: string, name: string, value: string): DesignSystem =>
      mergeCss(slug, `${name}: ${value};`),
    [mergeCss],
  );

  const removeSystem = useCallback(
    (slug: string) => {
      const next = systems.filter((s) => s.slug !== slug);
      setSystems(next);
      persist(next);
      if (active?.slug === slug) setActiveSlug(next[0]?.slug ?? "");
    },
    [systems, persist, active, setActiveSlug],
  );

  return {
    systems,
    loading,
    error: loadError,
    active,
    activeSlug: active?.slug ?? "",
    setActiveSlug,
    addSystem,
    mergeCss,
    patchToken,
    removeSystem,
  };
}

/** Coverage is recomputed from the CSS, never read from the stored
   snapshot: those go stale when the schema grows and report bogus numbers.
   Keyed by slug + the whole CSS text, so *any* change to the text — including
   a same-length edit in the middle — misses and a stale entry is never
   served. Hashing the full string per call is acceptable because the only hot
   caller, SystemSwitcher, memoizes its slug→pct map on the systems list, so
   this is reached only when that list changes, not on every keystroke render. */
export const PCT_CACHE_MAX = 200;
/** Bounded LRU (insertion order, re-inserted on hit). One overflow evicts
   the coldest entry instead of `clear()`ing every warm system at once. */
const pctCache = new Map<string, number | null>();

function pctCacheKey(system: DesignSystem): string {
  return `${system.slug}\u0000${system.css ?? ""}`;
}

function pctCacheGet(key: string): number | null | undefined {
  if (!pctCache.has(key)) return undefined;
  const value = pctCache.get(key) as number | null;
  pctCache.delete(key);
  pctCache.set(key, value);
  return value;
}

function pctCacheSet(key: string, value: number | null): void {
  if (pctCache.has(key)) pctCache.delete(key);
  pctCache.set(key, value);
  while (pctCache.size > PCT_CACHE_MAX) {
    const oldest = pctCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    pctCache.delete(oldest);
  }
}

export function systemCoveragePercent(system: DesignSystem | null | undefined): number | null {
  if (!system) return null;
  const key = pctCacheKey(system);
  const hit = pctCacheGet(key);
  if (hit !== undefined) return hit;
  let pct: number | null = null;
  try {
    const names = (parseTokens(system.css) as Token[]).map((t) => t.name);
    pct = coveragePercent(coverage(names) as DesignSystem["coverage"]);
  } catch {
    /* unparsable — no badge */
  }
  pctCacheSet(key, pct);
  return pct;
}

/** Flat token list for a system — base values, plus its dark variant on
   top (later wins) when `dark` is on and the system ships one. */
export function resolveSystemTokens(system: DesignSystem | null, dark = false): Token[] {
  const base = system?.groups?.flatMap((g) => g.tokens) ?? [];
  const darkTokens = dark ? (system?.themes?.dark ?? []) : [];
  return darkTokens.length ? [...base, ...darkTokens] : base;
}
