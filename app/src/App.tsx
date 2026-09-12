import { useState } from "react";
import Shell, { type AppTab } from "./shell/Shell.tsx";
import { useSystems } from "./systems/store.ts";
import {
  PreviewProvider,
  PreviewSystemSwitcher,
  PreviewActions,
  PreviewRail,
  PreviewMain,
  PreviewProps,
} from "./legacy/gallery.jsx";
import Compare from "./legacy/compare.jsx";

const TABS: { id: AppTab; label: string }[] = [
  { id: "tokens", label: "Tokens" },
  { id: "preview", label: "Preview" },
  { id: "compare", label: "Compare" },
];

function App() {
  const { systems, active, setActiveSlug } = useSystems();
  const [tab, setTab] = useState<AppTab>("preview");
  const isPreview = tab === "preview";

  return (
    <PreviewProvider system={active} systems={systems} onSelectSystem={setActiveSlug}>
      <Shell
        tab={tab}
        onTabChange={setTab}
        brand={<span className="app-brand">Design System Viewer</span>}
        systemSwitcher={<PreviewSystemSwitcher />}
        actions={isPreview ? <PreviewActions /> : undefined}
        tabs={TABS}
        rail={isPreview ? <PreviewRail /> : <p className="app-placeholder">No sections on this tab</p>}
        views={{
          tokens: <p className="app-placeholder">Tokens gallery goes here</p>,
          preview: <PreviewMain />,
          compare: <Compare systems={systems} />,
        }}
        propsPanel={isPreview ? <PreviewProps /> : <p className="app-placeholder">Props panel — nothing selected</p>}
      />
    </PreviewProvider>
  );
}

export default App;
