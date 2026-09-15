import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { lintTokens, parseTokens } from "../../../src/core/parse.js";
import { coverage, templateCss } from "../../../src/core/schema.js";
import type { DesignSystem, Token } from "../systems/store.ts";
import type { CoverageInfo, LintWarning } from "./useTokensView.ts";
import "./TokenDialog.css";

interface MergePreview {
  added: number;
  cov: CoverageInfo;
  lint: LintWarning[];
}

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
  onToast: (msg: string, tone: "ok" | "err") => void;
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

  const preview = useMemo<MergePreview | null>(() => {
    if (!css.trim()) return null;
    const base = parseTokens(system.css) as Token[];
    const pasted = parseTokens(css) as Token[];
    const names = new Set([...base, ...pasted].map((t) => t.name));
    return {
      added: pasted.length,
      cov: coverage([...names]) as CoverageInfo,
      lint: lintTokens(pasted) as LintWarning[],
    };
  }, [css, system]);

  const reset = () => {
    setCss("");
    setHint(null);
    setError(null);
  };

  const save = () => {
    if (!css.trim() || !preview || !preview.added) {
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
          <div className="tok-dialog-preview" aria-live="polite">
            {!preview ? (
              <p className="tok-dialog-meta">Awaiting CSS block…</p>
            ) : (
              <>
                <b>{preview.added}</b> tokens pasted · coverage{" "}
                <b className={preview.cov.missing ? "" : "ok"}>
                  {preview.cov.present}/{preview.cov.expected}
                </b>{" "}
                {preview.cov.missing ? (
                  <span className="warn">{preview.cov.missing} missing</span>
                ) : (
                  <span className="ok">complete</span>
                )}
                {preview.cov.extraCount > 0 && (
                  <span className="warn"> · {preview.cov.extraCount} extra</span>
                )}
                {preview.lint.length > 0 && (
                  <span className="warn"> · {preview.lint.length} value warnings</span>
                )}
                {preview.cov.extraCount > 0 && (
                  <details>
                    <summary className="warn">extra — won&apos;t render in Preview</summary>
                    <div>
                      Preview only reads the {preview.cov.expected} schema names (see Schema view).
                      Rename these to match, or they&apos;ll just sit unused:
                    </div>
                    {preview.cov.extra.map((n) => (
                      <code key={n}>{n}</code>
                    ))}
                  </details>
                )}
                {preview.lint.length > 0 && (
                  <details open>
                    <summary className="warn">value warnings</summary>
                    {preview.lint.map((w) => (
                      <div key={w.name}>
                        <code>
                          {w.name}: {w.value}
                        </code>{" "}
                        — {w.msg}
                      </div>
                    ))}
                  </details>
                )}
              </>
            )}
          </div>
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
