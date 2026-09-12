import { useState } from "react";
import "./shell.css";

export type AppTab = "tokens" | "preview" | "compare";

const TABS: { id: AppTab; label: string }[] = [
  { id: "tokens", label: "Tokens" },
  { id: "preview", label: "Preview" },
  { id: "compare", label: "Compare" },
];

export default function Shell() {
  const [tab, setTab] = useState<AppTab>("tokens");

  return (
    <div className="app-shell" data-tab={tab}>
      <header className="app-topbar">
        <div className="app-topbar-left">
          <span className="app-brand">Design System Viewer</span>
          <button type="button" className="app-sysbtn" disabled title="System switcher (placeholder)">
            System…
          </button>
        </div>
        <nav className="app-tabs" aria-label="Views">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "on" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="app-topbar-right">
          <button type="button" className="app-iconbtn" disabled title="Actions (placeholder)">
            +
          </button>
        </div>
      </header>

      <aside className="app-rail" aria-label="Sections">
        <p className="app-placeholder">Rail — section links go here</p>
      </aside>

      <main className="app-main">
        {tab === "tokens" && <p className="app-placeholder">Tokens gallery goes here</p>}
        {tab === "preview" && <p className="app-placeholder">Single-system preview goes here</p>}
        {tab === "compare" && <p className="app-placeholder">Compare columns go here</p>}
      </main>

      <aside className="app-props" aria-label="Properties">
        <p className="app-placeholder">Props panel — nothing selected</p>
      </aside>
    </div>
  );
}
