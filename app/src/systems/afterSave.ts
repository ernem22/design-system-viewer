// ============================================
// ADD-DIALOG "OPEN IN" PREFERENCE (localStorage)
// ============================================
// The Add-system dialog's footer segmented control remembers which tab to
// land on after a save. The React migration renamed both the storage key
// (`dsv.afterSave` -> `dsv.app.afterSave`) and one of its values (`system` ->
// `tokens`), so a choice the legacy viewer saved (src/viewer/app.js:19-20,
// where TABS = ["system", "preview", "compare"]) silently stopped being read.
// This module is the single reader/writer: it honours the legacy key+value
// once, migrates them onto the canonical spelling, and never surfaces an
// unknown/malformed value as an empty selection.

import type { AppTab } from "../shell/Shell.ts";

/** Canonical key written from now on (matches the other `dsv.app.*` keys). */
export const AFTER_SAVE_KEY = "dsv.app.afterSave";
/** The legacy viewer's key — read once, then migrated onto `AFTER_SAVE_KEY`. */
export const LEGACY_AFTER_SAVE_KEY = "dsv.afterSave";
/** Canonical tabs, in the order the dialog shows them. */
export const AFTER_SAVE_TABS: [AppTab, string][] = [
  ["tokens", "Tokens"],
  ["preview", "Preview"],
  ["compare", "Compare"],
];
/** Fallback when nothing valid is stored. */
export const AFTER_SAVE_DEFAULT: AppTab = "preview";

// The legacy tab spelled the Tokens view "system". Stored legacy values use
// that spelling, so accept it as an alias and canonicalize it on the way in.
const LEGACY_VALUE_ALIASES: Record<string, AppTab> = { system: "tokens" };

const KNOWN_TABS = AFTER_SAVE_TABS.map(([id]) => id);

/** Canonical tab for a stored string, or null when it is unknown/malformed. */
function canonical(value: string | null): AppTab | null {
  if (value === null) return null;
  if ((KNOWN_TABS as string[]).includes(value)) return value as AppTab;
  return LEGACY_VALUE_ALIASES[value] ?? null;
}

/**
 * Reads the effective "Open in" preference. A preference found under the
 * legacy key (or under the canonical key with a legacy value) is translated
 * and written back with the canonical key+value, so the migration is one-time.
 * Unknown or malformed values fall back to the default.
 */
export function readAfterSave(): AppTab {
  try {
    const rawCurrent = localStorage.getItem(AFTER_SAVE_KEY);
    const current = canonical(rawCurrent);
    if (current) {
      if (rawCurrent !== current) writeAfterSave(current);
      return current;
    }
    const legacy = canonical(localStorage.getItem(LEGACY_AFTER_SAVE_KEY));
    if (legacy) {
      writeAfterSave(legacy);
      localStorage.removeItem(LEGACY_AFTER_SAVE_KEY);
      return legacy;
    }
  } catch {
    /* storage unreachable */
  }
  return AFTER_SAVE_DEFAULT;
}

/** Persists the preference under the canonical key+value spelling. */
export function writeAfterSave(tab: AppTab): void {
  try {
    localStorage.setItem(AFTER_SAVE_KEY, tab);
  } catch {
    /* storage unreachable — state lives for this session only */
  }
}
