import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { REFERENCE, templateCss } from "../../../src/core/schema.js";
import type { AppTab } from "../shell/Shell.tsx";
import type { PushToast } from "../lib/toasts.ts";
import { Icon, type IconName } from "../lib/icons.tsx";
import { CssPreview } from "../tokens/CssPreview.tsx";
import { countTokens } from "../tokens/tokenUtils.ts";
import { fetchCss, readCssFile } from "../lib/cssImport.ts";
import {
  detectImportFormat,
  detectPrefixes,
  readSystemJson,
  stripPrefix,
} from "../lib/systemImport.ts";
import { tokenValueMap } from "../lib/tokenCss.ts";
import { AFTER_SAVE_TABS, readAfterSave, writeAfterSave } from "./afterSave.ts";
import { SchemaFill } from "./SchemaFill.tsx";
// Dialog primitives (.tok-dialog*) + shared add-dialog language live with
// the toolbar — imported here (not just in TokenToolbar) so the dialog stays
// styled even with zero systems, when no toolbar renders.
import "../tokens/TokenToolbar.css";
import "./AddSystemDialog.css";

const FULL_TEMPLATE_COUNT = (REFERENCE as { tokens: string[] }[]).reduce((n, g) => n + g.tokens.length, 0);
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Steps, in order. The current one is exposed as `data-step` for tests. */
const STEPS = ["Source", "Review", "Save"] as const;

/** The import sources, as a picker rather than one flat row: each one is a
    way *in*, and the chosen one decides which panel step 1 shows. */
const SOURCES: { id: Source; label: string; hint: string; icon: IconName }[] = [
  { id: "paste", label: "Paste CSS", hint: "a block of --token: value; lines", icon: "edit" },
  { id: "upload", label: "Upload .css", hint: "a file, or drop one on the page", icon: "file" },
  { id: "url", label: "Fetch URL", hint: "a hosted stylesheet", icon: "link" },
  { id: "json", label: "JSON export", hint: "a system from the Tokens tab", icon: "copy" },
];

type Step = 1 | 2 | 3;
type View = "form" | "paste";
type Source = "paste" | "upload" | "url" | "json";

/** What the current text came from — shown as a durable line under the
    picker, because a toast is gone before the user has read it. */
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
 * Add System dialog (controlled — the header button, the empty-state cards
 * and a page-level file drop all open the same instance).
 *
 * It is an *import* flow, not a paste box (#116 / #124): Source → Review →
 * Save. Every source (paste, `.css` file, URL, our own JSON export, the
 * clipboard) lands in the same CSS text; the review step shows that text
 * against the schema, grouped by its own 54 headings with one row per name, so
 * a single token can be filled without pasting 432 lines; and only the Save
 * step writes. Back never loses the text, Cancel at any step writes nothing.
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
  const [step, setStep] = useState<Step>(1);
  const [view, setView] = useState<View>("form");
  const [source, setSource] = useState<Source>("paste");
  const [showText, setShowText] = useState(true);
  const [status, setStatus] = useState<SourceStatus | null>(null);
  const [name, setName] = useState("");
  const [css, setCss] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [jsonDraft, setJsonDraft] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [afterSave, setAfterSave] = useState<AppTab>(readAfterSave);
  const [strippedPrefixes, setStrippedPrefixes] = useState<string[]>([]);
  const cssFileRef = useRef<HTMLInputElement>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);

  // Fresh form per open (a drop pre-fills it). Re-read the "Open in"
  // preference too, so a legacy key migrated after this dialog mounted is
  // reflected in the visible choice.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setView("form");
    setSource(initialCss ? "upload" : "paste");
    setShowText(true);
    setStatus(initialCss ? { kind: "Dropped file", detail: "page drop", bytes: initialCss.length } : null);
    setName("");
    setCss(initialCss ?? "");
    setUrl("");
    setJsonDraft("");
    setHint(null);
    setError(null);
    setStrippedPrefixes([]);
    setAfterSave(readAfterSave());
  }, [open, initialCss]);

  const prefixes = useMemo(
    () => detectPrefixes(css).filter((p) => !strippedPrefixes.includes(p)),
    [css, strippedPrefixes],
  );
  const colourStrip = useMemo(
    () =>
      [...tokenValueMap(css).entries()]
        .filter(([token, value]) => token.startsWith("--color-") && HEX.test(value.trim()))
        .slice(0, 24),
    [css],
  );

  /** One entry point for every source: the text, where it came from, and the
      text block opened so the user can see what actually arrived. */
  const load = (text: string, from: SourceStatus, importedName?: string) => {
    setCss(text);
    setStatus(from);
    setShowText(true);
    if (importedName) setName((current) => (current.trim() ? current : importedName));
  };

  /** Every source funnels through here: a JSON export is read into its `css`
      and `name`, anything else is kept as the CSS text it claims to be. */
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
        setHint(`Read a JSON export — "${imported.name}" (${countTokens(imported.css)} tokens)`);
        return;
      } catch (e) {
        setCss(text);
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
    }
    const format = detectImportFormat(text);
    setCss(text);
    setStatus({ kind: "Pasted text", detail: format === "css" ? "CSS" : "unrecognised", bytes: text.length });
    setHint(format === "css" ? null : "No `--token: value;` line in that text yet");
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
      setHint(`Read a JSON export — "${imported.name}" (${countTokens(imported.css)} tokens)`);
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
      onToast("CSS fetched", "ok");
    } catch (e) {
      const msg = `Fetch failed: ${e instanceof Error ? e.message : String(e)}`;
      setError(msg);
      onToast(msg, "err");
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (step === 1) {
      if (!countTokens(css)) {
        setError("CSS block is empty — paste at least one `--token: value;` line.");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) setStep(3);
  };

  const back = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  const save = () => {
    if (step !== 3) return;
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

  const copyTemplate = () => {
    const clip = navigator.clipboard;
    if (!clip) {
      onToast("Copy failed", "err");
      return;
    }
    clip.writeText(templateCss()).then(
      () => setHint(`Copied the ${FULL_TEMPLATE_COUNT}-name template to the clipboard ✓`),
      () => onToast("Copy failed", "err"),
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tok-dialog-overlay" />
        <Dialog.Content
          className="tok-dialog tok-dialog-wide"
          data-step={step}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              if (step === 3) save();
              else next();
            }
          }}
        >
          <Dialog.Title className="tok-dialog-title">Add System</Dialog.Title>
          <ol className="app-import-steps" aria-label="Import steps">
            {STEPS.map((label, i) => {
              const n = (i + 1) as Step;
              return (
                <li
                  key={label}
                  className={`app-import-step${n === step ? " is-current" : ""}${n < step ? " is-done" : ""}`}
                  aria-current={n === step ? "step" : undefined}
                >
                  <button
                    type="button"
                    className="app-import-stepbtn"
                    disabled={n > step}
                    onClick={() => setStep(n)}
                  >
                    {n}. {label}
                  </button>
                </li>
              );
            })}
          </ol>
          <Dialog.Description className="tok-dialog-desc">
            {step === 1 && (
              <>
                Paste <code>--token: value;</code> lines, drop a stylesheet, fetch one by URL, or paste a
                system exported from the Tokens tab. Nothing is written until you save.
              </>
            )}
            {step === 2 && (
              <>
                Check what will be written. The schema is grouped by its own headings — fill a single token,
                or switch to the paste view and edit the whole block.
              </>
            )}
            {step === 3 && (
              <>
                Name it and choose where to land. It stays in this browser and becomes selectable in the
                switcher.
              </>
            )}
          </Dialog.Description>

          {step === 1 && (
            <>
              <div className="app-import-sources" role="tablist" aria-label="Import source">
                {SOURCES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={source === s.id}
                    className={`app-import-source${source === s.id ? " is-active" : ""}`}
                    onClick={() => setSource(s.id)}
                  >
                    <span className="app-import-source-icon">
                      <Icon name={s.icon} size={16} />
                    </span>
                    <span className="app-import-source-text">
                      <span className="app-import-source-label">{s.label}</span>
                      <span className="app-import-source-hint">{s.hint}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="app-import-panel">
                {source === "paste" && (
                  <p className="tok-dialog-meta">
                    Type or paste <code>--token: value;</code> lines below — that text is the system.
                  </p>
                )}
                {source === "upload" && (
                  <div className="tok-dialog-row">
                    <button type="button" className="tok-btn" onClick={() => cssFileRef.current?.click()}>
                      Choose a .css file
                    </button>
                    <span className="tok-dialog-meta">or drop a .css anywhere on the page</span>
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
                )}
                {source === "url" && (
                  <div className="tok-dialog-row">
                    <input
                      className="tok-input tok-source-url"
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
                    <button type="button" className="tok-btn" disabled={busy} onClick={() => void fetchUrl()}>
                      {busy ? "…" : "Fetch"}
                    </button>
                  </div>
                )}
                {source === "json" && (
                  <>
                    <div className="tok-dialog-row">
                      <button type="button" className="tok-btn" onClick={() => jsonFileRef.current?.click()}>
                        Choose a .json file
                      </button>
                      <span className="tok-dialog-meta">export one from the Tokens tab</span>
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
                    <textarea
                      className="tok-textarea"
                      rows={5}
                      value={jsonDraft}
                      spellCheck={false}
                      aria-label="System JSON"
                      placeholder='{"name":"Aurora","css":"--color-bg: #0a0a0f;"}'
                      onChange={(e) => setJsonDraft(e.target.value)}
                    />
                    <div className="tok-dialog-row">
                      <button type="button" className="tok-btn" onClick={() => importJson(jsonDraft)}>
                        Import this JSON
                      </button>
                    </div>
                  </>
                )}
              </div>

              <p className="app-import-status" role="status">
                {status ? (
                  <>
                    <b>{status.kind}</b> · {status.detail} · {formatBytes(status.bytes)} ·{" "}
                    {countTokens(css)} tokens
                  </>
                ) : (
                  "Nothing loaded yet — pick a source above."
                )}
              </p>

              <div className="app-import-text">
                <button
                  type="button"
                  className="app-import-texthead"
                  aria-expanded={showText}
                  onClick={() => setShowText((v) => !v)}
                >
                  <Icon name={showText ? "chevronDown" : "chevronRight"} size={13} />
                  The CSS text
                </button>
                {showText && (
                  <textarea
                    className="tok-textarea"
                    value={css}
                    rows={10}
                    spellCheck={false}
                    aria-label="CSS or a JSON export"
                    placeholder={"--color-accent: #6366f1;\n\n…or paste the JSON the Tokens tab exports"}
                    onChange={(e) => applyText(e.target.value)}
                  />
                )}
              </div>

              <div className="tok-dialog-row">
                <button
                  type="button"
                  className="tok-btn"
                  onClick={() => {
                    setCss(templateCss());
                    setHint("Template inserted — empty lines are ignored; fill the values you have.");
                    setError(null);
                  }}
                >
                  Fill full template ({FULL_TEMPLATE_COUNT})
                </button>
                <button type="button" className="tok-btn" onClick={copyTemplate}>
                  Copy template
                </button>
              </div>
              {prefixes.length > 0 && (
                <div className="tok-dialog-row app-import-prefixes">
                  <span className="tok-dialog-meta">Vendor prefix{prefixes.length > 1 ? "es" : ""}:</span>
                  {prefixes.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="tok-btn"
                      title={`Strip --${p}- from every token name`}
                      onClick={() => {
                        setCss((current) => stripPrefix(current, p));
                        setStrippedPrefixes((list) => [...list, p]);
                        setHint(`Stripped --${p}- from the token names`);
                      }}
                    >
                      strip --{p}-
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="tok-dialog-row">
                <ToggleGroup.Root
                  type="single"
                  className="tok-seg"
                  value={view}
                  aria-label="Review view"
                  onValueChange={(v) => {
                    if (v) setView(v as View);
                  }}
                >
                  <ToggleGroup.Item value="form" className="tok-seg-item">
                    Fill form
                  </ToggleGroup.Item>
                  <ToggleGroup.Item value="paste" className="tok-seg-item">
                    Paste
                  </ToggleGroup.Item>
                </ToggleGroup.Root>
                {colourStrip.length > 0 && (
                  <span className="app-import-swatches" aria-label="Colour tokens in this import">
                    {colourStrip.map(([token, value]) => (
                      <span
                        key={token}
                        className="app-import-swatch"
                        style={{ background: value.trim() }}
                        title={`${token}: ${value.trim()}`}
                      />
                    ))}
                  </span>
                )}
              </div>
              {view === "form" ? (
                <SchemaFill css={css} onChange={setCss} />
              ) : (
                <>
                  <textarea
                    className="tok-textarea"
                    value={css}
                    rows={12}
                    spellCheck={false}
                    aria-label="Imported CSS"
                    onChange={(e) => {
                      setCss(e.target.value);
                      setError(null);
                    }}
                  />
                  <CssPreview css={css} />
                </>
              )}
            </>
          )}

          {step === 3 && (
            <>
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
              <CssPreview css={css} />
            </>
          )}

          {hint && <p className="tok-dialog-meta app-import-hint">{hint}</p>}
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
            {step > 1 && (
              <button type="button" className="tok-btn" onClick={back}>
                Back
              </button>
            )}
            <Dialog.Close className="tok-btn">Cancel</Dialog.Close>
            {step < 3 ? (
              <button type="button" className="tok-btn tok-btn-primary" onClick={next}>
                Continue
              </button>
            ) : (
              <button type="button" className="tok-btn tok-btn-primary" onClick={save}>
                Save system
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
