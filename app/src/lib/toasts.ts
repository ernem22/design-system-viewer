import { useCallback, useEffect, useRef, useState } from "react";

export type ToastTone = "ok" | "warn" | "err";

export interface Toast {
  id: number;
  msg: string;
  tone: ToastTone;
}

export type PushToast = (msg: string, tone?: ToastTone) => void;

/** Timer controls exposed to the toast view. Errors persist until dismissed,
   and ok/warn timers pause while the stack is hovered or focused. */
export interface ToastQueue {
  pause: (id: number) => void;
  resume: (id: number) => void;
  dismiss: (id: number) => void;
}

const AUTO_DISMISS_MS = 2600;

let toastId = 0;

/** App-wide toast queue. Owned by App (not a tab) so a toast raised from
   the header or a non-Tokens tab is still on screen — each tab stays
   mounted but hidden, so a tab-local stack would swallow it. */
export function useToasts(): [Toast[], PushToast, ToastQueue] {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const paused = useRef(new Set<number>());

  const clearTimer = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const remove = useCallback(
    (id: number) => {
      clearTimer(id);
      paused.current.delete(id);
      setToasts((cur) => cur.filter((t) => t.id !== id));
    },
    [clearTimer],
  );

  const schedule = useCallback(
    (id: number) => {
      if (paused.current.has(id)) return;
      clearTimer(id);
      const timer = setTimeout(() => remove(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
    },
    [clearTimer, remove],
  );

  // Stable identity: memo()'d token rows receive callbacks built on this.
  const push = useCallback<PushToast>(
    (msg, tone = "ok") => {
      const id = ++toastId;
      setToasts((cur) => [...cur, { id, msg, tone }]);
      // Errors stay until the user dismisses them; short-lived tones time out.
      if (tone !== "err") schedule(id);
    },
    [schedule],
  );

  const pause = useCallback(
    (id: number) => {
      paused.current.add(id);
      clearTimer(id);
    },
    [clearTimer],
  );

  const resume = useCallback(
    (id: number) => {
      if (!paused.current.delete(id)) return;
      schedule(id);
    },
    [schedule],
  );

  const dismiss = useCallback((id: number) => remove(id), [remove]);

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
    },
    [],
  );

  return [toasts, push, { pause, resume, dismiss }];
}
