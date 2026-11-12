// ============================================
// SCROLLSPY (shared landing offset, stateless scan)
// ============================================
// Tracks which of a set of section ids is currently "current" inside the
// scrollable content area, so a side rail can highlight the matching link
// without every caller re-deriving that logic — one hook, reused by Tokens,
// Preview and Compare, each handing it their own (differently shaped) id list.
//
// One landing offset decides both sides of a click: an anchor scrolls a
// section's top to `--app-rail-landing-offset` below the scroller's top edge,
// and this scan calls the section whose top has passed that same line
// "current". Because both read the identical offset, the id a click lands on
// is by construction the id the scan reports — no click-pin is needed (the
// app's anchor jumps are instant; there is no smooth scroll to survive).
//
// The offset is read from a followed element's resolved `scroll-margin-top`
// (the same token the section CSS uses), falling back to a fixed default when
// no element is measurable (happy-dom has no cascade). It is not a separate
// constant that can drift from the CSS.
//
// The scan recomputes from live geometry on every tick — it accumulates no
// state across ticks, so nothing can go stale (an earlier IntersectionObserver
// ratio implementation did, and it out-ranked short sections on nothing).
// Each anchor's offset in the scroller's content space is cached and only
// rebuilt on resize / refresh / id change, so a scroll tick compares two
// numbers per section instead of calling getBoundingClientRect on each.

import { useCallback, useEffect, useRef, useState } from "react";

/** Fallback landing offset (topbar + one space step ≈ 60px) used only when no
 *  followed element is measurable to read its own resolved scroll-margin-top.
 *  Kept in step with `--app-rail-landing-offset` in shell.css by
 *  lib/scrollspy.test.ts. */
export const DEFAULT_LANDING_OFFSET_PX = 60;

/** Resolved landing offset for these ids: the first followed element's own
 *  computed `scroll-margin-top`, so the scan's activation line and the anchor
 *  jump cannot disagree. Falls back to the fixed default when none resolve. */
function landingOffset(ids: string[]): number {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (typeof getComputedStyle !== "function") break;
    const value = parseFloat(getComputedStyle(el).scrollMarginTop);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return DEFAULT_LANDING_OFFSET_PX;
}

/** Id of the section currently current among `ids`, or `null` when none of
 *  them exist in the DOM yet. `refresh` rebuilds the offset cache when the
 *  rail's own DOM changes without a resize (a group opened or collapsed),
 *  which would otherwise leave every cached offset below it stale. */
export function useScrollSpy(ids: string[], enabled = true): [string | null, () => void] {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    // Inactive (forceMounted but hidden) tabs must not pay for live tracking:
    // their output is display:none, so every rect measures ~0 and the scan
    // would only produce meaningless noise on top of wasted DOM lookups.
    // Bailing out before subscribing means zero recompute work while hidden;
    // re-enabling resubscribes and schedules a fresh scan, so tracking
    // resumes without requiring a fresh mount.
    if (!enabled) return;
    // The panel that actually scrolls (.app-main), not the viewport: with a
    // viewport line the offset is measured against the window while the
    // content moves inside a nested scroller, so the line and the anchor
    // landing point drift apart.
    const scroller = document.querySelector<HTMLElement>(".app-main");
    if (!scroller) return;

    // id -> top offset inside the scroller's content box, stable while
    // scrolling (it only moves with layout). null until built.
    let offsets: Map<string, number> | null = null;
    let offset = DEFAULT_LANDING_OFFSET_PX;

    const build = () => {
      const map = new Map<string, number>();
      const base = scroller.getBoundingClientRect().top;
      for (const id of idsRef.current) {
        const el = document.getElementById(id);
        if (!el) continue;
        map.set(id, el.getBoundingClientRect().top - base + scroller.scrollTop);
      }
      offsets = map;
      offset = landingOffset(idsRef.current);
    };

    let raf = 0;
    const recompute = () => {
      raf = 0;
      if (!offsets) build();
      // The activation line, expressed in content space, so the cache can be
      // compared without reading a rect per section.
      const line = scroller.scrollTop + offset;
      let best: string | null = null;
      let bestOff = -Infinity;
      let topmost: string | null = null;
      let topmostOff = Infinity;
      for (const [id, off] of offsets!) {
        if (off < topmostOff) {
          topmostOff = off;
          topmost = id;
        }
        if (off <= line && off > bestOff) {
          bestOff = off;
          best = id;
        }
      }
      setActiveId(best ?? topmost);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(recompute);
    };
    // Rebuild eagerly (mount / resize / refresh): the answer must land before
    // the click that triggered it paints, and a scroll tick alone is throttled.
    const invalidate = () => {
      offsets = null;
      recompute();
    };

    invalidate();
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", invalidate);
    return () => {
      cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", invalidate);
    };
  }, [ids, enabled, refreshKey]);

  // Rebuild the offset cache on demand: a group expanding shifts every offset
  // below it, and no resize or change to `ids` fires for that.
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  return [activeId, refresh];
}
