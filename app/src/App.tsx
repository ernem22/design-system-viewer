import Shell, { type AppTab } from "./shell/Shell.tsx";

const TABS: { id: AppTab; label: string }[] = [
  { id: "tokens", label: "Tokens" },
  { id: "preview", label: "Preview" },
  { id: "compare", label: "Compare" },
];

function App() {
  return (
    <Shell
      brand={<span className="app-brand">Design System Viewer</span>}
      systemSwitcher={
        <button type="button" className="app-sysbtn" disabled title="System switcher (placeholder)">
          System…
        </button>
      }
      actions={
        <button type="button" className="app-iconbtn" disabled title="Actions (placeholder)">
          +
        </button>
      }
      tabs={TABS}
      rail={<p className="app-placeholder">Rail — section links go here</p>}
      views={{
        tokens: <p className="app-placeholder">Tokens gallery goes here</p>,
        preview: <p className="app-placeholder">Single-system preview goes here</p>,
        compare: <p className="app-placeholder">Compare columns go here</p>,
      }}
      propsPanel={<p className="app-placeholder">Props panel — nothing selected</p>}
    />
  );
}

export default App;
