import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { parseTokens } from "../../../src/core/parse.js";
import { coverage, templateCss } from "../../../src/core/schema.js";
import type { DesignSystem, Token } from "../systems/store.ts";
import type { CoverageInfo } from "./useTokensView.ts";
import { CssPreview } from "./CssPreview.tsx";
import { countTokens } from "./tokenUtils.ts";
import { CssSourceBar } from "./CssSourceBar.tsx";
import type { PushToast } from "../lib/toasts.ts";
import "./TokenDialog.css";

/**
 * Add Tokens dialog: paste/merge a CSS block into the active system via
 * `mergeCss`. Live coverage preview reuses `coverage` over the combined
 * (stored + pasted) name set, the template action reuses `templateCss` with
 * the currently-missing names, and value warnings reuse `lintTokens` — the
 * same three helpers the legacy merge dialog (src/viewer/app.js openDialog
 * "merge") was built on, behind a Radix Dialog instead of a <dialog>.
 */
export function TokenDialog({
  system,
  onMerge,
  onToast,
}: {
  system: DesignSystem;
  onMerge: (css: string) => void;
  onToast: PushToast;
}) {
  const [open, setOpen] = useState(false);
  const [css, setCss] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Missing names of the stored system — what "Fill missing template" scaffolds.
  const missingNames = useMemo(() => {
    const base = parseTokens(system.css) as Token[];
    const cov = coverage(base.map((t) => t.name)) as CoverageInfo;
    return cov.groups.flatMap((g) => g.missing);
  }, [system]);

  const reset = () => {
    setCss("");
    setHint(null);
    setError(null);
  };

  const save = () => {
    if (!countTokens(css)) {
      setError("CSS block is empty — paste at least one `--token: value;` line.");
      return;
    }
    try {
      onMerge(css);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onToast(msg, "err");
      return;
    }
    onToast("Tokens added", "ok");
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
        <button className="tok-btn" title="Add tokens to this system">
          Add tokens
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
          <Dialog.Title className="tok-dialog-title">Add Tokens — {system.name}</Dialog.Title>
          <Dialog.Description className="tok-dialog-desc">
            Merged into the current system (last write wins). Nothing is overwritten until you save.
          </Dialog.Description>
          <div className="tok-dialog-row">
            <button
              className="tok-btn"
              onClick={() => {
                setCss(templateCss(missingNames));
                setHint("template inserted — fill values, empty lines are ignored");
                setError(null);
              }}
            >
              Fill missing template ({missingNames.length})
            </button>
            <button
              className="tok-btn"
              onClick={() => {
                const clip = navigator.clipboard;
                if (!clip) {
                  onToast("Copy failed", "err");
                  return;
                }
                clip.writeText(templateCss(missingNames)).then(
                  () => setHint("copied to clipboard ✓"),
                  () => onToast("Copy failed", "err"),
                );
              }}
            >
              Copy template
            </button>
          </div>
          <CssSourceBar
            onToast={onToast}
            onLoad={(text) => {
              setCss(text);
              setError(null);
            }}
          />
          {hint && <p className="tok-dialog-meta">{hint}</p>}
          <textarea
            className="tok-textarea"
            value={css}
            rows={10}
            spellCheck={false}
            placeholder="--color-accent-hover: #818cf8;"
            aria-label="Additional CSS tokens"
            onChange={(e) => {
              setCss(e.target.value);
              setError(null);
            }}
          />
          <CssPreview css={css} baseCss={system.css} />
          {error && (
            <p className="tok-dialog-error" role="alert">
              {error}
            </p>
          )}
          <div className="tok-dialog-actions">
            <Dialog.Close className="tok-btn">Cancel</Dialog.Close>
            <button className="tok-btn tok-btn-primary" onClick={save}>
              Merge tokens
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
