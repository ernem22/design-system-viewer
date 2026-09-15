import { useState, type ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import "./shell.css";

export type AppTab = "tokens" | "preview" | "compare";

/** One tab's trigger label plus everything that swaps with it when it
   becomes active — main content, and optionally its own Rail/Props content.
   A single list a caller builds once, instead of separate id/label/content/
   rail/propsPanel records that must be kept in sync by convention alone. */
export interface ShellTab {
  id: AppTab;
  label: string;
  content: ReactNode;
  rail?: ReactNode;
  propsPanel?: ReactNode;
}

export interface ShellSlots {
  brand: ReactNode;
  systemSwitcher?: ReactNode;
  actions?: ReactNode;
  tabs: ShellTab[];
}

/** Narrows Radix's raw `string` callback value to `AppTab` by checking it
   against the actual tab ids in play, instead of asserting it with `as`. */
function isKnownTab(value: string, tabs: ShellTab[]): value is AppTab {
  return tabs.some((t) => t.id === value);
}

/**
 * Layout + tab state only. All content arrives via slots —
 * Shell never owns gallery, preview, compare or panel content.
 *
 * The Rail/Props <aside> chrome (open/close toggle, width, animation) is
 * the same across every tab — only what's inside swaps with the active
 * tab. Each tab's rail/props content is forceMount'ed, same as `main`'s,
 * so switching tabs hides it (via the [data-state="inactive"] rule in
 * shell.css) instead of unmounting it — Rail keeps its scroll position and
 * open/collapsed groups when you tab away and back.
 */
export default function Shell({ brand, systemSwitcher, actions, tabs }: ShellSlots) {
  const [tab, setTab] = useState<AppTab>("tokens");

  return (
    <Tabs.Root
      value={tab}
      onValueChange={(v) => {
        if (isKnownTab(v, tabs)) setTab(v);
      }}
      asChild
    >
      <div className="app-shell" data-tab={tab}>
        <header className="app-topbar">
          <div className="app-topbar-left">
            {brand}
            {systemSwitcher}
          </div>
          <Tabs.List className="app-tabs" aria-label="Views">
            {tabs.map(({ id, label }) => (
              <Tabs.Trigger key={id} value={id}>
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <div className="app-topbar-right">{actions}</div>
        </header>

        <aside id="app-rail" className="app-rail" aria-label="Sections">
          {tabs.map(({ id, rail }) =>
            rail ? (
              <Tabs.Content key={id} value={id} forceMount>
                {rail}
              </Tabs.Content>
            ) : null,
          )}
        </aside>

        <main className="app-main">
          {tabs.map(({ id, content }) => (
            <Tabs.Content key={id} value={id} forceMount>
              {content}
            </Tabs.Content>
          ))}
        </main>

        <aside id="app-props" className="app-props" aria-label="Properties">
          {tabs.map(({ id, propsPanel }) =>
            propsPanel ? (
              <Tabs.Content key={id} value={id} forceMount>
                {propsPanel}
              </Tabs.Content>
            ) : null,
          )}
        </aside>
      </div>
    </Tabs.Root>
  );
}
