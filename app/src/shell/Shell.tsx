import type { ReactNode } from "react";
import "./shell.css";

export type AppTab = "tokens" | "preview" | "compare";

export interface ShellSlots {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  brand: ReactNode;
  systemSwitcher?: ReactNode;
  actions?: ReactNode;
  tabs: { id: AppTab; label: string }[];
  rail: ReactNode;
  views: Record<AppTab, ReactNode>;
  propsPanel: ReactNode;
}

/**
 * Layout + tab state only. All content arrives via slots —
 * Shell never owns gallery, preview, compare or panel content.
 */
export default function Shell({ tab, onTabChange, brand, systemSwitcher, actions, tabs, rail, views, propsPanel }: ShellSlots) {
  return (
    <div className="app-shell" data-tab={tab}>
      <header className="app-topbar">
        <div className="app-topbar-left">
          {brand}
          {systemSwitcher}
        </div>
        <nav className="app-tabs" aria-label="Views">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "on" : ""}
              onClick={() => onTabChange(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="app-topbar-right">{actions}</div>
      </header>

      <aside className="app-rail" aria-label="Sections">
        {rail}
      </aside>

      <main className="app-main">{views[tab]}</main>

      <aside className="app-props" aria-label="Properties">
        {propsPanel}
      </aside>
    </div>
  );
}
