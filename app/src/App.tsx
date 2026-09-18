import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as Switch from "@radix-ui/react-switch";
import Shell, { type AppTab, type ShellTab } from "./shell/Shell.tsx";
import ErrorBoundary from "./shell/ErrorBoundary.tsx";
import Brand from "./shell/Brand.tsx";
import IconToggleButton from "./shell/IconToggleButton.tsx";
import IconActionButton from "./shell/IconActionButton.tsx";
import { SectionSearch } from "./shell/SectionSearch.tsx";
import { Toasts } from "./shell/Toasts.tsx";
import { DropOverlay, Welcome } from "./shell/Welcome.tsx";
import { copyLinkToView } from "./lib/copyLink.ts";
import { readCssFile, useCssFileDrop } from "./lib/cssImport.ts";
import { useGoogleFonts } from "./lib/googleFonts.ts";
import { Icon } from "./lib/icons.tsx";
import { useToasts } from "./lib/toasts.ts";
import { clearAllSwaps, useInspector } from "./lib/tokenOverrides.ts";
import { useSystems, resolveSystemTokens } from "./systems/store.ts";
import { usePanelOpen } from "./lib/panelStorage.ts";
import SystemSwitcher from "./systems/SystemSwitcher.tsx";
import { AddSystemDialog } from "./systems/AddSystemDialog.tsx";
import "./systems/AddSystemDialog.css";
import Rail from "./shell/Rail.tsx";
import Props from "./shell/Props.tsx";
import { COMPONENT_ENTRIES } from "./gallery/components/index.ts";
import { buildRailGroups } from "./gallery/registry.ts";
import { GallerySection } from "./gallery/ui.tsx";
import { TokensProps } from "./tokens/TokensProps.tsx";
import { TokensView } from "./tokens/TokensView.tsx";
import { useTokensView } from "./tokens/useTokensView.ts";
import { useGalleryOutline } from "./lib/galleryOutline.ts";
import { CompareView } from "./compare/CompareView.tsx";
import { CompareRail } from "./compare/CompareRail.tsx";
import { CompareProps } from "./compare/CompareProps.tsx";
import { useCompareView, DEFAULT_COMPONENT_ID } from "./compare/useCompareView.ts";
import { PreviewProps, PreviewScopeDialog } from "./preview/PreviewProps.tsx";
import { PreviewNotes } from "./preview/PreviewNotes.tsx";
import { initialSectionHash, readViewUrl, scrollToSection, writeViewUrl } from "./lib/urlState.ts";
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
    active,
    activeSlug,
    setActiveSlug,
    addSystem,
    mergeCss,
    patchToken,
    removeSystem,
  } = useSystems();
  const [toasts, pushToast] = useToasts();
  // Panel collapse lives here so the toggles can sit in the topbar —
  // no floating edge handle next to the main scrollbar. Same storage
  // keys as before, so persisted choices survive the move.
  const [railOpen, toggleRail] = usePanelOpen("dsv.app.rail");
  const [propsOpen, toggleProps, revealProps] = usePanelOpen("dsv.app.props");
  // Active tab lives here (not in Shell) so the URL sync below sees every
  // switch — Shell stays a controlled chrome shell. A deep-linked ?tab=
  // wins; otherwise this is "tokens", exactly as before.
  const [tab, setTab] = useState<AppTab>(() => readViewUrl().tab ?? "tokens");
  // Section-hash sync stays off until the initial deep-link restore lands,
  // so the first scrollspy scan can't clobber a #section before it scrolls.
  const [sectionSyncArmed, setSectionSyncArmed] = useState(false);
  const [query, setQuery] = useState("");
  // Dark variant is per-view, not persisted (legacy parity); it only exists
  // for systems that ship a `themes.dark` block. A deep-linked ?dark=1 seeds
  // it, so a copied link restores the variant it was showing.
  const [dark, setDark] = useState(() => readViewUrl().dark);
  const hasDark = !!active?.themes?.dark?.length;
  const darkOn = dark && hasDark;

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
  const shownEntries = useMemo(() => {
    if (!searching) return null;
    const labels = new Set(railGroups.map(([label]) => label));
    return new Set(COMPONENT_ENTRIES.filter((e) => labels.has(e.label)).map((e) => e.id));
  }, [searching, railGroups]);

  // A new query reshapes the page — start the results from the top instead
  // of wherever the old scroll position now lands.
  useEffect(() => {
    document.querySelector(".app-main")?.scrollTo({ top: 0 });
  }, [query]);

  // Tokens tab view model — one hook instance feeds its main content, its
  // left-rail group nav and its right-rail inspector (lifted to App, passed
  // down as props; no context).
  const tokensView = useTokensView(active, pushToast, darkOn);

  // Compare tab view model — same lifted-to-App.tsx shape as tokensView,
  // fed its own tab's rail/content/props (see Scope note in issue #1).
  const compareView = useCompareView(systems, darkOn);
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

  // A dropped/picked .css file merges into the active system, or seeds the
  // Add dialog when there is none yet (legacy drop behavior).
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
        pushToast("Only .css files", "warn");
        return;
      }
      readCssFile(file).then(importCss, (e: unknown) =>
        pushToast(e instanceof Error ? e.message : String(e), "warn"),
      );
    },
    [importCss, pushToast],
  );
  const dragging = useCssFileDrop(importFile);

  // Previously applied token names — removed individually when they drop
  // out of the active system so stale props never accumulate on <html>.
  const appliedTokensRef = useRef<string[]>([]);
  useLayoutEffect(() => {
    const tokens = resolveSystemTokens(active, darkOn);
    const style = document.documentElement.style;
    const names = new Set(tokens.map((t) => t.name));
    // Drop props from the previous system/variant that the new list no
    // longer defines; anything else on style (unrelated inline styles)
    // is left untouched — bulk cssText assignment would wipe it.
    for (const n of appliedTokensRef.current) if (!names.has(n)) style.removeProperty(n);
    for (const t of tokens) style.setProperty(t.name, t.value);
    appliedTokensRef.current = tokens.map((t) => t.name);
  }, [active, darkOn]);

  useEffect(() => {
    document.title = active ? `${active.name} — ${APP_TITLE}` : APP_TITLE;
  }, [active]);

  // Selecting a component's token badge with the panel closed would look
  // like a dead click — selecting always reveals the panel (legacy).
  const { selected: inspected, swaps } = useInspector();
  const inspectedId = inspected?.id;
  useEffect(() => {
    if (inspectedId) revealProps();
  }, [inspectedId, revealProps]);
  const swapCount = Object.values(swaps).reduce((n, m) => n + Object.keys(m).length, 0);

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
  // Compare params are scoped to the compare tab, like legacy's syncUrl.
  // Held until the first system load lands: writing earlier would drop a
  // deep-linked ?sys= before the store could read it.
  const { picked, mode, componentId } = compareView;
  useEffect(() => {
    if (loading) return;
    writeViewUrl({
      tab,
      sys: activeSlug || null,
      cmp: tab === "compare" ? picked : null,
      view: tab === "compare" && mode === "diff" ? mode : null,
      component:
        tab === "compare" && componentId !== DEFAULT_COMPONENT_ID ? componentId : null,
      dark: darkOn,
    });
  }, [loading, tab, activeSlug, picked, mode, componentId, darkOn]);

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
    copyLinkToView().then(
      () => pushToast("Link copied", "ok"),
      () => pushToast("Copy failed", "err"),
    );
  }, [pushToast]);

  const emptyState = loading ? (
    <p className="app-placeholder app-loading">Loading systems…</p>
  ) : (
    <Welcome onPaste={() => openAdd()} onUpload={() => fileInputRef.current?.click()} />
  );

  // Each tab supplies its rail content (groups) and props content; Shell
  // renders the one rail frame around whichever tab's content is active.
  const tabs: ShellTab[] = [
    {
      id: "tokens",
      label: "Tokens",
      content: active ? (
        <TokensView
          system={active}
          view={tokensView}
          onDelete={handleDelete}
          onMerge={handleMerge}
          onPatch={handlePatch}
        />
      ) : (
        emptyState
      ),
      rail: (
        <Rail
          groups={tokensView.railGroups}
          searching={tokensView.searching}
          syncSection={sectionSyncArmed && tab === "tokens"}
        />
      ),
      propsPanel: (
        <Props open={propsOpen}>{active && <TokensProps view={tokensView} />}</Props>
      ),
    },
    {
      id: "preview",
      label: "Preview",
      content: active ? (
        <>
          <PreviewNotes system={active} error={loadError} />
          {shownEntries?.size === 0 && <div className="dsv-err">No sections match “{query.trim()}”.</div>}
          {COMPONENT_ENTRIES.map((entry) => (
            <GallerySection key={entry.id} {...entry} hidden={shownEntries ? !shownEntries.has(entry.id) : false} />
          ))}
          <PreviewScopeDialog system={active} onPatch={handlePatch} dark={darkOn} />
        </>
      ) : (
        <PreviewNotes
          system={null}
          loading={loading}
          error={loadError}
          onPaste={() => openAdd()}
          onUpload={() => fileInputRef.current?.click()}
        />
      ),
      rail: (
        <Rail
          groups={railGroups}
          searching={searching}
          syncSection={sectionSyncArmed && tab === "preview"}
        />
      ),
      propsPanel: (
        <Props open={propsOpen}>
          <PreviewProps system={active} onPatch={handlePatch} dark={darkOn} />
        </Props>
      ),
    },
    {
      id: "compare",
      label: "Compare",
      content: <CompareView view={compareView} />,
      rail: <CompareRail systems={systems} view={compareView} />,
      propsPanel: (
        <Props open={propsOpen}>
          <CompareProps view={compareView} />
        </Props>
      ),
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
            <SystemSwitcher
              systems={systems}
              active={active}
              activeSlug={activeSlug}
              onSelect={setActiveSlug}
              onAddClick={() => openAdd()}
            />
          }
          actions={
            <>
              {tab === "preview" && swapCount > 0 && (
                <button
                  type="button"
                  className="app-pill"
                  onClick={clearAllSwaps}
                  title="Reset every scoped token swap"
                >
                  {swapCount} swap{swapCount === 1 ? "" : "s"}
                  <span className="app-pill-reset">Reset</span>
                </button>
              )}
              {hasDark && (
                <label className="app-dark" title="Toggle the system's dark variant">
                  <Switch.Root className="app-dark-switch" checked={dark} onCheckedChange={setDark}>
                    <Switch.Thumb className="app-dark-thumb" />
                  </Switch.Root>
                  Dark
                </label>
              )}
              {tab === "preview" && <SectionSearch value={query} onChange={setQuery} />}
              <IconActionButton onClick={copyLink} icon={<Icon name="link" size={15} />} label="Copy link to this view" />
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
          tab={tab}
          onTabChange={setTab}
        />
      </ErrorBoundary>
      <AddSystemDialog
        open={addOpen}
        initialCss={addCss}
        onOpenChange={setAddOpen}
        onAdd={addSystem}
        onToast={pushToast}
        onSaved={setTab}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".css,text/css"
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
