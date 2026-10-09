// ============================================
// PANEL OPEN/CLOSED STATE (localStorage)
// ============================================
// The left rail (Rail.tsx) and right properties panel (Props.tsx) share the
// same collapse affordance: the user's last-chosen open/closed state is kept
// in localStorage so it survives a page reload. If storage is unreachable
// (private tab, disabled site data, etc.) this silently falls back to
// `defaultOpen` — the panel's operation shouldn't depend on it.

import { useCallback, useEffect, useRef, useState } from "react";

export type PanelStorageKey = "dsv.app.rail" | "dsv.app.props";

// Narrow-viewport breakpoint, shared with the `@media (max-width: 900px)`
// drawer block in `shell/shell.css`. At or below this width the rail and
// props frames stop participating in the grid and float above main as overlay
// drawers (issue #282) — their open state is ephemeral (in-memory, starts
// closed, exclusive) and never touches the stored desktop preference below.
export const NARROW_QUERY = "(max-width: 900px)";

// Phone breakpoint for the topbar overflow menu in `shell/Shell.tsx`: at or
// below this width the action cluster no longer fits next to the tabs, so
// Shell renders it behind a "More actions" menu instead of overflowing.
export const PHONE_QUERY = "(max-width: 480px)";

function matchesQuery(query: string): boolean {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

/** Whether the viewport currently renders panels as overlay drawers. */
export function isNarrowViewport(): boolean {
  return matchesQuery(NARROW_QUERY);
}

/** Reactive narrow-viewport flag; follows `matchMedia` so a resize across
 *  the breakpoint swaps the panel behaviour live. Defaults to desktop when
 *  `matchMedia` is unavailable (SSR, older happy-dom). */
export function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(isNarrowViewport);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(NARROW_QUERY);
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    setNarrow(mql.matches);
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    // Safari < 14 only has the legacy listener API.
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);
  return narrow;
}

/** Reactive phone-viewport flag for the topbar overflow menu. Same shape as
 *  `useNarrowViewport`, different breakpoint. */
export function usePhoneViewport(): boolean {
  const [phone, setPhone] = useState(() => matchesQuery(PHONE_QUERY));
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(PHONE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setPhone(e.matches);
    setPhone(mql.matches);
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);
  return phone;
}

// The legacy viewer (preview/src/App.jsx) persisted the same choices under
// unscoped keys. Returning users still have those, so the first read falls
// back to its legacy key, migrates the value forward, and retires the old one.
const LEGACY_KEYS: Record<PanelStorageKey, string> = {
  "dsv.app.rail": "dsv.rail",
  "dsv.app.props": "dsv.props",
};

/** Reads the stored panel state, migrating the legacy key on first read;
 *  returns `defaultOpen` if unset or storage is unreachable. */
export function readPanelOpen(key: PanelStorageKey, defaultOpen: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) return stored !== "closed";
    const legacy = localStorage.getItem(LEGACY_KEYS[key]);
    if (legacy === null) return defaultOpen;
    localStorage.setItem(key, legacy);
    localStorage.removeItem(LEGACY_KEYS[key]);
    return legacy !== "closed";
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
 *  every change to both state and localStorage.
 *
 *  Narrow viewports (issue #282) never consult the stored desktop preference:
 *  the hook starts closed there and its toggles stay in-memory, so a phone
 *  can neither read nor overwrite what the desktop remembers. */
export function usePanelOpen(
  key: PanelStorageKey,
  defaultOpen = true,
): [open: boolean, toggle: () => void, reveal: () => void] {
  const [open, setOpen] = useState(() =>
    isNarrowViewport() ? false : readPanelOpen(key, defaultOpen),
  );
  const toggle = useCallback(() => {
    if (isNarrowViewport()) {
      // Ephemeral drawer toggle — the stored desktop preference is left alone.
      setOpen((v) => !v);
      return;
    }
    setOpen((v) => {
      const next = !v;
      writePanelOpen(key, next);
      return next;
    });
  }, [key]);
  const reveal = useCallback(() => {
    if (!isNarrowViewport()) writePanelOpen(key, true);
    setOpen(true);
  }, [key]);
  return [open, toggle, reveal];
}

/** Which narrow-viewport drawer is open, if any. One value (not two booleans)
 *  is what makes opening one drawer close the other. */
export type NarrowPanel = "rail" | "props" | null;

export interface Panels {
  railOpen: boolean;
  propsOpen: boolean;
  /** True while the viewport renders panels as overlay drawers. */
  narrow: boolean;
  toggleRail: () => void;
  toggleProps: () => void;
  /** Opens the props drawer (selecting a token badge reveals the panel). */
  revealProps: () => void;
  /** Closes whichever drawer is open; a no-op on desktop and when shut. */
  closePanels: () => void;
}

/** Coordinated rail/props state for `App` (issue #282). Desktop keeps the two
 *  independent persisted `usePanelOpen` values; narrow viewports get one
 *  ephemeral `narrowOpen` instead — both drawers start closed whatever the
 *  stored desktop preference says, opening one closes the other, and narrow
 *  toggles never read or write localStorage. Resizing back to desktop
 *  restores the stored preference, which narrow mode left untouched. */
export function usePanels(): Panels {
  const narrow = useNarrowViewport();
  const [desktopRail, setDesktopRail] = useState(() =>
    isNarrowViewport() ? false : readPanelOpen("dsv.app.rail", true),
  );
  const [desktopProps, setDesktopProps] = useState(() =>
    isNarrowViewport() ? false : readPanelOpen("dsv.app.props", true),
  );
  const [narrowOpen, setNarrowOpen] = useState<NarrowPanel>(null);
  const wasNarrow = useRef(narrow);

  useEffect(() => {
    if (narrow && !wasNarrow.current) {
      // Entering drawer mode with panels open would sheet the content —
      // both drawers start closed, like on a narrow first load.
      setNarrowOpen(null);
    } else if (!narrow && wasNarrow.current) {
      // Back on desktop: re-read the stored preference, which narrow mode
      // never overwrote (it may also predate this session's mount).
      setDesktopRail(readPanelOpen("dsv.app.rail", true));
      setDesktopProps(readPanelOpen("dsv.app.props", true));
    }
    wasNarrow.current = narrow;
  }, [narrow]);

  const toggleRail = useCallback(() => {
    if (isNarrowViewport()) {
      setNarrowOpen((v) => (v === "rail" ? null : "rail"));
      return;
    }
    setDesktopRail((v) => {
      const next = !v;
      writePanelOpen("dsv.app.rail", next);
      return next;
    });
  }, []);

  const toggleProps = useCallback(() => {
    if (isNarrowViewport()) {
      setNarrowOpen((v) => (v === "props" ? null : "props"));
      return;
    }
    setDesktopProps((v) => {
      const next = !v;
      writePanelOpen("dsv.app.props", next);
      return next;
    });
  }, []);

  const revealProps = useCallback(() => {
    if (isNarrowViewport()) {
      setNarrowOpen("props");
      return;
    }
    writePanelOpen("dsv.app.props", true);
    setDesktopProps(true);
  }, []);

  const closePanels = useCallback(() => {
    if (isNarrowViewport()) setNarrowOpen(null);
  }, []);

  if (narrow) {
    return {
      railOpen: narrowOpen === "rail",
      propsOpen: narrowOpen === "props",
      narrow,
      toggleRail,
      toggleProps,
      revealProps,
      closePanels,
    };
  }
  return {
    railOpen: desktopRail,
    propsOpen: desktopProps,
    narrow,
    toggleRail,
    toggleProps,
    revealProps,
    closePanels,
  };
}
