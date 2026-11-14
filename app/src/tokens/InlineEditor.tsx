import { useEffect, useId, useRef, useState } from "react";
import type { Token } from "../systems/store.ts";
import "./InlineEditor.css";

/**
 * The right-rail inspector's edit form — the only token editor in the app.
 *
 * Read-first model: the inspector shows name/value + Copy + Edit; Edit mounts
 * this form. Drafts are trimmed; an empty or unchanged value is a no-op. Enter
 * submits, Esc cancels when a Cancel action exists. `autoFocus` focuses and
 * selects the input on mount (the explicit Edit click), never for the
 * Add-missing form, where the user's row click must not steal focus into the
 * rail.
 *
 * The same form creates a missing schema token: `token.value` is "", so a
 * non-empty draft is always a change, and the submit label names the action.
 */
export function TokenEditForm({
  token,
  autoFocus = false,
  mode = "edit",
  onSave,
  onCancel,
}: {
  token: Token;
  autoFocus?: boolean;
  mode?: "edit" | "add";
  onSave: (name: string, value: string) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(token.value);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();

  // A new selection (or a saved value coming back through the store) resets
  // the draft instead of showing the previous token's text.
  useEffect(() => {
    setDraft(token.value);
  }, [token.name, token.value]);

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus({ preventScroll: true });
    inputRef.current?.select();
  }, [autoFocus]);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== token.value) onSave(token.name, v);
    onCancel?.();
  };

  const cancel = () => {
    setDraft(token.value);
    onCancel?.();
  };

  const canSave = draft.trim() !== "" && draft.trim() !== token.value;

  return (
    <form
      className="tok-edit-form"
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <label className="tok-edit-label" htmlFor={inputId}>
        Token value
        <input
          id={inputId}
          ref={inputRef}
          className="tok-pop-input"
          name="token-value"
          value={draft}
          spellCheck={false}
          autoComplete="off"
          placeholder={mode === "add" ? "e.g. #4f46e5" : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && onCancel) {
              e.preventDefault();
              cancel();
            }
          }}
        />
      </label>
      <div className="tok-edit-actions">
        <button type="submit" className="tok-btn tok-btn-primary" disabled={!canSave}>
          {mode === "add" ? "Add token" : "Save"}
        </button>
        {onCancel && (
          <button type="button" className="tok-btn" onClick={cancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
