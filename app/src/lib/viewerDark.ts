// Viewer dark chrome (issue #115). The viewer owns the chrome — topbar, rails,
// props frame — while a per-system dark theme is the system's own data. Only
// aurora and minimax ship `themes.dark` in the catalogue, so gating a dark
// control on `active.themes.dark` dead-ends the other 35 systems: no control,
// no way forward. This is the viewer-level dark mode the legacy `[data-theme]`
// branch provided, independent of the system's tokens; the per-system Dark
// variant (App.tsx) still overlays the system's own tokens on top.
import { useCallback, useEffect, useState } from "react";

/** Persisted choice. Not `dsv.theme` (the legacy viewer key) because this
 *  control postdates the system-variant switch, and the two must not share a
 *  value: one repaints the chrome, the other swaps the inspected system. */
export const VIEWER_DARK_KEY = "dsv.viewer.dark";

export function readViewerDark(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(VIEWER_DARK_KEY) === "1";
  } catch {
    return false;
  }
}

/** Apply the viewer theme to the root element, which the chrome's
 *  `[data-theme="dark"]` rules key off (shell.css). Persisted so a reload
 *  keeps the choice, like every other viewer preference. */
export function applyViewerDark(on: boolean): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = on ? "dark" : "light";
  }
  try {
    window.localStorage.setItem(VIEWER_DARK_KEY, on ? "1" : "0");
  } catch {
    /* private mode / file:// — the toggle still works for this session */
  }
}

export function useViewerDark(): [boolean, (on: boolean) => void] {
  const [dark, setDark] = useState<boolean>(readViewerDark);
  // Apply on every commit, so the first render (which does not run a paint
  // before effects) still lands the attribute before the user sees the chrome.
  useEffect(() => {
    applyViewerDark(dark);
  }, [dark]);
  const toggle = useCallback((on: boolean) => {
    setDark(on);
    applyViewerDark(on);
  }, []);
  return [dark, toggle];
}
