// ============================================
// THEME LOCALSTORAGE MANAGEMENT
// ============================================

import { parseTokens } from "../../../src/core/parse.js";

const PREFIX = "theme:" as const;
const REGISTRY_KEY = "theme:registry" as const;
const ACTIVE_KEY = "theme:active" as const;

export type ThemeId = string;

/** Application target — HTMLElement, since that's what carries `.style`. */
export type StyleTarget = HTMLElement;

// -------------------- VALIDATION --------------------

export function isValidCssText(cssText: unknown): cssText is string {
  return typeof cssText === "string" && cssText.trim().length > 0;
}

// -------------------- THEME CRUD --------------------

export function saveTheme(id: ThemeId, cssText: string): boolean {
  if (!isValidCssText(cssText)) {
    console.error(`saveTheme: invalid cssText, "${id}" not saved`);
    return false;
  }
  localStorage.setItem(PREFIX + id, cssText);
  addToRegistry(id);
  return true;
}

export function getTheme(id: ThemeId): string | null {
  return localStorage.getItem(PREFIX + id);
}

export function deleteTheme(id: ThemeId): void {
  localStorage.removeItem(PREFIX + id);
  removeFromRegistry(id);
}

export function hasTheme(id: ThemeId): boolean {
  return localStorage.getItem(PREFIX + id) !== null;
}

// -------------------- REGISTRY --------------------

export function getThemeRegistry(): ThemeId[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ThemeId[]) : [];
  } catch {
    return [];
  }
}

export function addToRegistry(id: ThemeId): void {
  const list = getThemeRegistry();
  if (!list.includes(id)) {
    list.push(id);
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(list));
  }
}

export function removeFromRegistry(id: ThemeId): void {
  const list = getThemeRegistry().filter((themeId) => themeId !== id);
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(list));
}

// -------------------- APPLY (WRITE TO DOM) --------------------

export function applyTheme(el: StyleTarget, id: ThemeId): boolean {
  const cssText = getTheme(id);
  if (!isValidCssText(cssText)) {
    console.warn(`applyTheme: "${id}" not found or empty, falling back to default`);
    resetToDefault(el);
    return false;
  }
  el.style.cssText = cssText;
  return true;
}

export function applyResolvedCss(el: StyleTarget, cssText: string): boolean {
  if (!isValidCssText(cssText)) return false;
  el.style.cssText = cssText;
  return true;
}

// -------------------- SINGLE TOKEN UPDATE --------------------

/** CSS custom property name: must start with '--'. */
export type CssVarName = `--${string}`;

export function setToken(el: StyleTarget, key: CssVarName, value: string): void {
  el.style.setProperty(key, value);
}

export function getComputedToken(el: StyleTarget, key: CssVarName): string {
  return getComputedStyle(el).getPropertyValue(key).trim();
}

// -------------------- PERSIST (SAVE) --------------------

export function persistCurrentStyle(el: StyleTarget, id: ThemeId): boolean {
  return saveTheme(id, el.style.cssText);
}

/** One timer per theme id — persisting id "a" then id "b" within the delay
   window must not cancel "a"'s pending save (a single shared timer would). */
const persistTimers = new Map<ThemeId, ReturnType<typeof setTimeout>>();

export function debouncedPersist(el: StyleTarget, id: ThemeId, delay = 300): void {
  const pending = persistTimers.get(id);
  if (pending) clearTimeout(pending);
  persistTimers.set(
    id,
    setTimeout(() => {
      persistTimers.delete(id);
      persistCurrentStyle(el, id);
    }, delay),
  );
}

// -------------------- ACTIVE THEME --------------------

export function getActiveThemeId(): ThemeId {
  return localStorage.getItem(ACTIVE_KEY) ?? "default";
}

export function setActiveThemeId(id: ThemeId): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

// -------------------- RESET --------------------

export function resetToDefault(el: StyleTarget): void {
  el.removeAttribute("style");
}

// -------------------- FLEXIBLE INPUT RESOLUTION (CSS text | JSON model) --------------------

export interface TokenLike {
  name: string;
  value: string;
}

/** DesignSystem-shaped input: whatever has `.groups[].tokens[]` (see systems/store.ts). */
export interface GroupedTokenSource {
  groups: { tokens: TokenLike[] }[];
}

/** Accepted theme input: raw CSS text, a flat token list, or a grouped (DesignSystem) model. */
export type ThemeInput = string | TokenLike[] | GroupedTokenSource;

/** Reduces any accepted input down to a flat `{name, value}` list.
 *  For a string, parses `--name: value;` pairs (with or without a `:root{}` wrapper). */
export function resolveTokens(input: ThemeInput): TokenLike[] {
  if (typeof input === "string") return parseTokens(input);
  if (Array.isArray(input)) return input;
  if (input && Array.isArray(input.groups)) return input.groups.flatMap((g) => g.tokens);
  return [];
}

/** Converts any accepted input into flat declaration text ready for
 *  `el.style.cssText` (no `:root{}` wrapper — this is for inline style). */
export function resolveToCssText(input: ThemeInput): string {
  return resolveTokens(input)
    .map((t) => `${t.name}:${t.value}`)
    .join(";");
}

/** Applies CSS text or JSON (DesignSystem/groups) input directly to an
 *  element in one DOM write — the caller doesn't need to pre-convert to cssText. */
export function applyResolvedTheme(el: StyleTarget, input: ThemeInput): boolean {
  return applyResolvedCss(el, resolveToCssText(input));
}
