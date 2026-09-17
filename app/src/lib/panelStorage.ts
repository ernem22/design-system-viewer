// ============================================
// PANEL OPEN/CLOSED STATE (localStorage)
// ============================================
// The left rail (Rail.tsx) and right properties panel (Props.tsx) share the
// same collapse affordance: the user's last-chosen open/closed state is kept
// in localStorage so it survives a page reload. If storage is unreachable
// (private tab, disabled site data, etc.) this silently falls back to
// `defaultOpen` — the panel's operation shouldn't depend on it.

import { useCallback, useState } from "react";

export type PanelStorageKey = "dsv.app.rail" | "dsv.app.props";

/** Reads the stored panel state; returns `defaultOpen` if unset or storage is unreachable. */
export function readPanelOpen(key: PanelStorageKey, defaultOpen: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? defaultOpen : stored !== "closed";
  } catch {
    return defaultOpen;
  }
}

/** Persists the panel state; silently no-ops if storage is unreachable. */
export function writePanelOpen(key: PanelStorageKey, open: boolean): void {
  try {
    localStorage.setItem(key, open ? "open" : "closed");
  } catch {
    /* storage unreachable — state lives for this session only */
  }
}

/** Persisted panel open/close state. `App` uses this for both panels
 *  (toggles live in the topbar, state flows down to `Rail`/`Props` as props):
 *  restored via `readPanelOpen` on first render; `toggle` and `reveal` write
 *  every change to both state and localStorage. */
export function usePanelOpen(
  key: PanelStorageKey,
  defaultOpen = true,
): [open: boolean, toggle: () => void, reveal: () => void] {
  const [open, setOpen] = useState(() => readPanelOpen(key, defaultOpen));
  const toggle = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      writePanelOpen(key, next);
      return next;
    });
  }, [key]);
  const reveal = useCallback(() => {
    writePanelOpen(key, true);
    setOpen(true);
  }, [key]);
  return [open, toggle, reveal];
}
