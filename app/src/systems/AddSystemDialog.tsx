import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { REFERENCE, templateCss } from "../../../src/core/schema.js";
import type { AppTab } from "../shell/Shell.ts";
import type { PushToast } from "../lib/toasts.ts";
import { CssPreview } from "../tokens/CssPreview.tsx";
import { countTokens } from "../tokens/tokenUtils.ts";
import { CssSourceBar } from "../tokens/CssSourceBar.tsx";
import { AFTER_SAVE_TABS, readAfterSave, writeAfterSave } from "./afterSave.ts";
// Dialog primitives (.tok-dialog*) + shared add-dialog language live with
// the toolbar — imported here (not just in TokenToolbar) so the dialog stays
// styled even with zero systems, when no toolbar renders.
import "../tokens/TokenToolbar.css";
import "./AddSystemDialog.css";

const FULL_TEMPLATE_COUNT = (REFERENCE as { tokens: string[] }[]).reduce((n, g) => n + g.tokens.length, 0);

/**
 * Add System dialog (controlled — the header button, the empty-state cards
 * and a page-level file drop all open the same instance). Name + CSS with
 * file/URL sources, a full-schema template, live coverage preview, and the
 * legacy "Open in" choice of where to land after saving.
 */
export function AddSystemDialog({
  open,
  initialCss,
  onOpenChange,
  onAdd,
  onToast,
  onSaved,
}: {
  open: boolean;
  /** Pre-filled CSS (a dropped file); read each time the dialog opens. */
  initialCss?: string;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string, css: string) => void;
  onToast: PushToast;
  onSaved: (tab: AppTab) => void;
}) {
  const [name, setName] = useState("");
  const [css, setCss] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [afterSave, setAfterSave] = useState<AppTab>(readAfterSave);

  // Fresh form per open (a drop pre-fills it). Re-read the "Open in"
  // preference too, so a legacy key migrated after this dialog mounted is
  // reflected in the visible choice.
  useEffect(() => {
    if (!open) return;
    setName("");
    setCss(initialCss ?? "");
    setError(null);
    setAfterSave(readAfterSave());
  }, [open, initialCss]);

  const save = () => {
    if (!countTokens(css)) {
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
    onOpenChange(false);
    onSaved(afterSave);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tok-dialog-overlay" />
        <Dialog.Content
          className="tok-dialog tok-dialog-wide"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          }}
        >
          <Dialog.Title className="tok-dialog-title">Add System</Dialog.Title>
          <Dialog.Description className="tok-dialog-desc">
            Paste a block of <code>--token: value;</code> lines. It stays in this browser and becomes
            selectable in the switcher.
          </Dialog.Description>
          <label className="tok-field">
            <span>Name</span>
            <input
              className="tok-input"
              value={name}
              autoComplete="off"
              placeholder="Untitled"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <CssSourceBar
            onToast={onToast}
            onLoad={(text) => {
              setCss(text);
              setError(null);
            }}
          />
          <div className="tok-dialog-row">
            <button
              type="button"
              className="tok-btn"
              onClick={() => {
                setCss(templateCss());
                setError(null);
              }}
            >
              Fill full template ({FULL_TEMPLATE_COUNT})
            </button>
          </div>
          <label className="tok-field">
            <span>CSS</span>
            <textarea
              className="tok-textarea"
              value={css}
              rows={10}
              spellCheck={false}
              placeholder="--color-accent: #6366f1;"
              onChange={(e) => {
                setCss(e.target.value);
                setError(null);
              }}
            />
          </label>
          <CssPreview css={css} />
          {error && (
            <p className="tok-dialog-error" role="alert">
              {error}
            </p>
          )}
          <div className="tok-dialog-actions">
            <span className="tok-segment">
              Open in
              <ToggleGroup.Root
                type="single"
                className="tok-seg"
                value={afterSave}
                aria-label="Tab to open after saving"
                onValueChange={(v) => {
                  if (!v) return;
                  setAfterSave(v as AppTab);
                  writeAfterSave(v as AppTab);
                }}
              >
                {AFTER_SAVE_TABS.map(([id, label]) => (
                  <ToggleGroup.Item key={id} value={id} className="tok-seg-item">
                    {label}
                  </ToggleGroup.Item>
                ))}
              </ToggleGroup.Root>
            </span>
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
