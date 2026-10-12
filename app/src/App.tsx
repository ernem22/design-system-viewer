import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Shell, { type AppTab, type ShellTab } from "./shell/Shell.tsx";
import ErrorBoundary from "./shell/ErrorBoundary.tsx";
import Brand from "./shell/Brand.tsx";
import IconToggleButton from "./shell/IconToggleButton.tsx";
import IconActionButton from "./shell/IconActionButton.tsx";
import { SectionSearch } from "./shell/SectionSearch.tsx";
import { Toasts } from "./shell/Toasts.tsx";
import { DropOverlay, Welcome } from "./shell/Welcome.tsx";
import { copyLinkToView } from "./lib/copyLink.ts";
import { decodeSystem, type DecodedSharedSystem } from "./lib/shareLink.ts";
import { SharedSystemBanner } from "./shell/SharedSystemBanner.tsx";
import { buildSystem, parseTokens } from "../../src/core/parse.js";
import { isJsonFile, readCssFile, useCssFileDrop } from "./lib/cssImport.ts";
import { readSystemJson } from "./lib/systemImport.ts";
import { useGoogleFonts } from "./lib/googleFonts.ts";
import { Icon } from "./lib/icons.tsx";
import { useToasts } from "./lib/toasts.ts";
import { clearAll, countOverrides, useInspector } from "./lib/tokenOverrides.ts";
import { useSystems, resolveSystemTokens } from "./systems/store.ts";
import type { DesignSystem } from "./systems/store.ts";
import { usePanels } from "./lib/panelStorage.ts";
import SystemSwitcher from "./systems/SystemSwitcher.tsx";
import { SystemMenu } from "./systems/SystemMenu.tsx";
import { AddSystemDialog } from "./systems/AddSystemDialog.tsx";
import "./systems/AddSystemDialog.css";
import Rail from "./shell/Rail.tsx";
import { COMPONENT_ENTRIES } from "./gallery/components/index.ts";
import { buildRailGroups } from "./gallery/registry.ts";
import { GallerySection } from "./gallery/ui.tsx";
import { TokensProps } from "./tokens/TokensProps.tsx";
import { TokensView } from "./tokens/TokensView.tsx";
import { download, systemToCss } from "./tokens/export.ts";
import { useTokensView } from "./tokens/useTokensView.ts";
import { useGalleryOutline } from "./lib/galleryOutline.ts";
import { CompareView } from "./compare/CompareView.tsx";
import { CompareRail } from "./compare/CompareRail.tsx";
import { CompareProps } from "./compare/CompareProps.tsx";
import { useCompareView, DEFAULT_COMPONENT_ID } from "./compare/useCompareView.ts";
import { PreviewProps, PreviewScopeDialog } from "./preview/PreviewProps.tsx";
import { PreviewNotes } from "./preview/PreviewNotes.tsx";
import { clearSharedParam, initialSectionHash, readSharedParam, readViewUrl, scrollToSection, writeViewUrl } from "./lib/urlState.ts";
import "./gallery/gallery.css";

// Stable across renders — buildRailGroups reads this by entry id, and
// useGalleryOutline's effect only needs to re-scan the DOM if this changes.
const ENTRY_IDS = COMPONENT_ENTRIES.map((e) => e.id);
const APP_TITLE = "Design System Viewer";

function App() {
  const {
    systems,
    loading,
    error: loadError,
    active: storedActive,
    activeSlug: storedActiveSlug,
    retry,
    setActiveSlug,
    addSystem,
    mergeCss,
    replaceSystem,
    renameSystem,
    duplicateSystem,
    patchToken,
    removeSystem,
  } = useSystems();
  const [toasts, pushToast] = useToasts();
  // Shared-system offer from a `?s=` link (issue #337): the decoded payload
  // waits here until the recipient clicks — nothing is saved without a click.
  // `sessionSystem` is the Open choice: the shared system applied as the
  // active one for this session only, held in App state, never localStorage.
  const [sharedOffer, setSharedOffer] = useState<DecodedSharedSystem | null>(null);
  const [sessionSystem, setSessionSystem] = useState<DesignSystem | null>(null);
  const active = sessionSystem ?? storedActive;
  const activeSlug = sessionSystem?.slug ?? storedActiveSlug;

  // One-shot `?s=` decode on load (issue #337). The param is cleared before
  // the async decode even finishes, in every case — damaged included — so a
  // refresh never re-triggers the banner and later copies carry no stale `s`.
  // A rejection toasts "This shared link is damaged" and the app continues
  // normally, with no banner and nothing saved.
  useEffect(() => {
    const s = readSharedParam();
    if (!s) return;
    clearSharedParam();
    let alive = true;
    decodeSystem(s).then(
      (decoded) => {
        if (alive) setSharedOffer(decoded);
      },
      () => {
        pushToast("This shared link is damaged", "warn");
      },
    );
    return () => {
      alive = false;
    };
  }, [pushToast]);

  // Picking a stored system ends the shared session: the switcher names a
  // saved system, and the session one was never saved.
  const handleSelectSystem = useCallback(
    (slug: string) => {
      setSessionSystem(null);
      setActiveSlug(slug);
    },
    [setActiveSlug],
  );

  // Open applies the shared system for this session without saving; Add
  // saves through the existing addSystem path (which resolves name/slug
  // collisions), selecting the stored twin when its tokens already match
  // instead of adding a duplicate. Both consume the one-shot offer.
  const handleSharedOpen = useCallback(() => {
    if (!sharedOffer) return;
    setSessionSystem(
      buildSystem({ name: sharedOffer.name, css: sharedOffer.css }) as DesignSystem,
    );
    setSharedOffer(null);
  }, [sharedOffer]);
  const handleSharedAdd = useCallback(() => {
    if (!sharedOffer) return;
    const wanted = new Map(sharedOffer.tokens.map((t) => [t.name, t.value]));
    const twin = systems.find((s) => {
      let theirs: { name: string; value: string }[];
      try {
        theirs = parseTokens(s.css) as { name: string; value: string }[];
      } catch {
        return false;
      }
      return (
        theirs.length === sharedOffer.tokens.length &&
        theirs.every((t) => wanted.get(t.name) === t.value)
      );
    });
    if (twin) setActiveSlug(twin.slug);
    else addSystem(sharedOffer.name, sharedOffer.css);
    setSessionSystem(null);
    setSharedOffer(null);
  }, [sharedOffer, systems, addSystem, setActiveSlug]);
  const handleSharedDismiss = useCallback(() => {
    setSharedOffer(null);
  }, []);
  // Panel collapse lives here so the toggles can sit in the topbar —
  // no floating edge handle next to the main scrollbar. Same storage
  // keys as before, so persisted choices survive the move. On narrow
  // viewports (issue #282) the two panels are overlay drawers instead:
  // both start closed, opening one closes the other, and toggles there
  // never touch the stored desktop preference.
  const {
    railOpen,
    propsOpen,
    narrow: narrowPanels,
    toggleRail,
    toggleProps,
    revealProps,
    closePanels,
  } = usePanels();

  // Narrow drawers are dismissible: Esc or a pointer outside both drawers
  // (and outside the topbar, whose toggles own their own clicks) closes the
  // open one. Desktop panels are unaffected — Esc never collapses them.
  useEffect(() => {
    if (!narrowPanels || (!railOpen && !propsOpen)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanels();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Element | null;
      // A token row/swatch is a selecting tap, not an outside tap: it reveals
      // the props drawer (issue #315), so dismissing on its pointerdown would
      // close the drawer before the click could re-open it — leaving a re-tap
      // of the same token looking like a toggle. Its click owns the reveal.
      if (target?.closest?.(".app-rail, .app-props, .app-topbar, .app-toasts, [data-token]")) return;
      closePanels();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [narrowPanels, railOpen, propsOpen, closePanels]);
  // Active tab lives here (not in Shell) so the URL sync below sees every
  // switch — Shell stays a controlled chrome shell. A deep-linked ?tab=
  // wins; otherwise this is "tokens", exactly as before.
  const [tab, setTab] = useState<AppTab>(() => readViewUrl().tab ?? "tokens");
  // Section-hash sync stays off until the initial deep-link restore lands,
  // so the first scrollspy scan can't clobber a #section before it scrolls.
  const [sectionSyncArmed, setSectionSyncArmed] = useState(false);
  // Seeded from ?q= so a copied Preview link reopens with the same search —
  // the writer below keeps the URL in sync while the Preview tab is active.
  const [query, setQuery] = useState(() => readViewUrl().q ?? "");

  const [addOpen, setAddOpen] = useState(false);
  const [addCss, setAddCss] = useState("");
  const openAdd = useCallback((css = "") => {
    setAddCss(css);
    setAddOpen(true);
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searching = query.trim().length > 0;
  const outline = useGalleryOutline(ENTRY_IDS);
  const railGroups = useMemo(
    () => buildRailGroups(COMPONENT_ENTRIES, outline, query),
    [outline, query],
  );
  // Search narrows the Preview content too, not just its rail (legacy).
  // Screen sections live under the single "Screens" rail parent (issue
  // #317), so a matching screen is visible via its child link id, not via
  // a parent label — non-screen parents still match by label, and demo
  // child ids can never equal an entry id (`${sectionId}-${slug}`).
  const shownEntries = useMemo(() => {
    if (!searching) return null;
    const labels = new Set(railGroups.map(([label]) => label));
    const childIds = new Set(railGroups.flatMap(([, links]) => links.map((l) => l.id)));
    return new Set(
      COMPONENT_ENTRIES.filter((e) => labels.has(e.label) || childIds.has(e.id)).map((e) => e.id),
    );
  }, [searching, railGroups]);

  // A new query reshapes the page — start the results from the top instead
  // of wherever the old scroll position now lands.
  useEffect(() => {
    document.querySelector(".app-main")?.scrollTo({ top: 0 });
  }, [query]);

  // Tokens tab view model — one hook instance feeds its main content, its
  // left-rail group nav and its right-rail inspector (lifted to App, passed
  // down as props; no context).
  const tokensView = useTokensView(active, pushToast);

  // Compare tab view model — same lifted-to-App.tsx shape as tokensView,
  // fed its own tab's rail/content/props (see Scope note in issue #1).
  const compareView = useCompareView(systems);
  // Slug-bound mutation callbacks — useCallback (not inline closures) so the
  // memo()'d token rows downstream keep stable onSave/onMerge identities
  // across unrelated App re-renders (e.g. filter keystrokes).
  const handleMerge = useCallback(
    (css: string) => {
      if (active) mergeCss(active.slug, css);
    },
    [active, mergeCss],
  );
  const handlePatch = useCallback(
    (name: string, value: string) => {
      if (active) patchToken(active.slug, name, value);
    },
    [active, patchToken],
  );
  const handleDelete = useCallback(
    (slug: string) => {
      removeSystem(slug);
      pushToast("System deleted", "ok");
    },
    [removeSystem, pushToast],
  );
  // System-menu actions (issue #313): whole-system operations that used to
  // live in the Tokens toolbar, now reachable from every tab through the
  // menu beside the switcher. Export reuses the Tokens tab's download calls.
  const handleRename = useCallback(
    (slug: string, name: string) => {
      renameSystem(slug, name);
    },
    [renameSystem],
  );
  const handleDuplicate = useCallback(
    (slug: string) => {
      duplicateSystem(slug);
      pushToast("Duplicated", "ok");
    },
    [duplicateSystem, pushToast],
  );
  const handleExportCss = useCallback(() => {
    if (active) download(`${active.slug}.css`, systemToCss(active), "text/css");
  }, [active]);
  const handleExportJson = useCallback(() => {
    if (active)
      download(`${active.slug}.json`, JSON.stringify(active, null, 2), "application/json");
  }, [active]);

  // A dropped/picked file merges into the active system, or seeds the
  // Add dialog when there is none yet (legacy drop behavior). CSS arrives as
  // text; our own JSON export arrives as raw JSON — without an active system
  // it opens the dialog unparsed so the dialog keeps its name, with one it
  // merges the exported CSS.
  const importCss = useCallback(
    (css: string) => {
      if (!active) {
        openAdd(css);
        return;
      }
      try {
        mergeCss(active.slug, css);
        pushToast("File imported", "ok");
      } catch (e) {
        pushToast(e instanceof Error ? e.message : String(e), "err");
      }
    },
    [active, mergeCss, openAdd, pushToast],
  );
  const importFile = useCallback(
    (file: File | null) => {
      if (!file) {
        pushToast("Only .css/.json files", "warn");
        return;
      }
      if (isJsonFile(file)) {
        file.text().then(
          (text) => {
            if (!active) {
              // Raw JSON: the dialog detects and parses it on open, keeping
              // the exported name for the collision flow.
              openAdd(text);
              return;
            }
            try {
              importCss(readSystemJson(text).css);
            } catch (e) {
              pushToast(e instanceof Error ? e.message : String(e), "warn");
            }
          },
          (e: unknown) => pushToast(e instanceof Error ? e.message : String(e), "warn"),
        );
        return;
      }
      readCssFile(file).then(importCss, (e: unknown) =>
        pushToast(e instanceof Error ? e.message : String(e), "warn"),
      );
    },
    [active, importCss, openAdd, pushToast],
  );
  const dragging = useCssFileDrop(importFile);

  // Previously applied token names — removed individually when they drop
  // out of the active system so stale props never accumulate on <html>.
  const appliedTokensRef = useRef<string[]>([]);
  useLayoutEffect(() => {
    const tokens = resolveSystemTokens(active);
    const style = document.documentElement.style;
    const names = new Set(tokens.map((t) => t.name));
    // Drop props from the previous system/variant that the new list no
    // longer defines; anything else on style (unrelated inline styles)
    // is left untouched — bulk cssText assignment would wipe it.
    for (const n of appliedTokensRef.current) if (!names.has(n)) style.removeProperty(n);
    for (const t of tokens) style.setProperty(t.name, t.value);
    appliedTokensRef.current = tokens.map((t) => t.name);
  }, [active]);

  useEffect(() => {
    document.title = active ? `${active.name} — ${APP_TITLE}` : APP_TITLE;
  }, [active]);

  // Selecting a component's token badge with the panel closed would look
  // like a dead click — selecting always reveals the panel (legacy).
  const inspector = useInspector();
  const inspectedId = inspector.selected?.id;
  useEffect(() => {
    if (inspectedId) revealProps();
  }, [inspectedId, revealProps]);
  const overrideCount = countOverrides(inspector);

  // Selecting a token in the Tokens tab must reach its inspector (issue #315):
  // on a phone the props panel is a closed overlay drawer, so the tap copied
  // the token and toasted but showed nothing — a dead click. Mirror the
  // Preview reveal above, but only in drawer mode: desktop revealProps() would
  // open the panel and persist `dsv.app.props`, which selecting a token must
  // not do. Selecting the *same* token again leaves `selected.name` unchanged
  // and so never re-runs this effect — it cannot toggle the drawer shut.
  const selectedTokenName = tokensView.selected?.name;
  useEffect(() => {
    if (narrowPanels && selectedTokenName) revealProps();
  }, [narrowPanels, selectedTokenName, revealProps]);

  // Dynamic Google Fonts, scoped per consumer (issue #40): the active system's
  // families serve Tokens/Preview, Compare owns its picked columns'. Each scope
  // diffs its own <link>s, so picking a Compare system can no longer
  // add/remove/rewrite the other tabs' font links, and a patchToken that leaves
  // families unchanged touches nothing (the hook diffs family sets first).
  useGoogleFonts(active?.css ?? "", "active");
  const compareCss = useMemo(
    () => compareView.cols.map((s) => s.css).join("\n"),
    [compareView.cols],
  );
  useGoogleFonts(compareCss, "compare");

  // Querystring half of the deep link (tab/system/compare picks) — one
  // replaceState writer, so switches never spam back/forward and never
  // reload. The section-hash half is owned by the active Rail; both halves
  // preserve each other, and copyLinkToView captures their union for free.
  // Compare params are scoped to the compare tab, like legacy's syncUrl;
  // q/f/tv are scoped the same way (Preview/Tokens/Tokens) inside the
  // writer, so the effect passes each tab's live state unconditionally.
  // Held until the first system load lands: writing earlier would drop a
  // deep-linked ?sys= before the store could read it.
  const { picked, mode, componentId } = compareView;
  const { filter: tokensFilter, schemaMode } = tokensView;
  useEffect(() => {
    if (loading) return;
    writeViewUrl({
      tab,
      sys: activeSlug || null,
      cmp: tab === "compare" ? picked : null,
      view: tab === "compare" && mode === "diff" ? mode : null,
      component:
        tab === "compare" && componentId !== DEFAULT_COMPONENT_ID ? componentId : null,
      q: query || null,
      f: tokensFilter || null,
      tv: schemaMode ? "schema" : null,
    });
  }, [loading, tab, activeSlug, picked, mode, componentId, query, tokensFilter, schemaMode]);

  // Hash half restore: client-rendered sections miss the browser's native
  // initial jump, so redo it once layout settles (double rAF, like legacy's
  // gallery) — after the systems load, since Tokens sections need one.
  // Unknown ids are a no-op — scrollspy then self-heals the hash.
  useEffect(() => {
    if (loading) return;
    const id = initialSectionHash();
    if (!id || !scrollToSection(id)) {
      setSectionSyncArmed(true);
      return;
    }
    let inner = 0;
    const raf = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        scrollToSection(id);
        setSectionSyncArmed(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(inner);
    };
  }, [loading]);

  const copyLink = useCallback(() => {
    // The copied URL embeds the active system (`s`), so a recipient without
    // the sender's localStorage still gets the tokens. Past the embed limit
    // the plain link is copied and the toast says where to share instead.
    copyLinkToView(active ? { name: active.name, css: active.css } : null).then(
      (result) => {
        if (result.tooLarge)
          pushToast(
            "This system is too large to embed in a link — use Export JSON to share it.",
            "warn",
          );
        else pushToast("Link copied", "ok");
      },
      () => pushToast("Copy failed", "err"),
    );
  }, [active, pushToast]);

  const emptyState = loading ? (
    <p className="app-placeholder app-loading">Loading systems…</p>
  ) : (
    <Welcome onPaste={() => openAdd()} onUpload={() => fileInputRef.current?.click()} />
  );

  // Each tab supplies its rail content (groups) and props content; Shell
  // renders the one rail frame and the one props frame around whichever
  // tab's content is active.
  // The shared-system banner rides above the active tab's content, inside
  // the one `.app-main` scroller (content, never a new scroll container or
  // chrome) — Shell has no banner slot and gains none: this is tab content
  // it renders. Exactly one node: only the active tab mounts it.
  const sharedBanner = sharedOffer ? (
    <SharedSystemBanner
      name={sharedOffer.name}
      tokenCount={sharedOffer.tokens.length}
      dropped={sharedOffer.dropped}
      onOpen={handleSharedOpen}
      onAdd={handleSharedAdd}
      onDismiss={handleSharedDismiss}
    />
  ) : null;
  const tabs: ShellTab[] = [
    {
      id: "tokens",
      label: "Tokens",
      content: (
        <>
          {tab === "tokens" && sharedBanner}
          {active ? (
            <TokensView
              system={active}
              view={tokensView}
              onMerge={handleMerge}
              onPatch={handlePatch}
            />
          ) : (
            emptyState
          )}
        </>
      ),
      rail: (
        <Rail
          groups={tokensView.railGroups}
          searching={tokensView.searching}
          syncSection={sectionSyncArmed && tab === "tokens"}
          active={tab === "tokens"}
        />
      ),
      propsPanel: active && <TokensProps view={tokensView} onPatch={handlePatch} />,
    },
    {
      id: "preview",
      label: "Preview",
      content: (
        <>
          {tab === "preview" && sharedBanner}
          {active ? (
            <>
              <PreviewNotes system={active} error={loadError} onRetry={retry} />
              {shownEntries?.size === 0 && <div className="dsv-err">No sections match “{query.trim()}”.</div>}
              {COMPONENT_ENTRIES.map((entry) => (
                <GallerySection key={entry.id} {...entry} hidden={shownEntries ? !shownEntries.has(entry.id) : false} />
              ))}
              <PreviewScopeDialog system={active} />
            </>
          ) : (
            <PreviewNotes
              system={null}
              loading={loading}
              error={loadError}
              onPaste={() => openAdd()}
              onUpload={() => fileInputRef.current?.click()}
              onRetry={retry}
            />
          )}
        </>
      ),
      // Preview rail shows only the section navigation (issue #317): the
      // system list lived above it and pushed every section below the fold,
      // duplicating the always-visible topbar SystemSwitcher.
      rail: (
        <Rail
          groups={railGroups}
          searching={searching}
          syncSection={sectionSyncArmed && tab === "preview"}
          active={tab === "preview"}
        />
      ),
      propsPanel: <PreviewProps system={active} active={tab === "preview" && propsOpen} />,
    },
    {
      id: "compare",
      label: "Compare",
      content: (
        <>
          {tab === "compare" && sharedBanner}
          <CompareView view={compareView} />
        </>
      ),
      rail: <CompareRail systems={systems} view={compareView} />,
      propsPanel: <CompareProps view={compareView} />,
    },
  ];

  return (
    <>
      <ErrorBoundary pushToast={pushToast}>
        <Shell
          brand={
            <>
              <IconToggleButton
                pressed={railOpen}
                onPressedChange={toggleRail}
                icon={<Icon name="panelLeft" size={15} />}
                labelWhenOn="Hide sidebar"
                labelWhenOff="Show sidebar"
              />
              <Brand />
            </>
          }
          systemSwitcher={
            <>
              <SystemSwitcher
                systems={systems}
                active={active}
                activeSlug={activeSlug}
                onSelect={handleSelectSystem}
              />
              {/* System actions stay beside the switcher (not in the phone's
                  "More actions" popover): they act on the active system, which
                  the switcher names, on every tab. */}
              <SystemMenu
                system={active}
                onRename={handleRename}
                onDuplicate={handleDuplicate}
                onExportCss={handleExportCss}
                onExportJson={handleExportJson}
                onDelete={handleDelete}
              />
            </>
          }
          actions={
            <>
              {tab === "preview" && overrideCount > 0 && (
                <button
                  type="button"
                  className="app-pill"
                  onClick={clearAll}
                  title="Reset every Preview token edit (values and swaps)"
                >
                  {overrideCount} edit{overrideCount === 1 ? "" : "s"}
                  <span className="app-pill-reset">Reset</span>
                </button>
              )}
              {tab === "preview" && <SectionSearch value={query} onChange={setQuery} />}
              <IconActionButton onClick={copyLink} icon={<Icon name="link" size={15} />} label="Copy link to this view" />
              <IconActionButton
                onClick={() => openAdd()}
                icon={<Icon name="plus" size={15} />}
                label="Add a design system"
              />
              <IconToggleButton
                pressed={propsOpen}
                onPressedChange={toggleProps}
                icon={<Icon name="panelRight" size={15} />}
                labelWhenOn="Hide properties panel"
                labelWhenOff="Show properties panel"
              />
            </>
          }
          tabs={tabs}
          railOpen={railOpen}
          propsOpen={propsOpen}
          tab={tab}
          onTabChange={setTab}
        />
      </ErrorBoundary>
      <AddSystemDialog
        open={addOpen}
        initialCss={addCss}
        onOpenChange={setAddOpen}
        onAdd={addSystem}
        onMerge={mergeCss}
        onReplace={replaceSystem}
        systems={systems}
        onToast={pushToast}
        onSaved={setTab}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".css,.json,text/css,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) importFile(file);
        }}
      />
      {dragging && <DropOverlay />}
      <Toasts toasts={toasts} />
    </>
  );
}

export default App;
