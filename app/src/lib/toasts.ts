import { useCallback, useState } from "react";

export type ToastTone = "ok" | "warn" | "err";

export interface Toast {
  id: number;
  msg: string;
  tone: ToastTone;
}

export type PushToast = (msg: string, tone?: ToastTone) => void;

let toastId = 0;

/** App-wide toast queue. Owned by App (not a tab) so a toast raised from
   the header or a non-Tokens tab is still on screen — each tab stays
   mounted but hidden, so a tab-local stack would swallow it. */
export function useToasts(): [Toast[], PushToast] {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Stable identity: memo()'d token rows receive callbacks built on this.
  const push = useCallback<PushToast>((msg, tone = "ok") => {
    const id = ++toastId;
    setToasts((cur) => [...cur, { id, msg, tone }]);
    setTimeout(() => setToasts((cur) => cur.filter((t) => t.id !== id)), 2600);
  }, []);
  return [toasts, push];
}
