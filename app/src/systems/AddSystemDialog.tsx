import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { parseTokens } from "../../../src/core/parse.js";
import type { Token } from "./store.ts";
// Dialog primitives (.tok-dialog*) + shared add-dialog language live with
// the toolbar — imported here (not just in TokenToolbar) so the trigger and
// dialog stay styled even with zero systems, when no toolbar renders.
import "../tokens/TokenToolbar.css";
import "./AddSystemDialog.css";

/**
 * Add System dialog: name + CSS textarea calling `addSystem`. Surfaces the
 * "already exists" error from `addSystem` inline (and as a toast) instead of
 * throwing into the header. Live token count reuses `parseTokens` so an
 * empty paste can't be saved by accident.
 */
export function AddSystemDialog({
  onAdd,
  onToast,
}: {
  onAdd: (name: string, css: string) => void;
  onToast: (msg: string, tone: "ok" | "err") => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [css, setCss] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parsed = parseTokens(css) as Token[];

  const reset = () => {
    setName("");
    setCss("");
    setError(null);
  };

  const save = () => {
    if (!parsed.length) {
      setError("CSS block is empty — paste at least one `--token: value;` line.");
      return;
    }
    try {
      onAdd(name.trim() || "Untitled", css);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onToast(msg, "err");
      return;
    }
    onToast("System added", "ok");
    reset();
    setOpen(false);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Dialog.Trigger asChild>
        <button className="tok-btn" title="Add a new design system">
          + Add system
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="tok-dialog-overlay" />
        <Dialog.Content
          className="tok-dialog tok-dialog-wide"
          aria-describedby={undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          }}
        >
          <Dialog.Title className="tok-dialog-title">Add System</Dialog.Title>
          <Dialog.Description className="tok-dialog-desc">
            Paste a block of <code>--token: value;</code> lines. It persists in this browser and becomes
            selectable in the switcher.
          </Dialog.Description>
          <label className="tok-field">
            <span>Name</span>
            <input
              className="tok-input"
              value={name}
              autoComplete="off"
              placeholder="Untitled"
              aria-label="System name"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="tok-field">
            <span>CSS</span>
            <textarea
              className="tok-textarea"
              value={css}
              rows={10}
              spellCheck={false}
              placeholder="--color-accent: #6366f1;"
              aria-label="System CSS"
              onChange={(e) => setCss(e.target.value)}
            />
          </label>
          <p className="tok-dialog-meta" aria-live="polite">
            {css.trim()
              ? `${parsed.length} token${parsed.length === 1 ? "" : "s"} pasted`
              : "Awaiting CSS block…"}
          </p>
          {error && (
            <p className="tok-dialog-error" role="alert">
              {error}
            </p>
          )}
          <div className="tok-dialog-actions">
            <Dialog.Close className="tok-btn">Cancel</Dialog.Close>
            <button className="tok-btn tok-btn-primary" onClick={save}>
              Save system
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
