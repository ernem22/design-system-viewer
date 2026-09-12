import { useLayoutEffect } from "react";
import Shell, { type AppTab } from "./shell/Shell.tsx";
import { useSystems, resolveSystemTokens } from "./systems/store.ts";
import SystemSwitcher from "./systems/SystemSwitcher.tsx";
import { TokenOverridesContext, useTokenOverridesProvider } from "./gallery/tokenOverrides.ts";
import { SelectedScopePanel } from "./gallery/ui.tsx";
import { loadGoogleFonts } from "./gallery/fonts.ts";
import { COMPONENT_SECTIONS } from "./gallery/components.tsx";
import { EXTRA_SECTIONS } from "./gallery/extras.tsx";
import { SCREEN_SECTIONS } from "./gallery/screens.tsx";
import type { Section } from "./gallery/section.ts";

const TABS: { id: AppTab; label: string }[] = [
  { id: "tokens", label: "Tokens" },
  { id: "preview", label: "Preview" },
  { id: "compare", label: "Compare" },
];

const GROUPS: [string, Section[]][] = [
  ["Components", COMPONENT_SECTIONS],
  ["Extras", EXTRA_SECTIONS],
  ["Screens", SCREEN_SECTIONS],
];

const ALL_SECTIONS = GROUPS.flatMap(([, sections]) => sections);

function App() {
  const { systems, active, activeSlug, setActiveSlug } = useSystems();
  const tokenOverrides = useTokenOverridesProvider();

  useLayoutEffect(() => {
    const tokens = resolveSystemTokens(active, false);
    document.documentElement.style.cssText = tokens.map((t) => `${t.name}:${t.value};`).join("");
  }, [active]);

  useLayoutEffect(() => {
    loadGoogleFonts(active?.css ?? "");
  }, [active]);

  return (
    <TokenOverridesContext.Provider value={tokenOverrides}>
      <Shell
        brand={<span className="app-brand">Design System Viewer</span>}
        systemSwitcher={
          <SystemSwitcher systems={systems} activeSlug={activeSlug} onSelect={setActiveSlug} />
        }
        actions={
          <button type="button" className="app-iconbtn" disabled title="Actions (placeholder)">
            +
          </button>
        }
        tabs={TABS}
        rail={
          <div className="app-rail-groups">
            {GROUPS.map(([label, sections]) => (
              <div key={label} className="app-rail-group">
                <span className="app-rail-group-label">
                  {label} <span className="app-rail-count">{sections.length}</span>
                </span>
                {sections.map((s) => (
                  <a key={s.id} href={`#${s.id}`} className="app-rail-link">
                    {s.label}
                  </a>
                ))}
              </div>
            ))}
          </div>
        }
        views={{
          tokens: <p className="app-placeholder">Tokens gallery goes here</p>,
          preview: (
            <>
              {ALL_SECTIONS.map(({ id, Comp }) => (
                <Comp key={id} />
              ))}
            </>
          ),
          compare: <p className="app-placeholder">Compare columns go here</p>,
        }}
        propsPanel={<SelectedScopePanel />}
      />
    </TokenOverridesContext.Provider>
  );
}

export default App;
