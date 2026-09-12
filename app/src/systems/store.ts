import { useCallback, useState } from "react";
import { buildSystem } from "../../../src/core/parse.js";

export interface Token {
  name: string;
  value: string;
}

export interface TokenGroup {
  label: string;
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

const SYSTEMS_KEY = "dsv.app.systems";
const ACTIVE_KEY = "dsv.app.active";

/* Placeholder seed so the ported preview renders something on first boot.
   Real add/edit/save flows come later — this is not the template. */
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

function load(): DesignSystem[] {
  try {
    const raw = localStorage.getItem(SYSTEMS_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as DesignSystem[];
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch {
    /* corrupted storage — fall through to seed */
  }
  const seeded = seed();
  try {
    localStorage.setItem(SYSTEMS_KEY, JSON.stringify(seeded));
  } catch {
    /* private mode — run in-memory */
  }
  return seeded;
}

/** localStorage-only systems source. No /api, no systems/*.json. */
export function useSystems() {
  const [systems] = useState<DesignSystem[]>(load);
  const [activeSlug, setActiveSlugState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_KEY);
      if (saved && systems.some((s) => s.slug === saved)) return saved;
    } catch {
      /* ignore */
    }
    return systems[0]?.slug ?? "";
  });

  const setActiveSlug = useCallback((slug: string) => {
    setActiveSlugState(slug);
    try {
      localStorage.setItem(ACTIVE_KEY, slug);
    } catch {
      /* ignore */
    }
  }, []);

  const active = systems.find((s) => s.slug === activeSlug) ?? systems[0] ?? null;
  return { systems, active, activeSlug, setActiveSlug };
}

const STYLE_ID = "app-tokens";

/** Single-system layer: active system's tokens on :root, so shell + canvas
   repaint together. Compare columns scope their own tokens instead. */
export function injectSystemTokens(system: DesignSystem | null, dark: boolean) {
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
  }
  // Re-append to stay last in <head> — wins over token root + fallbacks.
  document.head.appendChild(el);
  let css = "";
  if (system?.groups) {
    const tokens = system.groups.flatMap((g) => g.tokens);
    if (tokens.length > 0) css = `:root{${tokens.map((t) => `${t.name}:${t.value}`).join(";")}}`;
  }
  const darkTokens = system?.themes?.dark;
  if (dark && darkTokens && darkTokens.length > 0) {
    css += `:root{${darkTokens.map((t) => `${t.name}:${t.value}`).join(";")}}`;
  }
  el.textContent = css;
}
