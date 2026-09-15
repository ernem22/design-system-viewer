import { useCallback, useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import type { Token } from "../systems/store.ts";
import "./InlineEditor.css";

/**
 * Inline single-token editor: a Radix Popover anchored to the token row,
 * opened by the per-row Update/Add button or by double-clicking the row
 * (both legacy entry points, src/viewer/app.js openInlineEditor). Enter or
 * blur saves through `onSave` (the `patchToken` path); Esc cancels. The
 * `done` guard keeps the blur-after-Esc/close sequence to a single commit.
 */
export function TokenEditControl({
  token,
  label = "Update",
  open,
  onOpenChange,
  onSave,
}: {
  token: Token;
  label?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, value: string) => void;
}) {
  const [draft, setDraft] = useState(token.value);
  const done = useRef(false);

  // Fresh draft for every open, pointing at the token the popover opened for.
  useEffect(() => {
    if (open) {
      done.current = false;
      setDraft(token.value);
    }
  }, [open, token.name, token.value]);

  // Select-all on mount only (an inline ref callback would reselect every
  // keystroke) — matches the legacy editor's focus + select behavior.
  // preventScroll keeps the gallery from jumping when the popover opens.
  const focusOnMount = useCallback((el: HTMLInputElement | null) => {
    el?.focus({ preventScroll: true });
    el?.select();
  }, []);

  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    onOpenChange(false);
    if (!save) return;
    const v = draft.trim();
    if (v && v !== token.value) onSave(token.name, v);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) onOpenChange(true);
    else finish(true);
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          className="tok-btn tok-update"
          title={token.value ? "Update token value" : "Add this missing token"}
          onClick={(e) => e.stopPropagation()}
        >
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="tok-pop"
          sideOffset={6}
          align="end"
          onEscapeKeyDown={() => finish(false)}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <label className="tok-pop-label">
            <code>{token.name}</code>
            <input
              ref={focusOnMount}
              className="tok-pop-input"
              value={draft}
              spellCheck={false}
              autoComplete="off"
              aria-label={`Value for ${token.name}`}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => finish(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  finish(true);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  finish(false);
                }
              }}
            />
          </label>
          <p className="tok-pop-hint">Enter/blur saves · Esc cancels</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
