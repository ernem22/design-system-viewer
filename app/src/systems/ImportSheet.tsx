import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { coverage } from "../../../src/core/schema.js";
import { slugify } from "../../../src/core/parse.js";
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
import { tokenValueMap } from "../lib/tokenCss.ts";
import type { CoverageInfo } from "../tokens/useTokensView.ts";
import {
  nextFreeSlug,
  type DesignSystem,
  type SourceDescriptor,
  type SourceProvenance,
} from "./store.ts";
import { readAfterSave } from "./afterSave.ts";
import { SchemaFill } from "./SchemaFill.tsx";
import "../tokens/TokenToolbar.css";
import "./ImportSheet.css";

/** What the current text came from. Shown beside the source line so the
    buffer never becomes anonymous after an upload or fetch. */
interface SourceStatus {
  kind: string;
  detail: string;
  bytes: number;
}

/** New-system writes: a brand-new system, a merge into a chosen one, or a new
    system seeded from a chosen one. Add-to-active is not a mode — the sheet is
    already scoped and writes through `onMerge`. */
type WriteMode = "new" | "merge" | "clone";

const WRITE_MODES: [WriteMode, string][] = [
  ["new", "New system"],
  ["merge", "Merge into"],
  ["clone", "Clone from"],
];

/** A pending slug collision: the name the user typed, the system that already
    holds the slug, and the text/name to write once a choice is made. */
interface Collision {
  slug: string;
  existingName: string;
  name: string;
  css: string;
}

type SourceRow = "url" | "json" | null;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

/** Resolve with `task` unless `signal` aborts first — then reject with an
    AbortError. `readCssFile`/`fetchCss` take no signal, so this is what stops
    the sheet's continuation the moment an import is superseded or the sheet
    closes, instead of letting a stale result sit and then land. */
function untilAborted<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    task.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

/**
 * One import surface for both entry points.
 *
 * `scopeSystem` is the whole difference between the two: absent means "Add a
 * system" (name + new/merge/clone target), present means "Add tokens" scoped
 * to that system (no identity, primary writes through `onMerge`). Everything
 * else is shared: one paste-first buffer, one source line, one summary, one
 * secondary schema disclosure, and one primary action. Nothing is written until
 * that primary action.
 */
export function ImportSheet({
  open,
  initialCss,
  scopeSystem,
  onOpenChange,
  onAdd,
  onMerge,
  onReplace,
  systems,
  onToast,
  onSaved,
}: {
  open: boolean;
  /** Pre-filled CSS (a dropped file); read each time the sheet opens. */
  initialCss?: string;
  /** When set, the sheet adds tokens to this system instead of creating one. */
  scopeSystem?: DesignSystem | null;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string, css: string, source?: SourceProvenance) => void;
  onMerge?: (slug: string, css: string, source?: SourceProvenance) => void;
  onReplace?: (slug: string, name: string, css: string, source?: SourceProvenance) => void;
  /** The systems a merge/clone target and a slug collision come from. */
  systems?: DesignSystem[];
  onToast: PushToast;
  onSaved: (tab: AppTab) => void;
}) {
  const scopeSlug = scopeSystem?.slug ?? null;
  const [name, setName] = useState("");
  const [css, setCss] = useState("");
  const [status, setStatus] = useState<SourceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [sourceRow, setSourceRow] = useState<SourceRow>(null);
  const [jsonDraft, setJsonDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [strippedPrefixes, setStrippedPrefixes] = useState<string[]>([]);
  const [mode, setMode] = useState<WriteMode>("new");
  const [target, setTarget] = useState("");
  const [collision, setCollision] = useState<Collision | null>(null);
  /** Replace is irreversible, so it takes a second explicit confirmation. */
  const [confirmReplace, setConfirmReplace] = useState(false);
  /** A close that would discard a non-empty buffer asks first. */
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [source, setSource] = useState<SourceDescriptor | null>(null);
  const cssFileRef = useRef<HTMLInputElement>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // One in-flight import at a time. Starting a new one aborts the old and takes
  // over the ref; only the request still referenced here may write the buffer.
  const importReqRef = useRef<{ controller: AbortController } | null>(null);
  const beginImport = () => {
    importReqRef.current?.controller.abort();
    const request = { controller: new AbortController() };
    importReqRef.current = request;
    return request;
  };
  const isCurrentImport = (request: { controller: AbortController }) =>
    importReqRef.current === request && !request.controller.signal.aborted;
  const endImport = (request: { controller: AbortController }) => {
    if (importReqRef.current === request) importReqRef.current = null;
  };
  // A manual edit replaces the buffer with something newer than any import in
  // flight, so it supersedes that import exactly as a new import would.
  const cancelImport = () => {
    importReqRef.current?.controller.abort();
    importReqRef.current = null;
  };

  // Fresh buffer per open (a dropped file pre-fills it).
  useEffect(() => {
    if (!open) return;
    if (initialCss && detectImportFormat(initialCss) === "system-json") {
      try {
        const imported = readSystemJson(initialCss);
        setName(imported.name);
        setCss(imported.css);
        setStatus({ kind: "JSON export", detail: imported.name, bytes: imported.css.length });
        setSource({ kind: "json" });
      } catch {
        setName("");
        setCss(initialCss);
        setStatus({ kind: "Dropped file", detail: "page drop", bytes: initialCss.length });
        setSource({ kind: "drop" });
      }
    } else {
      setName("");
      setCss(initialCss ?? "");
      setStatus(
        initialCss ? { kind: "Dropped file", detail: "page drop", bytes: initialCss.length } : null,
      );
      setSource(initialCss ? { kind: "drop" } : null);
    }
    setError(null);
    setUrl("");
    setSourceRow(null);
    setJsonDraft("");
    setStrippedPrefixes([]);
    setBusy(false);
    setMode("new");
    setTarget("");
    setCollision(null);
    setConfirmReplace(false);
    setConfirmDiscard(false);
    // A close (or a re-seed) supersedes anything still in flight.
    return () => {
      importReqRef.current?.controller.abort();
      importReqRef.current = null;
    };
  }, [open, initialCss, scopeSlug]);

  const prefixes = useMemo(
    () => detectPrefixes(css).filter((p) => !strippedPrefixes.includes(p)),
    [css, strippedPrefixes],
  );
  const tokenCount = countTokens(css);
  /** Coverage is always recomputed from the CSS text, never stored. */
  const reviewValues = useMemo(() => tokenValueMap(css), [css]);
  const reviewCoverage = useMemo(
    () => coverage([...reviewValues.keys()]) as CoverageInfo,
    [reviewValues],
  );

  const targetSystem = systems?.find((s) => s.slug === target) ?? null;
  const writeTarget = scopeSystem ?? (mode === "merge" || mode === "clone" ? targetSystem : null);
  const baseCss = writeTarget?.css ?? "";
  const renameSlug = collision
    ? nextFreeSlug(collision.slug, (systems ?? []).map((s) => s.slug))
    : "";
  const finalName = name.trim() || "Untitled";
  /** No buffer yet: the sheet shows a calm first-token hint instead of a
      live summary full of zeros. */
  const isEmpty = css.trim().length === 0;
  /** One sentence for the review disclosure: what the diff is measured against. */
  const compareLine = scopeSystem
    ? `compares to ${scopeSystem.name}`
    : mode === "merge"
      ? targetSystem
        ? `compares to ${targetSystem.name}`
        : "choose a system to compare"
      : mode === "clone"
        ? targetSystem
          ? `compares to ${targetSystem.name} → ${finalName}`
          : "choose a system to clone"
        : "compares to an empty system";

  /** What the primary action will do to the target's current tokens. */
  const effect = useMemo(() => {
    const base = writeTarget ? tokenValueMap(writeTarget.css) : new Map<string, string>();
    let added = 0;
    let overridden = 0;
    let unchanged = 0;
    for (const [token, value] of reviewValues) {
      if (!base.has(token)) added++;
      else if (base.get(token) === value) unchanged++;
      else overridden++;
    }
    let removed = 0;
    if (mode === "clone" && targetSystem) {
      for (const token of base.keys()) if (!reviewValues.has(token)) removed++;
    }
    return { added, overridden, unchanged, removed };
  }, [reviewValues, writeTarget, mode, targetSystem]);

  /** One entry point for every source: the text, and where it came from. */
  const load = (
    text: string,
    from: SourceStatus,
    importedName?: string,
    origin?: SourceDescriptor,
  ) => {
    setCss(text);
    setStatus(from);
    if (origin) setSource(origin);
    if (importedName) setName((current) => (current.trim() ? current : importedName));
  };

  /** Start from an existing system: the ONE clone path. It seeds the visible
      buffer and selects clone mode, so Save writes exactly the buffer seen. */
  const seedFromExisting = (slug: string) => {
    const found = (systems ?? []).find((s) => s.slug === slug);
    if (!found) return;
    cancelImport();
    setCss(found.css);
    setStatus({ kind: "Cloned", detail: found.name, bytes: found.css.length });
    setSource({ kind: "clone" });
    setMode("clone");
    setTarget(slug);
    setError(null);
    setCollision(null);
    setStrippedPrefixes([]);
  };

  /** A JSON export is read into its `css` + `name`; anything else is kept as
      the CSS text it claims to be. */
  const applyText = (text: string) => {
    cancelImport();
    setError(null);
    setCollision(null);
    if (detectImportFormat(text) === "system-json") {
      try {
        const imported = readSystemJson(text);
        load(
          imported.css,
          { kind: "JSON export", detail: imported.name, bytes: imported.css.length },
          imported.name,
          { kind: "json" },
        );
        return;
      } catch (e) {
        setCss(text);
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
    }
    setCss(text);
    setSource({ kind: "paste" });
    setStatus({
      kind: "Pasted text",
      detail: detectImportFormat(text) === "css" ? "CSS" : "unrecognised",
      bytes: text.length,
    });
  };

  /** A fill-pane edit is a manual buffer replacement too. */
  const editCss = (next: string) => {
    cancelImport();
    setCollision(null);
    setCss(next);
  };

  const importJson = (text: string) => {
    setError(null);
    try {
      const imported = readSystemJson(text);
      load(
        imported.css,
        { kind: "JSON export", detail: imported.name, bytes: imported.css.length },
        imported.name,
        { kind: "json" },
      );
      setSourceRow(null);
      setJsonDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onJsonFile = async (file: File | undefined) => {
    if (!file) return;
    const request = beginImport();
    setError(null);
    try {
      const text = await untilAborted(file.text(), request.controller.signal);
      if (!isCurrentImport(request)) return;
      importJson(text);
    } catch (e) {
      if (!isCurrentImport(request)) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endImport(request);
    }
  };

  const onCssFile = async (file: File | undefined) => {
    if (!file) return;
    const request = beginImport();
    setError(null);
    try {
      const text = await untilAborted(readCssFile(file), request.controller.signal);
      if (!isCurrentImport(request)) return;
      load(text, { kind: "Uploaded file", detail: file.name, bytes: file.size }, undefined, {
        kind: "file",
        filename: file.name,
      });
      onToast(`Loaded ${file.name}`, "ok");
    } catch (e) {
      if (!isCurrentImport(request)) return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onToast(msg, "err");
    } finally {
      endImport(request);
    }
  };

  const fetchUrl = async () => {
    const urlTarget = url.trim();
    if (!urlTarget) {
      setError("Enter a stylesheet URL");
      return;
    }
    const request = beginImport();
    setError(null);
    setBusy(true);
    try {
      const text = await untilAborted(fetchCss(urlTarget), request.controller.signal);
      if (!isCurrentImport(request)) return;
      load(text, { kind: "Fetched URL", detail: urlTarget, bytes: text.length }, undefined, {
        kind: "url",
        url: urlTarget,
      });
      setSourceRow(null);
      onToast("CSS fetched", "ok");
    } catch (e) {
      if (!isCurrentImport(request)) return;
      const msg = `Fetch failed: ${e instanceof Error ? e.message : String(e)}`;
      setError(msg);
      onToast(msg, "err");
    } finally {
      // Only the fetch that still owns the ref may clear the button.
      if (isCurrentImport(request)) setBusy(false);
      endImport(request);
    }
  };

  /** Stamp the captured descriptor with the write time. */
  const stampSource = (base: SourceDescriptor | "clone" | null): SourceProvenance | undefined => {
    if (base === null) return undefined;
    if (base === "clone") return { kind: "clone", importedAt: new Date().toISOString() };
    return { ...base, importedAt: new Date().toISOString() };
  };

  const finish = () => {
    onOpenChange(false);
    if (!scopeSystem) onSaved(readAfterSave());
  };

  /** Anything the user would lose on close. */
  const hasContent = css.trim().length > 0 || name.trim().length > 0;

  /** Radix routes Escape, outside-click and Dialog.Close through here. */
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setConfirmDiscard(false);
      onOpenChange(true);
      return;
    }
    if (hasContent) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(false);
  };

  const fail = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    setError(msg);
    onToast(msg, "err");
  };

  const save = () => {
    setError(null);

    // Scoped sheet: add tokens to the active system through the same merge
    // path the Tokens tab uses. No identity, no collision — the target is fixed.
    if (scopeSystem) {
      if (!onMerge) {
        setError("No system to add these tokens to.");
        return;
      }
      if (tokenCount === 0) {
        setError("Nothing to add — paste at least one `--token: value;` line.");
        return;
      }
      try {
        onMerge(scopeSystem.slug, css, stampSource(source));
      } catch (e) {
        fail(e);
        return;
      }
      onToast("Tokens added", "ok");
      finish();
      return;
    }

    // A partial import is the default — missing names stay empty — and zero
    // schema tokens is the only hard fail.
    if (reviewCoverage.present === 0) {
      setError("Nothing to save — the import has no schema tokens yet.");
      return;
    }

    if (mode === "merge") {
      if (!onMerge || !targetSystem) {
        setError("Choose a system to merge into.");
        return;
      }
      try {
        onMerge(targetSystem.slug, css, stampSource(source));
      } catch (e) {
        fail(e);
        return;
      }
      onToast(`Merged into ${targetSystem.name}`, "ok");
      finish();
      return;
    }

    // A collision is a choice, never an exception.
    const clash = systems?.find((s) => s.slug === slugify(finalName));
    if (clash) {
      setConfirmReplace(false);
      setCollision({ slug: clash.slug, existingName: clash.name, name: finalName, css });
      return;
    }
    try {
      onAdd(finalName, css, stampSource(mode === "clone" ? source ?? "clone" : source));
    } catch (e) {
      fail(e);
      return;
    }
    onToast(mode === "clone" ? "System cloned" : "System added", "ok");
    finish();
  };

  /** Resolve a stashed slug collision. */
  const chooseCollision = (choice: "rename" | "merge" | "replace" | "cancel") => {
    if (!collision) return;
    if (choice === "cancel") {
      setCollision(null);
      setConfirmReplace(false);
      return;
    }
    const origin = stampSource(mode === "clone" ? source ?? "clone" : source);
    try {
      if (choice === "rename") onAdd(collision.name, collision.css, origin);
      else if (choice === "merge") {
        if (!onMerge) return;
        onMerge(collision.slug, collision.css, origin);
      } else {
        if (!onReplace) return;
        onReplace(collision.slug, collision.name, collision.css, origin);
      }
    } catch (e) {
      fail(e);
      return;
    }
    setCollision(null);
    setConfirmReplace(false);
    onToast(
      choice === "rename" ? "System added" : choice === "merge" ? "Merged into system" : "System replaced",
      "ok",
    );
    finish();
  };

  const title = scopeSystem ? `Add tokens — ${scopeSystem.name}` : "Add a system";
  const primaryLabel = scopeSystem
    ? "Add tokens"
    : mode === "merge"
      ? "Merge system"
      : mode === "clone"
        ? "Clone system"
        : "Save system";

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tok-dialog-overlay" />
        <Dialog.Content
          className="tok-dialog app-import-sheet"
          aria-modal="true"
          onOpenAutoFocus={(e) => {
            // Land in the paste box — the primary task.
            e.preventDefault();
            textareaRef.current?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          }}
        >
          <header className="app-import-sheet-head">
            <div className="app-import-headtext">
              <Dialog.Title className="app-import-title">{title}</Dialog.Title>
              <Dialog.Description className="app-import-sub">
                Paste CSS or a JSON export — nothing is saved until you save.
              </Dialog.Description>
            </div>
            <Dialog.Close className="app-import-close" aria-label="Close">
              <Icon name="x" size={15} />
            </Dialog.Close>
          </header>

          <div className="app-import-sheet-body">
            <section className="app-import-editor" aria-label="CSS text">
              <div className="app-import-sourcebar">
                <span className="app-import-sourcelabel">Source</span>
                <button type="button" className="app-import-sourcebtn" onClick={() => cssFileRef.current?.click()}>
                  <Icon name="file" size={13} /> Upload
                </button>
                <button
                  type="button"
                  className="app-import-sourcebtn"
                  aria-expanded={sourceRow === "url"}
                  onClick={() => {
                    setSourceRow((row) => (row === "url" ? null : "url"));
                    requestAnimationFrame(() => urlRef.current?.focus());
                  }}
                >
                  <Icon name="link" size={13} /> From URL
                </button>
                <button
                  type="button"
                  className="app-import-sourcebtn"
                  aria-expanded={sourceRow === "json"}
                  onClick={() => setSourceRow((row) => (row === "json" ? null : "json"))}
                >
                  Paste JSON export
                </button>
                {status && (
                  <p className="app-import-source" role="status">
                    <b>{status.kind}</b> {status.detail} · {formatBytes(status.bytes)} ·{" "}
                    {tokenCount} token{tokenCount === 1 ? "" : "s"}
                  </p>
                )}
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

              {sourceRow === "url" && (
                <div className="app-import-inline">
                  <input
                    ref={urlRef}
                    className="tok-input"
                    type="url"
                    name="stylesheet-url"
                    value={url}
                    placeholder="https://…/tokens.css"
                    aria-label="Stylesheet URL"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void fetchUrl();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="tok-btn tok-btn-primary"
                    disabled={busy}
                    aria-live="polite"
                    aria-busy={busy || undefined}
                    onClick={() => void fetchUrl()}
                  >
                    {busy ? "Fetching…" : "Fetch"}
                  </button>
                </div>
              )}

              {sourceRow === "json" && (
                <div className="app-import-inline app-import-inline-json">
                  <textarea
                    className="tok-textarea"
                    name="system-json"
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
                    Use this JSON
                  </button>
                  <input
                    ref={jsonFileRef}
                    type="file"
                    accept=".json,application/json"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      void onJsonFile(file);
                    }}
                  />
                </div>
              )}

              <textarea
                ref={textareaRef}
                className="tok-textarea app-import-textarea"
                name="import-css"
                value={css}
                spellCheck={false}
                aria-label="CSS text"
                placeholder={
                  "--color-bg: #0a0a0f;\n--color-text: #f0f0f3;\n\n…or paste a CSS file or JSON export…"
                }
                onChange={(e) => applyText(e.target.value)}
              />

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

              {isEmpty ? (
                <div className="app-import-empty" role="note">
                  <p className="app-import-emptyhint">
                    Paste a token block or a full stylesheet — one line is enough to
                    start:
                  </p>
                  <code className="app-import-emptyexample">--color-bg: #0a0a0f;</code>
                </div>
              ) : (
                <CssPreview css={css} baseCss={baseCss} />
              )}
            </section>

            <details className="app-import-schema">
              <summary className="app-import-schemasummary">
                <Icon name="chevronRight" size={14} className="app-import-disclosureicon" />
                <span className="app-import-schematitle">Fill missing from schema</span>
                <span className="app-import-sub">
                  {reviewCoverage.present}/{reviewCoverage.expected} names ·{" "}
                  {reviewCoverage.groups.length} groups
                </span>
              </summary>
              <div className="app-import-schemabody" aria-label="Schema fill">
                <SchemaFill css={css} onChange={editCss} />
              </div>
            </details>

            {!scopeSystem && (
              <section className="app-import-identity" aria-label="Identity">
                <div className="app-import-identityrow">
                  <div className="app-import-modes" role="radiogroup" aria-label="Write mode">
                    {WRITE_MODES.map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={mode === id}
                        className="app-import-modebtn"
                        onClick={() => {
                          setMode(id);
                          setTarget("");
                          setCollision(null);
                          setConfirmReplace(false);
                          setError(null);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {mode !== "merge" && (
                    <input
                      className="tok-input app-import-name"
                      value={name}
                      autoComplete="off"
                      placeholder="System name (Untitled)"
                      aria-label="System name"
                      onChange={(e) => setName(e.target.value)}
                    />
                  )}
                  {mode !== "new" && systems && systems.length > 0 && (
                    <select
                      className="tok-input app-import-target"
                      value={target}
                      aria-label={mode === "merge" ? "System to merge into" : "System to clone from"}
                      onChange={(e) => {
                        const slug = e.target.value;
                        setTarget(slug);
                        setConfirmReplace(false);
                        setError(null);
                        // Clone seeds the visible buffer; Save writes `css`.
                        if (mode === "clone" && slug) seedFromExisting(slug);
                      }}
                    >
                      <option value="">{mode === "merge" ? "Merge into…" : "Clone from…"}</option>
                      {(systems ?? []).map((s) => (
                        <option key={s.slug} value={s.slug}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </section>
            )}
          </div>

          <footer className="app-import-sheet-foot">
            {error && (
              <p className="app-import-error" role="alert">
                {error}
              </p>
            )}

            {confirmDiscard && (
              <div className="app-import-collision" role="alert">
                <span>Discard this import? The buffer will be lost.</span>
                <button
                  type="button"
                  className="tok-btn tok-btn-danger"
                  onClick={() => {
                    setConfirmDiscard(false);
                    onOpenChange(false);
                  }}
                >
                  Discard
                </button>
                <button type="button" className="tok-btn" onClick={() => setConfirmDiscard(false)}>
                  Keep editing
                </button>
              </div>
            )}

            {collision ? (
              <div className="app-import-collision" role="alert">
                {confirmReplace ? (
                  <>
                    <span>
                      Replacing <b>{collision.existingName}</b> permanently overwrites it. This cannot
                      be undone.
                    </span>
                    <button
                      type="button"
                      className="tok-btn tok-btn-danger"
                      onClick={() => chooseCollision("replace")}
                    >
                      Replace permanently
                    </button>
                    <button type="button" className="tok-btn" onClick={() => setConfirmReplace(false)}>
                      Keep existing
                    </button>
                  </>
                ) : (
                  <>
                    <span>
                      <b>{collision.existingName}</b> already exists — <code>{collision.slug}</code> is
                      taken.
                    </span>
                    <button type="button" className="tok-btn" onClick={() => chooseCollision("rename")}>
                      Rename to “{renameSlug}”
                    </button>
                    {onMerge && (
                      <button type="button" className="tok-btn" onClick={() => chooseCollision("merge")}>
                        Merge into it
                      </button>
                    )}
                    {onReplace && (
                      <button
                        type="button"
                        className="tok-btn tok-btn-danger"
                        onClick={() => setConfirmReplace(true)}
                      >
                        Replace it
                      </button>
                    )}
                    <button type="button" className="tok-btn" onClick={() => chooseCollision("cancel")}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            ) : (
              !isEmpty && (
                <details className="app-import-review">
                  <summary className="app-import-reviewsummary">
                    <Icon name="chevronRight" size={14} className="app-import-disclosureicon" />
                    Review changes
                  </summary>
                  <div className="app-import-reviewbody">
                    <p className="app-import-compare">{compareLine}</p>
                    <p className="app-import-reviewcounts">
                      <span className={`app-import-diffstat${effect.added ? " is-added" : ""}`}>
                        Added <b>{effect.added}</b>
                      </span>
                      <span
                        className={`app-import-diffstat${effect.overridden ? " is-overridden" : ""}`}
                      >
                        Overridden <b>{effect.overridden}</b>
                      </span>
                      <span className="app-import-diffstat">
                        Unchanged <b>{effect.unchanged}</b>
                      </span>
                      <span className={`app-import-diffstat${effect.removed ? " is-removed" : ""}`}>
                        Removed <b>{effect.removed}</b>
                      </span>
                    </p>
                  </div>
                </details>
              )
            )}

            <div className="app-import-footbar">
              {scopeSystem && (
                <span className="app-import-targetnote">
                  Into <b>{scopeSystem.name}</b>
                </span>
              )}
              <div className="app-import-actions">
                <Dialog.Close className="tok-btn">Cancel</Dialog.Close>
                <button type="button" className="tok-btn tok-btn-primary" onClick={save}>
                  {primaryLabel}
                </button>
              </div>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
