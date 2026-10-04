import { useCallback, useEffect, useState } from "react";

// ============================================
// VIEWER THEME (light / dark chrome)
// ============================================
// The viewer's own theme — independent of the design system under inspection.
// It themes the *chrome* (topbar, rails, dialogs, toasts) via the [data-theme]
// branch in shell/viewerChrome.css and never touches the system's tokens, which
// App applies as inline custom properties. Ported from the legacy viewer
// (src/viewer/app.js `THEME_KEY` / `applyTheme`) so an existing preference and
// the OS-default rule both survive the migration.

export type ViewerTheme = "light" | "dark";

/** Legacy key, kept verbatim so a returning user's choice migrates for free. */
export const VIEWER_THEME_KEY = "dsv.theme";

/** No stored choice -> legacy default: light when the OS prefers light,
 *  dark otherwise. Falls back to dark where `matchMedia` is unavailable. */
export function defaultViewerTheme(): ViewerTheme {
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Stored theme if valid, else the OS default. */
export function readViewerTheme(): ViewerTheme {
  try {
    const stored = localStorage.getItem(VIEWER_THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* storage unreachable — fall through to the OS default */
  }
  return defaultViewerTheme();
}

/** Sets the chrome theme on <html> and persists it. */
export function applyViewerTheme(theme: ViewerTheme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(VIEWER_THEME_KEY, theme);
  } catch {
    /* storage unreachable — the choice lives for this session only */
  }
}

/** Viewer theme state, restored on first render and applied/persisted on every
 *  change (including the first, so the OS default is written like legacy did). */
export function useViewerTheme(): [theme: ViewerTheme, toggle: () => void] {
  const [theme, setTheme] = useState<ViewerTheme>(() => readViewerTheme());
  useEffect(() => {
    applyViewerTheme(theme);
  }, [theme]);
  const toggle = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);
  return [theme, toggle];
}
