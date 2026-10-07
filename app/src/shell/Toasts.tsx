import { useEffect, useRef, useState } from "react";
import type { Toast } from "../lib/toasts.ts";
import "./Toasts.css";

// The exit fade is --app-duration-fast (100ms); the node stays mounted just
// past it so the transition completes before unmount, still inside the 150ms
// exit budget. The leaving toast stays in flow while fading so the stack below
// it never jumps.
const EXIT_MS = 120;

export function Toasts({ toasts }: { toasts: Toast[] }) {
  // Toasts the queue dropped but the exit fade has not finished. A dropped id
  // is moved here DURING render (before commit), so the leaving toast is the
  // SAME DOM node the live toast was (same key, never unmounted): its opacity
  // transitions 1->0 in place. Detecting the removal in an effect instead
  // commits the unmount first and mounts a fresh ghost already at opacity 0 —
  // a single-frame vanish — and the effect's post-paint timing shows the ghost
  // a frame late, jumping the stack below.
  const [prevToasts, setPrevToasts] = useState(toasts);
  const [exiting, setExiting] = useState<Toast[]>([]);
  if (prevToasts !== toasts) {
    setPrevToasts(toasts);
    const live = new Set(toasts.map((t) => t.id));
    const gone = prevToasts.filter(
      (t) => !live.has(t.id) && !exiting.some((e) => e.id === t.id),
    );
    if (gone.length > 0) setExiting((cur) => [...cur, ...gone]);
  }
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    for (const t of exiting) {
      if (!timers.current.has(t.id)) {
        const timer = setTimeout(() => {
          timers.current.delete(t.id);
          setExiting((cur) => cur.filter((e) => e.id !== t.id));
        }, EXIT_MS);
        timers.current.set(t.id, timer);
      }
    }
  }, [exiting]);

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
    },
    [],
  );

  const liveIds = new Set(toasts.map((t) => t.id));
  // One flat list so live and leaving toasts share a single key scope: a
  // toast that moves from live to leaving keeps its fiber (same key, same
  // position in one array) and React updates the same DOM node. Two sibling
  // .map calls would nest two arrays — React keys nested arrays by slot, so
  // the leaving toast would remount as a fresh node already at opacity 0.
  const items = [
    ...toasts.map((t) => ({ ...t, leaving: false })),
    ...exiting
      .filter((t) => !liveIds.has(t.id))
      .map((t) => ({ ...t, leaving: true })),
  ];
  return (
    <div className="app-toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={`app-toast app-toast-${t.tone}`}
          data-leaving={t.leaving || undefined}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
