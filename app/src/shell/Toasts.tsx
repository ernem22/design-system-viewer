import type { Toast } from "../lib/toasts.ts";
import "./Toasts.css";

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="app-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`app-toast app-toast-${t.tone}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
