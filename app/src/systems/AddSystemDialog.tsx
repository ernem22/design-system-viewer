import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { REFERENCE, coverage, templateCss } from "../../../src/core/schema.js";
import { lintTokens, parseTokens, slugify } from "../../../src/core/parse.js";
import type { AppTab } from "../shell/Shell.tsx";
import type { PushToast } from "../lib/toasts.ts";
import { Icon } from "../lib/icons.tsx";
import { CssPreview } from "../tokens/CssPreview.tsx";
import { countTokens } from "../tokens/tokenUtils.ts";
import { fetchCss, readCssFile } from "../lib/cssImport.ts";
import {
  detectImportFormat,
  detectPrefixes,
  extraSuggestions,
  mergePreview,
  readSystemJson,
  stripPrefix,
} from "../lib/systemImport.ts";
import { tokenValueMap } from "../lib/tokenCss.ts";
import type { CoverageInfo, LintWarning } from "../tokens/useTokensView.ts";
import {
  nextFreeSlug,
  type DesignSystem,
  type SourceDescriptor,
  type SourceProvenance,
} from "./store.ts";
import { AFTER_SAVE_TABS, readAfterSave, writeAfterSave } from "./afterSave.ts";
import { SchemaFill } from "./SchemaFill.tsx";
// Dialog primitives (.tok-dialog*) + shared add-dialog language live with
// the toolbar — imported here (not just in TokenToolbar) so the dialog stays
// styled even with zero systems, when no toolbar renders.
import "../tokens/TokenToolbar.css";
import "./AddSystemDialog.css";

const FULL_TEMPLATE_COUNT = (REFERENCE as { tokens: string[] }[]).reduce((n, g) => n + g.tokens.length, 0);

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** What the current text came from. One line in the top bar, because a toast
    is gone before it has been read. */
interface SourceStatus {
  kind: string;
  detail: string;
  bytes: number;
}

/** How Save writes: a brand-new system, a merge into a chosen one, or a new
    system seeded from a chosen one (the legacy copy's capability, in place). */
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

/** Stepper shell (slice 1, #213): Source → Review → Save inside the existing
    `.tok-dialog` shell. Back never loses the parsed text (the `css` buffer
    lives above the step), Cancel at any step writes nothing, and nothing is
    written before Save (the write entry point only renders on step 3). */
type Step = 1 | 2 | 3;

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "Source" },
  { id: 2, label: "Review" },
  { id: 3, label: "Save" },
];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

/** Resolve with `task` unless `signal` aborts first — then reject with an
    AbortError. `readCssFile`/`fetchCss` take no signal, so this is what stops
    the dialog's continuation the moment an import is superseded or the dialog
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
 * Add System dialog (controlled — the topbar `+`, the empty-state cards and a
 * page-level file drop all open the same instance).
 *
 * The dialog exists to *add a system*, so the work owns the surface: two live
 * panes over the same CSS text — the schema fill (54 groups, one row per name,
 * fill a single token without pasting 432 lines) and the raw text — filling
 * everything between a one-line top bar and a one-line bottom bar.
 *
 * The ways in (upload, URL, fill-with-schema, plus a More-sources menu for
 * JSON export, copy-empty-schema and seed-from-existing) are compact
 * triggers in that top bar, each opening only the row it needs. The three
 * steps gate the write, not the work: step 1 holds every source trigger and
 * both panes, step 2 holds the grouped schema fill (Form ⇄ Paste over the
 * same text), step 3 holds identity and the write. Nothing is written until Save.
 */
export function AddSystemDialog({
  open,
  initialCss,
  onOpenChange,
  onAdd,
  onMerge,
  onReplace,
  systems,
  onToast,
  onSaved,
}: {
  open: boolean;
  /** Pre-filled CSS (a dropped file); read each time the dialog opens. */
  initialCss?: string;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string, css: string, source?: SourceProvenance) => void;
  /** Merge the imported block into an existing system's slug. */
  onMerge?: (slug: string, css: string, source?: SourceProvenance) => void;
  /** Overwrite an existing system in place (the collision "replace" choice). */
  onReplace?: (slug: string, name: string, css: string, source?: SourceProvenance) => void;
  /** The systems a merge/clone target and a slug collision come from. */
  systems?: DesignSystem[];
  onToast: PushToast;
  onSaved: (tab: AppTab) => void;
}) {
  const [name, setName] = useState("");
  const [css, setCss] = useState("");
  const [step, setStep] = useState<Step>(1);
  const [status, setStatus] = useState<SourceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [urlOpen, setUrlOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonDraft, setJsonDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [afterSave, setAfterSave] = useState<AppTab>(readAfterSave);
  const [strippedPrefixes, setStrippedPrefixes] = useState<string[]>([]);
  const [mode, setMode] = useState<WriteMode>("new");
  const [target, setTarget] = useState("");
  const [collision, setCollision] = useState<Collision | null>(null);
  const [source, setSource] = useState<SourceDescriptor | null>(null);
  /** Review-step view (#215): the form and the paste are two ways of seeing
      the same `css` string, so this only switches which pane renders. */
  const [reviewView, setReviewView] = useState<"form" | "paste">("form");
  const cssFileRef = useRef<HTMLInputElement>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  // One in-flight import at a time. Starting a new one aborts the old and takes
  // over the ref; only the request still referenced here may write the buffer,
  // so a slow import cannot land on top of the one that replaced it.
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

  // Fresh buffer per open (a dropped file pre-fills it). Re-read the "Open in"
  // preference too, so a legacy key migrated after this dialog mounted is
  // reflected in the menu.
  useEffect(() => {
    if (!open) return;
    // A page drop may hand us raw JSON (a .json export dropped onto the page
    // opens here via `initialCss`): detect it so the drop round-trips with its
    // name, exactly like a paste into the text pane. Anything else stays CSS.
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
      setStatus(initialCss ? { kind: "Dropped file", detail: "page drop", bytes: initialCss.length } : null);
      setSource(initialCss ? { kind: "drop" } : null);
    }
    setError(null);
    setUrl("");
    setUrlOpen(false);
    setJsonOpen(false);
    setJsonDraft("");
    setStrippedPrefixes([]);
    setAfterSave(readAfterSave());
    setBusy(false);
    setMode("new");
    setTarget("");
    setCollision(null);
    setReviewView("form");
    // A close (or a re-seed) supersedes anything still in flight: abort it so
    // its handler cannot settle on a buffer that is no longer ours.
    return () => {
      importReqRef.current?.controller.abort();
      importReqRef.current = null;
    };
  }, [open, initialCss]);

  const prefixes = useMemo(
    () => detectPrefixes(css).filter((p) => !strippedPrefixes.includes(p)),
    [css, strippedPrefixes],
  );
  const tokenCount = countTokens(css);
  /** Review summary (#216): always recomputed from the CSS text, never
      stored. Coverage gives present/432, extras carry near-miss suggestions,
      lint lists value warnings, and colour tokens show swatches. */
  const reviewValues = useMemo(() => tokenValueMap(css), [css]);
  const reviewCoverage = useMemo(
    () => coverage([...reviewValues.keys()]) as CoverageInfo,
    [reviewValues],
  );
  const reviewExtras = useMemo(() => extraSuggestions(css), [css]);
  const reviewWarnings = useMemo(
    () => (css.trim() ? (lintTokens(parseTokens(css)) as LintWarning[]) : []),
    [css],
  );
  const reviewColors = useMemo(
    () => [...reviewValues.entries()].filter(([name]) => name.startsWith("--color-")),
    [reviewValues],
  );

  /** One entry point for every source: the text, and where it came from.
      `from` is the human status line; `origin` is the structured provenance
      that gets written onto the system at Save (issue #125). */
  const load = (text: string, from: SourceStatus, importedName?: string, origin?: SourceDescriptor) => {
    setCss(text);
    setStatus(from);
    if (origin) setSource(origin);
    if (importedName) setName((current) => (current.trim() ? current : importedName));
  };

  /** Slice 2 (#214): start from an existing system. Seeds the Source buffer
      with that system's CSS — the write still happens only on Save, and the
      origin stays a clone so the provenance matches the Save-step clone mode. */
  const seedFromExisting = (slug: string) => {
    const found = (systems ?? []).find((s) => s.slug === slug);
    if (!found) return;
    cancelImport();
    setCss(found.css);
    setStatus({ kind: "Cloned", detail: found.name, bytes: found.css.length });
    setSource({ kind: "clone" });
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
    setStatus({ kind: "Pasted text", detail: detectImportFormat(text) === "css" ? "CSS" : "unrecognised", bytes: text.length });
  };

  /** A fill-pane edit is a manual buffer replacement too: it must supersede an
      in-flight import so the import's late result cannot land on top of it. */
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
      setJsonOpen(false);
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
    const target = url.trim();
    if (!target) {
      setError("Enter a stylesheet URL");
      return;
    }
    const request = beginImport();
    setError(null);
    setBusy(true);
    try {
      const text = await untilAborted(fetchCss(target), request.controller.signal);
      if (!isCurrentImport(request)) return;
      load(text, { kind: "Fetched URL", detail: target, bytes: text.length }, undefined, {
        kind: "url",
        url: target,
      });
      setUrlOpen(false);
      onToast("CSS fetched", "ok");
    } catch (e) {
      if (!isCurrentImport(request)) return;
      const msg = `Fetch failed: ${e instanceof Error ? e.message : String(e)}`;
      setError(msg);
      onToast(msg, "err");
    } finally {
      // Only the fetch that still owns the ref may clear the button: a
      // superseded fetch settles here while a newer one is still in flight,
      // and clearing `busy` would hide that newer fetch's loading state.
      if (isCurrentImport(request)) setBusy(false);
      endImport(request);
    }
  };

  const targetSystem = systems?.find((s) => s.slug === target) ?? null;
  const renameSlug = collision
    ? nextFreeSlug(collision.slug, (systems ?? []).map((s) => s.slug))
    : "";
  const review = mode === "merge" && targetSystem ? mergePreview(targetSystem.css, css) : null;

  /** Stamp the captured descriptor with the write time; a clone with no import
      source is recorded as a clone of the chosen system. */
  const stampSource = (base: SourceDescriptor | "clone" | null): SourceProvenance | undefined => {
    if (base === null) return undefined;
    if (base === "clone") return { kind: "clone", importedAt: new Date().toISOString() };
    return { ...base, importedAt: new Date().toISOString() };
  };

  const finish = () => {
    onOpenChange(false);
    onSaved(afterSave);
  };

  const fail = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    setError(msg);
    onToast(msg, "err");
  };

  const save = () => {
    // The stepper shell gates the write: Save only runs on step 3. The
    // button itself only renders there; this guard covers the keyboard
    // shortcut reaching `save` from an earlier step.
    if (step !== 3) return;
    const isClone = mode === "clone";
    const seedCss = isClone ? targetSystem?.css : undefined;
    // Slice 4 (#216): a partial import is the default — missing names stay
    // empty — and zero schema tokens is the only hard fail. Extras alone do
    // not count: Preview only reads the schema, so an extras-only source has
    // nothing to save. A clone seeded from an existing system carries that
    // system's schema tokens, so it is exempt.
    const seedPresent = seedCss ? (coverage([...tokenValueMap(seedCss).keys()]) as CoverageInfo).present : 0;
    if (reviewCoverage.present === 0 && seedPresent === 0) {
      setError("Nothing to save — the import has no schema tokens yet.");
      return;
    }
    setError(null);

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

    const finalName = name.trim() || "Untitled";
    const finalCss = seedCss ? `${seedCss}\n\n${css}` : css;
    // A collision is a choice, never an exception: stash the write and let the
    // user pick rename / merge / replace / cancel in the footer.
    const clash = systems?.find((s) => s.slug === slugify(finalName));
    if (clash) {
      setCollision({ slug: clash.slug, existingName: clash.name, name: finalName, css: finalCss });
      return;
    }
    try {
      onAdd(finalName, finalCss, stampSource(isClone ? source ?? "clone" : source));
    } catch (e) {
      fail(e);
      return;
    }
    onToast(isClone ? "System cloned" : "System added", "ok");
    finish();
  };

  /** Resolve a stashed slug collision. Rename goes back through onAdd (the
      store suffixes `-2`); merge/replace target the colliding slug. */
  const chooseCollision = (choice: "rename" | "merge" | "replace" | "cancel") => {
    if (!collision) return;
    if (choice === "cancel") {
      setCollision(null);
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
    onToast(
      choice === "rename" ? "System added" : choice === "merge" ? "Merged into system" : "System replaced",
      "ok",
    );
    finish();
  };

  const copyTemplate = () => {
    const clip = navigator.clipboard;
    if (!clip) {
      onToast("Copy failed", "err");
      return;
    }
    clip.writeText(templateCss()).then(
      () => onToast(`Copied the ${FULL_TEMPLATE_COUNT}-name empty schema`, "ok"),
      () => onToast("Copy failed", "err"),
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tok-dialog-overlay" />
        <Dialog.Content
          className="tok-dialog app-import-dialog"
          /* Radix sets role="dialog" + aria-labelledby/-describedby but not
             aria-modal, so AT cannot tell the page behind is inert. */
          aria-modal="true"
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
            {step === 1 && (
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
                onClick={() => {
                  cancelImport();
                  setCollision(null);
                  setCss(templateCss());
                  setError(null);
                  setSource({ kind: "template" });
                }}
                title={`Insert the ${FULL_TEMPLATE_COUNT} empty schema names into the editor`}
              >
                Fill with schema
              </button>
              {/* Less-used sources share one menu so the toolbar stays on one
                  row at desktop width and no select label is cut. */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger className="tok-btn" aria-label="More sources">
                  More sources
                  <Icon name="chevronDown" size={12} />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="tok-menu" sideOffset={6} align="end">
                    <DropdownMenu.Item
                      className="tok-menu-item"
                      onSelect={() => {
                        setJsonOpen(true);
                        setUrlOpen(false);
                      }}
                    >
                      JSON export
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className="tok-menu-item" onSelect={copyTemplate}>
                      Copy empty schema
                    </DropdownMenu.Item>
                    {systems && systems.length > 0 && (
                      <>
                        <DropdownMenu.Separator className="app-import-menusep" />
                        <DropdownMenu.Label className="app-import-menulabel">
                          Start from existing
                        </DropdownMenu.Label>
                        {systems.map((s) => (
                          <DropdownMenu.Item
                            key={s.slug}
                            className="tok-menu-item"
                            onSelect={() => seedFromExisting(s.slug)}
                          >
                            {s.name}
                          </DropdownMenu.Item>
                        ))}
                      </>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
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
            {status && (
              <p className="app-import-status" role="status">
                <b>{status.kind}</b> {status.detail} · {formatBytes(status.bytes)} · {tokenCount} tokens
              </p>
            )}
            <Dialog.Close className="app-import-close" aria-label="Close">
              <Icon name="x" size={15} />
            </Dialog.Close>
            </div>
            {/* Stepper shell (#213): the steps gate the write, not the work. */}
            <ol className="app-import-steps" aria-label="Import steps">
              {STEPS.map((s) => (
                <li
                  key={s.id}
                  className="app-import-step"
                  aria-current={step === s.id ? "step" : undefined}
                  data-active={step === s.id}
                  data-done={step > s.id}
                >
                  <span className="app-import-stepnum" aria-hidden="true">
                    {s.id}
                  </span>
                  <span className="app-import-steplabel">{s.label}</span>
                </li>
              ))}
            </ol>

          {step === 1 && urlOpen && (
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

          {step === 1 && jsonOpen && (
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
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void onJsonFile(file);
                }}
              />
            </div>
          )}

          {step === 1 && prefixes.length > 0 && (
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

          {/* Step 1 holds the work: the same CSS text, seen as the schema and
              as text. Steps 2–3 only read the buffer, so Back never loses it. */}
          {step === 1 ? (
          <div className="app-import-work">
            <section className="app-import-pane" aria-label="Schema fill">
              <div className="app-import-panehead">
                <span className="app-import-panetitle">Fill the schema</span>
                <span className="app-import-sub">{FULL_TEMPLATE_COUNT} names in 54 groups</span>
              </div>
              <div className="app-import-panebody">
                <SchemaFill css={css} onChange={editCss} />
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
          ) : step === 2 ? (
          <div className="app-import-stepbody">
            {/* Review (#215 + #216): the grouped schema fill over the same `css`
                string the Source paste edits, with the import summary on top.
                The Form ⇄ Paste toggle only switches which pane renders — both
                read and write `css`, so the paths interleave without loss and
                `coverage()` stays derived, never hand-edited. Nothing is
                written until Save. */}
            <section className="app-import-reviewpane" aria-label="Review">
              {/* Summary (#216): coverage present/432, extras with near-miss
                  suggestions, lint warnings, colour swatches. A rename-mapping
                  UI is out of scope — suggestions read as text here; the fill
                  below already renames. Partial import is the default; only
                  zero schema tokens fails, at Save. */}
              <section className="app-import-summary" aria-label="Import summary">
                <p className="app-import-reviewcount" role="status">
                  {tokenCount} token{tokenCount === 1 ? "" : "s"} ready · {reviewCoverage.present}/{reviewCoverage.expected} schema tokens
                  {reviewExtras.length > 0 && (
                    <span className="warn"> · {reviewExtras.length} extra</span>
                  )}
                  {reviewWarnings.length > 0 && (
                    <span className="warn"> · {reviewWarnings.length} value warning{reviewWarnings.length === 1 ? "" : "s"}</span>
                  )}
                </p>
                {status ? (
                  <p className="app-import-sub">
                    {status.kind} · {status.detail} · {formatBytes(status.bytes)}
                  </p>
                ) : (
                  <p className="app-import-sub">Pasted text · no source yet</p>
                )}
                <p className="app-import-sub">
                  Partial import is the default — missing names stay empty. Nothing is written until
                  you save.
                </p>
                {reviewExtras.length > 0 && (
                  <ul className="app-import-extras" aria-label="Extra tokens">
                    {reviewExtras.map(({ name, suggest }) => (
                      <li key={name} className="app-import-extra">
                        <code className="app-fill-name">{name}</code>
                        {suggest ? (
                          <span className="app-import-suggest">
                            {" → "}
                            <code className="app-fill-name">{suggest}</code>
                          </span>
                        ) : (
                          <span className="app-import-sub"> — no suggestion</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {reviewWarnings.length > 0 && (
                  <ul className="app-import-warnings" aria-label="Value warnings">
                    {reviewWarnings.map((w) => (
                      <li key={w.name} className="app-import-warning">
                        <code className="app-fill-name">{w.name}</code>
                        <span className="app-import-sub"> — {w.msg}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {reviewColors.length > 0 && (
                  <ul className="app-import-swatches" aria-label="Colour tokens">
                    {reviewColors.map(([name, value]) => (
                      <li key={name} className="app-import-swatchrow" title={`${name}: ${value}`}>
                        {HEX.test(value.trim()) && (
                          <span className="app-import-swatch" style={{ background: value.trim() }} />
                        )}
                        <code className="app-fill-name">{name}</code>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <div className="app-import-viewtoggle" role="group" aria-label="Review view">
                <button
                  type="button"
                  className="tok-btn"
                  aria-pressed={reviewView === "form"}
                  onClick={() => setReviewView("form")}
                >
                  Form
                </button>
                <button
                  type="button"
                  className="tok-btn"
                  aria-pressed={reviewView === "paste"}
                  onClick={() => setReviewView("paste")}
                >
                  Paste
                </button>
              </div>
              {reviewView === "form" ? (
                <SchemaFill css={css} onChange={editCss} />
              ) : (
                <textarea
                  className="tok-textarea app-import-textarea"
                  value={css}
                  spellCheck={false}
                  aria-label="Review CSS text"
                  placeholder={"--color-bg: #0a0a0f;\n--color-text: #f0f0f3;"}
                  onChange={(e) => applyText(e.target.value)}
                />
              )}
              <p className="app-import-sub">Nothing is written until you save.</p>
            </section>
          </div>
          ) : (
          <div className="app-import-stepbody">
            <section className="app-import-savepane" aria-label="Save">
              <p className="app-import-reviewcount" role="status">
                {tokenCount} token{tokenCount === 1 ? "" : "s"} → {name.trim() || "Untitled"}
              </p>
              <p className="app-import-sub">Choose a name and how to write. Nothing is written until you save.</p>
            </section>
          </div>
          )}

          {/* One line of chrome: identity (step 3 only), the error if any,
              and the step navigation. The write entry point only renders on
              step 3, so nothing can be written before it. */}
          <footer className="app-import-foot">
            {step === 3 && systems && systems.length > 0 && (
              <div className="app-import-mode" role="group" aria-label="Write mode">
                {WRITE_MODES.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className="tok-btn"
                    aria-pressed={mode === id}
                    onClick={() => {
                      setMode(id);
                      setTarget("");
                      setCollision(null);
                      setError(null);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {step === 3 && mode !== "new" && systems && systems.length > 0 && (
              <select
                className="tok-input app-import-target"
                value={target}
                aria-label={mode === "merge" ? "System to merge into" : "System to clone from"}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setError(null);
                }}
              >
                <option value="">
                  {mode === "merge" ? "Merge into…" : "Clone from…"}
                </option>
                {systems.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            {step === 3 && (
            <input
              className="tok-input app-import-name"
              value={name}
              autoComplete="off"
              placeholder="System name (Untitled)"
              aria-label="System name"
              onChange={(e) => setName(e.target.value)}
            />
            )}
            {step === 3 && collision ? (
              <div className="app-import-collision" role="alert">
                <span>
                  <b>{collision.existingName}</b> already exists — <code>{collision.slug}</code> is taken.
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
                  <button type="button" className="tok-btn" onClick={() => chooseCollision("replace")}>
                    Replace it
                  </button>
                )}
                <button type="button" className="tok-btn" onClick={() => chooseCollision("cancel")}>
                  Cancel
                </button>
              </div>
            ) : step === 3 && review ? (
              <p className="app-import-review" role="status">
                <span>Added {review.added}</span>
                <span>Overridden {review.overridden}</span>
                <span>Unchanged {review.unchanged}</span>
              </p>
            ) : error ? (
              <p className="app-import-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="app-import-write">
              <Dialog.Close className="tok-btn">Cancel</Dialog.Close>
              {step > 1 && (
                <button type="button" className="tok-btn" onClick={() => setStep((s) => (s === 3 ? 2 : 1))}>
                  Back
                </button>
              )}
              {step < 3 && (
                <button
                  type="button"
                  className="tok-btn tok-btn-primary"
                  onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
                >
                  Continue
                </button>
              )}
              {step === 3 && (
              <button type="button" className="tok-btn tok-btn-primary" onClick={save}>
                {mode === "merge" ? "Merge system" : mode === "clone" ? "Clone system" : "Save system"}
              </button>
              )}
              {step === 3 && (
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
              )}
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
