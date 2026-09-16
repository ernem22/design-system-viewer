import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import Shell, { type AppTab, type ShellTab } from "./shell/Shell.tsx";
import Brand from "./shell/Brand.tsx";
import IconToggleButton from "./shell/IconToggleButton.tsx";
import IconActionButton from "./shell/IconActionButton.tsx";
import { SectionSearch } from "./shell/SectionSearch.tsx";
import { copyLinkToView } from "./lib/copyLink.ts";
import { useGoogleFonts } from "./lib/googleFonts.ts";
import { Icon } from "./lib/icons.tsx";
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
import { initialSectionHash, readViewUrl, scrollToSection, writeViewUrl } from "./lib/urlState.ts";
import "./gallery/gallery.css";

// Stable across renders — buildRailGroups reads this by entry id, and
// useGalleryOutline's effect only needs to re-scan the DOM if this changes.
const ENTRY_IDS = COMPONENT_ENTRIES.map((e) => e.id);

function App() {
  const { systems, active, activeSlug, setActiveSlug, addSystem, mergeCss, patchToken, removeSystem } =
    useSystems();
  // Panel collapse lives here so the toggles can sit in the topbar —
  // no floating edge handle next to the main scrollbar. Same storage
  // keys as before, so persisted choices survive the move.
  const [railOpen, toggleRail] = usePanelOpen("dsv.app.rail");
  const [propsOpen, toggleProps] = usePanelOpen("dsv.app.props");
  // Active tab lives here (not in Shell) so the URL sync below sees every
  // switch — Shell stays a controlled chrome shell. A deep-linked ?tab=
  // wins; otherwise this is "tokens", exactly as before.
  const [tab, setTab] = useState<AppTab>(() => readViewUrl().tab ?? "tokens");
  // Section-hash sync stays off until the initial deep-link restore lands,
  // so the first scrollspy scan can't clobber a #section before it scrolls.
  const [sectionSyncArmed, setSectionSyncArmed] = useState(false);
  const [query, setQuery] = useState("");

  const searching = query.trim().length > 0;
  const outline = useGalleryOutline(ENTRY_IDS);
  const railGroups = useMemo(
    () => buildRailGroups(COMPONENT_ENTRIES, outline, query),
    [outline, query],
  );

  // Tokens tab view model — one hook instance feeds its main content, its
  // left-rail group nav and its right-rail inspector (lifted to App, passed
  // down as props; no context).
  const tokensView = useTokensView(active);

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

  useLayoutEffect(() => {
    const tokens = resolveSystemTokens(active);
    document.documentElement.style.cssText = tokens.map((t) => `${t.name}:${t.value};`).join("");
  }, [active]);

  // Dynamic Google Fonts for the active system plus every compared system
  // (keyed on raw css so token edits that change a family also swap fonts).
  // Every tab stays mounted (Shell forceMounts) and shares one document.head
  // link set, so an active-only call here would run after CompareView's own
  // useGoogleFonts and delete compare-only families — cover the union here.
  // Stale links from removed systems are removed inside loadGoogleFonts.
  const compareCss = useMemo(
    () => compareView.cols.map((s) => s.css).join("\n"),
    [compareView.cols],
  );
  const fontCss = useMemo(
    () => [active?.css ?? "", compareCss].filter(Boolean).join("\n"),
    [active, compareCss],
  );
  useGoogleFonts(fontCss);

  // Querystring half of the deep link (tab/system/compare picks) — one
  // replaceState writer, so switches never spam back/forward and never
  // reload. The section-hash half is owned by the active Rail; both halves
  // preserve each other, and copyLinkToView captures their union for free.
  // Compare params are scoped to the compare tab, like legacy's syncUrl.
  const { picked, mode, componentId } = compareView;
  useEffect(() => {
    writeViewUrl({
      tab,
      sys: activeSlug || null,
      cmp: tab === "compare" ? picked : null,
      view: tab === "compare" && mode === "diff" ? mode : null,
      component:
        tab === "compare" && componentId !== DEFAULT_COMPONENT_ID ? componentId : null,
    });
  }, [tab, activeSlug, picked, mode, componentId]);

  // Hash half restore: client-rendered sections miss the browser's native
  // initial jump, so redo it once layout settles (double rAF, like legacy's
  // gallery). Unknown ids are a no-op — scrollspy then self-heals the hash.
  useEffect(() => {
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
  }, []);

  // Each tab supplies its own rail/props content, not just its main content.
  const tabs: ShellTab[] = [
    {
      id: "tokens",
      label: "Tokens",
      content: active ? (
        <TokensView
          system={active}
          view={tokensView}
          onDelete={removeSystem}
          onMerge={handleMerge}
          onPatch={handlePatch}
        />
      ) : (
        <div className="app-placeholder">
          <p>No systems yet</p>
          <AddSystemDialog onAdd={addSystem} onToast={tokensView.pushToast} />
        </div>
      ),
      rail: (
        <Rail
          groups={tokensView.railGroups}
          searching={tokensView.searching}
          open={railOpen}
          syncSection={sectionSyncArmed && tab === "tokens"}
        />
      ),
      propsPanel: (
        <Props open={propsOpen}>
          <TokensProps view={tokensView} />
        </Props>
      ),
    },
    {
      id: "preview",
      label: "Preview",
      content: (
        <>
          {COMPONENT_ENTRIES.map((entry) => (
            <GallerySection key={entry.id} {...entry} />
          ))}
          <PreviewScopeDialog system={active} onPatch={handlePatch} />
        </>
      ),
      rail: (
        <Rail
          groups={railGroups}
          searching={searching}
          open={railOpen}
          syncSection={sectionSyncArmed && tab === "preview"}
        />
      ),
      propsPanel: (
        <Props open={propsOpen}>
          <PreviewProps system={active} onPatch={handlePatch} />
        </Props>
      ),
    },
    {
      id: "compare",
      label: "Compare",
      content: <CompareView view={compareView} />,
      rail: <CompareRail systems={systems} view={compareView} open={railOpen} />,
      propsPanel: (
        <Props open={propsOpen}>
          <CompareProps view={compareView} />
        </Props>
      ),
    },
  ];

  return (
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
          onAddSystem={addSystem}
          onToast={tokensView.pushToast}
        />
      }
      actions={
        <>
          <SectionSearch value={query} onChange={setQuery} />
          <IconActionButton
            onClick={copyLinkToView}
            icon={<Icon name="link" size={15} />}
            label="Copy link to this view"
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
      tab={tab}
      onTabChange={setTab}
    />
  );
}

export default App;
