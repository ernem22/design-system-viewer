import { useLayoutEffect, useMemo, useState } from "react";
import Shell, { type ShellTab } from "./shell/Shell.tsx";
import Brand from "./shell/Brand.tsx";
import IconToggleButton from "./shell/IconToggleButton.tsx";
import IconActionButton from "./shell/IconActionButton.tsx";
import { SectionSearch } from "./shell/SectionSearch.tsx";
import { copyLinkToView } from "./lib/copyLink.ts";
import { Icon } from "./lib/icons.tsx";
import { useSystems, resolveSystemTokens } from "./systems/store.ts";
import { usePanelOpen } from "./lib/panelStorage.ts";
import SystemSwitcher from "./systems/SystemSwitcher.tsx";
import Rail from "./shell/Rail.tsx";
import Props from "./shell/Props.tsx";
import { COMPONENT_ENTRIES } from "./gallery/components/index.ts";
import { buildRailGroups } from "./gallery/registry.ts";
import { GallerySection } from "./gallery/ui.tsx";
import { TokensProps } from "./tokens/TokensProps.tsx";
import { TokensView } from "./tokens/TokensView.tsx";
import { useTokensView } from "./tokens/useTokensView.ts";
import { useGalleryOutline } from "./lib/galleryOutline.ts";
import "./gallery/gallery.css";

// Stable across renders — buildRailGroups reads this by entry id, and
// useGalleryOutline's effect only needs to re-scan the DOM if this changes.
const ENTRY_IDS = COMPONENT_ENTRIES.map((e) => e.id);

function App() {
  const { systems, active, activeSlug, setActiveSlug, removeSystem } = useSystems();
  // Panel collapse lives here so the toggles can sit in the topbar —
  // no floating edge handle next to the main scrollbar. Same storage
  // keys as before, so persisted choices survive the move.
  const [railOpen, toggleRail] = usePanelOpen("dsv.app.rail");
  const [propsOpen, toggleProps] = usePanelOpen("dsv.app.props");
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

  useLayoutEffect(() => {
    const tokens = resolveSystemTokens(active);
    document.documentElement.style.cssText = tokens.map((t) => `${t.name}:${t.value};`).join("");
  }, [active]);

  // Each tab supplies its own rail/props content, not just its main content.
  const tabs: ShellTab[] = [
    {
      id: "tokens",
      label: "Tokens",
      content: active ? (
        <TokensView system={active} view={tokensView} onDelete={removeSystem} />
      ) : (
        <p className="app-placeholder">No systems yet</p>
      ),
      rail: <Rail groups={tokensView.railGroups} searching={tokensView.searching} open={railOpen} />,
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
        </>
      ),
      rail: <Rail groups={railGroups} searching={searching} open={railOpen} />,
      propsPanel: (
        <Props open={propsOpen}>
          <p className="app-placeholder">Select a component to inspect it here.</p>
        </Props>
      ),
    },
    {
      id: "compare",
      label: "Compare",
      content: <p className="app-placeholder">Compare columns go here</p>,
      rail: <p className="app-placeholder">No sections yet</p>,
      propsPanel: <p className="app-placeholder">Nothing to inspect yet</p>,
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
        <SystemSwitcher systems={systems} active={active} activeSlug={activeSlug} onSelect={setActiveSlug} />
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
    />
  );
}

export default App;
