import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { REFERENCE, templateCss } from "../../../src/core/schema.js";
import type { AppTab } from "../shell/Shell.tsx";
import type { PushToast } from "../lib/toasts.ts";
import { Icon } from "../lib/icons.tsx";
import { CssPreview } from "../tokens/CssPreview.tsx";
import { countTokens } from "../tokens/tokenUtils.ts";
import { fetchCss, readCssFile } from "../lib/cssImport.ts";
import {
  detectImportFormat,
  detectPrefixes,
  readSystemJson,
  stripPrefix,
} from "../lib/systemImport.ts";
import { AFTER_SAVE_TABS, readAfterSave, writeAfterSave } from "./afterSave.ts";
import { SchemaFill } from "./SchemaFill.tsx";
// Dialog primitives (.tok-dialog*) + shared add-dialog language live with
// the toolbar — imported here (not just in TokenToolbar) so the dialog stays
// styled even with zero systems, when no toolbar renders.
import "../tokens/TokenToolbar.css";
import "./AddSystemDialog.css";

const FULL_TEMPLATE_COUNT = (REFERENCE as { tokens: string[] }[]).reduce((n, g) => n + g.tokens.length, 0);

/** What the current text came from. One line in the top bar, because a toast
    is gone before it has been read. */
interface SourceStatus {
  kind: string;
  detail: string;
  bytes: number;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

/**
 * Add System dialog (controlled — the topbar `+`, the empty-state cards and a
 * page-level file drop all open the same instance).
 *
 * The dialog exists to *add a system*, so the work owns the surface: two live
 * panes over the same CSS text — the schema fill (54 groups, one row per name,
 * fill a single token without pasting 432 lines) and the raw text — filling
 * everything between a one-line top bar and a one-line bottom bar.
 *
 * The ways in (upload, URL, JSON export, template, clipboard) are compact
 * triggers in that top bar, each opening only the row it needs. There is no
 * wizard: nothing is behind a step, and nothing is written until Save.
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
  const [status, setStatus] = useState<SourceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [urlOpen, setUrlOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonDraft, setJsonDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [afterSave, setAfterSave] = useState<AppTab>(readAfterSave);
  const [strippedPrefixes, setStrippedPrefixes] = useState<string[]>([]);
  const cssFileRef = useRef<HTMLInputElement>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  // Fresh buffer per open (a dropped file pre-fills it). Re-read the "Open in"
  // preference too, so a legacy key migrated after this dialog mounted is
  // reflected in the menu.
  useEffect(() => {
    if (!open) return;
    setName("");
    setCss(initialCss ?? "");
    setStatus(initialCss ? { kind: "Dropped file", detail: "page drop", bytes: initialCss.length } : null);
    setError(null);
    setUrl("");
    setUrlOpen(false);
    setJsonOpen(false);
    setJsonDraft("");
    setStrippedPrefixes([]);
    setAfterSave(readAfterSave());
  }, [open, initialCss]);

  const prefixes = useMemo(
    () => detectPrefixes(css).filter((p) => !strippedPrefixes.includes(p)),
    [css, strippedPrefixes],
  );
  const tokenCount = countTokens(css);

  /** One entry point for every source: the text, and where it came from. */
  const load = (text: string, from: SourceStatus, importedName?: string) => {
    setCss(text);
    setStatus(from);
    if (importedName) setName((current) => (current.trim() ? current : importedName));
  };

  /** A JSON export is read into its `css` + `name`; anything else is kept as
      the CSS text it claims to be. */
  const applyText = (text: string) => {
    setError(null);
    if (detectImportFormat(text) === "system-json") {
      try {
        const imported = readSystemJson(text);
        load(
          imported.css,
          { kind: "JSON export", detail: imported.name, bytes: imported.css.length },
          imported.name,
        );
        return;
      } catch (e) {
        setCss(text);
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
    }
    setCss(text);
    setStatus({ kind: "Pasted text", detail: detectImportFormat(text) === "css" ? "CSS" : "unrecognised", bytes: text.length });
  };

  const importJson = (text: string) => {
    setError(null);
    try {
      const imported = readSystemJson(text);
      load(
        imported.css,
        { kind: "JSON export", detail: imported.name, bytes: imported.css.length },
        imported.name,
      );
      setJsonOpen(false);
      setJsonDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onCssFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const text = await readCssFile(file);
      load(text, { kind: "Uploaded file", detail: file.name, bytes: file.size });
      onToast(`Loaded ${file.name}`, "ok");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onToast(msg, "err");
    }
  };

  const fetchUrl = async () => {
    const target = url.trim();
    if (!target) {
      setError("Enter a stylesheet URL");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const text = await fetchCss(target);
      load(text, { kind: "Fetched URL", detail: target, bytes: text.length });
      setUrlOpen(false);
      onToast("CSS fetched", "ok");
    } catch (e) {
      const msg = `Fetch failed: ${e instanceof Error ? e.message : String(e)}`;
      setError(msg);
      onToast(msg, "err");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!tokenCount) {
      setError("Nothing to save — the system has no `--token: value;` line yet.");
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

  const copyTemplate = () => {
    const clip = navigator.clipboard;
    if (!clip) {
      onToast("Copy failed", "err");
      return;
    }
    clip.writeText(templateCss()).then(
      () => onToast(`Copied the ${FULL_TEMPLATE_COUNT}-name template`, "ok"),
      () => onToast("Copy failed", "err"),
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tok-dialog-overlay" />
        <Dialog.Content
          className="tok-dialog app-import-dialog"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          }}
        >
          {/* One line of chrome: what this is, the ways in, and where the text
              came from. Everything else on screen is the work. The optional
              source rows live inside this header so the dialog's grid stays
              three rows (head / work / foot) no matter what is open. */}
          <header className="app-import-head">
            <div className="app-import-bar">
            <Dialog.Title className="app-import-title">Add System</Dialog.Title>
            <Dialog.Description className="app-import-sub">
              Nothing is written until you save.
            </Dialog.Description>
            <div className="app-import-tools">
              <button type="button" className="tok-btn" onClick={() => cssFileRef.current?.click()}>
                <Icon name="file" size={14} /> Upload .css
              </button>
              <button
                type="button"
                className="tok-btn"
                aria-expanded={urlOpen}
                onClick={() => {
                  setUrlOpen((v) => !v);
                  setJsonOpen(false);
                  requestAnimationFrame(() => urlRef.current?.focus());
                }}
              >
                <Icon name="link" size={14} /> Fetch URL
              </button>
              <button
                type="button"
                className="tok-btn"
                aria-expanded={jsonOpen}
                onClick={() => {
                  setJsonOpen((v) => !v);
                  setUrlOpen(false);
                }}
              >
                <Icon name="copy" size={14} /> JSON export
              </button>
              <button
                type="button"
                className="tok-btn"
                onClick={() => {
                  setCss(templateCss());
                  setError(null);
                }}
                title={`Insert the ${FULL_TEMPLATE_COUNT} schema names, values empty`}
              >
                Template
              </button>
              <button type="button" className="tok-btn" onClick={copyTemplate} title="Copy the empty schema to the clipboard">
                Copy template
              </button>
              <input
                ref={cssFileRef}
                type="file"
                accept=".css,text/css"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void onCssFile(file);
                }}
              />
            </div>
            {status && (
              <p className="app-import-status" role="status">
                <b>{status.kind}</b> {status.detail} · {formatBytes(status.bytes)} · {tokenCount} tokens
              </p>
            )}
            <Dialog.Close className="app-import-close" aria-label="Close">
              <Icon name="x" size={15} />
            </Dialog.Close>
            </div>

          {urlOpen && (
            <div className="app-import-inline">
              <input
                ref={urlRef}
                className="tok-input"
                type="url"
                value={url}
                placeholder="https://…/tokens.css"
                aria-label="Stylesheet URL"
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void fetchUrl();
                  }
                }}
              />
              <button type="button" className="tok-btn tok-btn-primary" disabled={busy} onClick={() => void fetchUrl()}>
                {busy ? "…" : "Fetch"}
              </button>
            </div>
          )}

          {jsonOpen && (
            <div className="app-import-inline app-import-inline-json">
              <textarea
                className="tok-textarea"
                rows={4}
                value={jsonDraft}
                spellCheck={false}
                aria-label="System JSON"
                placeholder='{"name":"Aurora","css":"--color-bg: #0a0a0f;"}'
                onChange={(e) => setJsonDraft(e.target.value)}
              />
              <button type="button" className="tok-btn" onClick={() => jsonFileRef.current?.click()}>
                Choose a .json file
              </button>
              <button type="button" className="tok-btn tok-btn-primary" onClick={() => importJson(jsonDraft)}>
                Import this JSON
              </button>
              <input
                ref={jsonFileRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) importJson(await file.text());
                }}
              />
            </div>
          )}

          {prefixes.length > 0 && (
            <div className="app-import-chips">
              <span className="app-import-sub">Vendor prefix{prefixes.length > 1 ? "es" : ""}:</span>
              {prefixes.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="tok-btn"
                  title={`Strip --${p}- from every token name`}
                  onClick={() => {
                    setCss((current) => stripPrefix(current, p));
                    setStrippedPrefixes((list) => [...list, p]);
                  }}
                >
                  strip --{p}-
                </button>
              ))}
            </div>
          )}

          </header>

          {/* The work: the same CSS text, seen as the schema and as text. */}
          <div className="app-import-work">
            <section className="app-import-pane" aria-label="Schema fill">
              <div className="app-import-panehead">
                <span className="app-import-panetitle">Fill the schema</span>
                <span className="app-import-sub">{FULL_TEMPLATE_COUNT} names in 54 groups</span>
              </div>
              <div className="app-import-panebody">
                <SchemaFill css={css} onChange={setCss} />
              </div>
            </section>
            <section className="app-import-pane" aria-label="CSS text">
              <div className="app-import-panehead">
                <span className="app-import-panetitle">The CSS text</span>
                <span className="app-import-sub">
                  {tokenCount} tokens · {formatBytes(css.length)}
                </span>
              </div>
              <div className="app-import-panebody">
                <textarea
                  className="tok-textarea app-import-textarea"
                  value={css}
                  spellCheck={false}
                  aria-label="CSS text"
                  placeholder={"--color-bg: #0a0a0f;\n--color-text: #f0f0f3;\n\n…or paste the JSON the Tokens tab exports"}
                  onChange={(e) => applyText(e.target.value)}
                />
                <CssPreview css={css} />
              </div>
            </section>
          </div>

          {/* One line of chrome: identity, the error if any, and the write. */}
          <footer className="app-import-foot">
            <input
              className="tok-input app-import-name"
              value={name}
              autoComplete="off"
              placeholder="System name (Untitled)"
              aria-label="System name"
              onChange={(e) => setName(e.target.value)}
            />
            {error && (
              <p className="app-import-error" role="alert">
                {error}
              </p>
            )}
            <div className="app-import-write">
              <Dialog.Close className="tok-btn">Cancel</Dialog.Close>
              <button type="button" className="tok-btn tok-btn-primary" onClick={save}>
                Save system
              </button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger className="tok-btn app-import-openin" title="Tab to open after saving">
                  {AFTER_SAVE_TABS.find(([id]) => id === afterSave)?.[1] ?? "Preview"}
                  <Icon name="chevronDown" size={12} />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="tok-menu" sideOffset={6} align="end">
                    {AFTER_SAVE_TABS.map(([id, label]) => (
                      <DropdownMenu.Item
                        key={id}
                        className="tok-menu-item"
                        onSelect={() => {
                          setAfterSave(id);
                          writeAfterSave(id);
                        }}
                      >
                        Open in {label}
                        {id === afterSave && <Icon name="check" size={13} />}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
