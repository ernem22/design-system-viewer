// ============================================
// SCROLLSPY (activation-line scan)
// ============================================
// Tracks which of a set of section ids is currently "current" inside the
// scrollable content area, so a side rail can highlight the matching link
// without every caller re-deriving that logic — one hook, reused by Tokens,
// Preview and Compare, each handing it their own (differently shaped) id list.
//
// Previous implementation compared IntersectionObserver ratios across ids.
// That broke two ways: (1) a short section fully inside the band always
// out-ranked a tall one merely filling the band, because ratio is scaled by
// the target's OWN height, not by how much of the band it occupies, so
// highlighting jumped between neighbors having nothing to do with what was
// actually under the header; (2) pinning (see below) skipped the callback
// entirely, including the bookkeeping that removes an id from the ratio map
// when it scrolls out of view — so a stale high ratio from minutes earlier
// (e.g. the very first section, fully visible at mount) could sit in the map
// forever and keep "winning" once the pin released, snapping the highlight
// back to it regardless of actual scroll position. This rewrite recomputes
// the answer from live geometry on every tick instead of accumulating any
// state across ticks, so there is nothing left around to go stale.

import { useEffect, useRef, useState } from "react";

/** Fixed px below the scroller's own top edge that counts as "current" —
 *  matches the scroll-margin-top the followed sections/blocks land at
 *  (gallery.css / TokenGroup.css), so the id landed-on by a click is the
 *  same one the scan reports as active. Px, not %, so it doesn't drift with
 *  panel height. */
const ACTIVATION_OFFSET = 100;

/** Keys whose default action scrolls the content area. A keydown that isn't
 *  one of these (a letter typed into the search box, Escape, a shortcut) is
 *  never the user's own scroll intent, so it must leave a click-pin alone. */
const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

/** Whether a keydown happened in a field that owns the keystroke. Arrow /
 *  Home / End move a text caret there, not the scroller — so even a scroll
 *  key isn't scroll intent while the search box has focus. */
function inEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA"
  );
}

/** Id of the element (from `ids`) whose top edge has most recently passed
 *  the activation line — i.e. the section currently under the header —
 *  falling back to whichever element sits topmost overall when none have
 *  passed it yet (top of the scroller). `null` only when no listed id has a
 *  matching element in the DOM. */
function currentId(ids: string[], activationY: number): string | null {
  let best: string | null = null;
  let bestTop = -Infinity;
  let topmost: string | null = null;
  let topmostTop = Infinity;
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    const top = el.getBoundingClientRect().top;
    if (top < topmostTop) {
      topmostTop = top;
      topmost = id;
    }
    if (top <= activationY && top > bestTop) {
      bestTop = top;
      best = id;
    }
  }
  return best ?? topmost;
}

/** Id of the section currently current among `ids`, or `null` when none of
 *  them exist in the DOM yet.
 *
 *  Returns a `pin` setter too: clicking a link sets the highlight
 *  immediately and authoritatively, instead of waiting for the next scroll
 *  tick to confirm it (the jump itself fires one, but landing exactly on the
 *  activation line is a coin flip on the neighbor either side of it).
 *  Pinning suspends recomputation — not bookkeeping, there isn't any to
 *  suspend — so it can never leave anything stale. It releases on the
 *  user's next own scroll input (wheel / touch / keys), at which point live
 *  geometry takes over again; a click's own jump doesn't count as that
 *  input. Latest intent wins either way. */
export function useScrollSpy(ids: string[]): [string | null, (id: string) => void] {
  const [activeId, setActiveId] = useState<string | null>(null);
  const pinnedRef = useRef<string | null>(null);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    // The panel that actually scrolls (.app-main), not the viewport: with a
    // viewport line the offset is measured against the window while the
    // content moves inside a nested scroller, so the line and the anchor
    // landing point drift apart.
    const scroller = document.querySelector<HTMLElement>(".app-main");
    if (!scroller) return;

    let raf = 0;
    const recompute = () => {
      raf = 0;
      if (pinnedRef.current) return;
      const activationY = scroller.getBoundingClientRect().top + ACTIVATION_OFFSET;
      setActiveId(currentId(idsRef.current, activationY));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(recompute);
    };

    schedule();
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ids]);

  // A pinned id that no longer exists (search narrowed the rail) releases
  // the pin instead of pointing at nothing.
  useEffect(() => {
    if (pinnedRef.current && !ids.includes(pinnedRef.current)) pinnedRef.current = null;
  }, [ids]);

  // The user's own scroll intent hands the highlight back to live geometry.
  // The anchor jump a click causes doesn't fire these; real input does — so
  // a click-pin survives the jump it caused but not the user's next manual
  // scroll.
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(".app-main");
    const unpin = () => {
      pinnedRef.current = null;
      const activationY = scroller ? scroller.getBoundingClientRect().top + ACTIVATION_OFFSET : 0;
      setActiveId(currentId(idsRef.current, activationY));
    };
    // Only a scroll-producing key is the user's own scroll intent. Typing a
    // search query fires a keydown per character; an unfiltered unpin would
    // release a click-pin and jump the highlight on every keystroke.
    const onKeyDown = (event: KeyboardEvent) => {
      if (inEditable(event.target)) return;
      if (!SCROLL_KEYS.has(event.key)) return;
      unpin();
    };
    scroller?.addEventListener("wheel", unpin, { passive: true });
    scroller?.addEventListener("touchmove", unpin, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      scroller?.removeEventListener("wheel", unpin);
      scroller?.removeEventListener("touchmove", unpin);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const pin = (id: string) => {
    pinnedRef.current = id;
    setActiveId(id);
  };

  return [activeId, pin];
}
