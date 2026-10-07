import { useEffect, useRef, useState } from "react";
import type { Toast } from "../lib/toasts.ts";
import "./Toasts.css";

// The exit fade is --duration-fast (100ms); the node stays mounted just past
// it so the transition completes before unmount, still inside the 150ms exit
// budget. The leaving toast stays in flow while fading so the stack below it
// never jumps.
const EXIT_MS = 120;

export function Toasts({ toasts }: { toasts: Toast[] }) {
  const [exiting, setExiting] = useState<Toast[]>([]);
  const prevById = useRef(new Map<number, Toast>());
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const current = new Map(toasts.map((t) => [t.id, t] as const));
    for (const [id, toast] of prevById.current) {
      if (!current.has(id) && !timers.current.has(id)) {
        setExiting((cur) =>
          cur.some((t) => t.id === id) ? cur : [...cur, toast],
        );
        const timer = setTimeout(() => {
          timers.current.delete(id);
          setExiting((cur) => cur.filter((t) => t.id !== id));
        }, EXIT_MS);
        timers.current.set(id, timer);
      }
    }
    prevById.current = current;
  }, [toasts]);

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
    },
    [],
  );

  return (
    <div className="app-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`app-toast app-toast-${t.tone}`}>
          {t.msg}
        </div>
      ))}
      {exiting
        .filter((t) => !toasts.some((live) => live.id === t.id))
        .map((t) => (
          <div
            key={t.id}
            className={`app-toast app-toast-${t.tone}`}
            data-leaving="true"
          >
            {t.msg}
          </div>
        ))}
    </div>
  );
}
