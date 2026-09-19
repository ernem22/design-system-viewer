import { useState, type ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { readViewUrl, type UrlTab } from "../lib/urlState.ts";
import "./shell.css";

export type AppTab = UrlTab;

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
  /** Controlled tab state — App.tsx lifts this so its URL-sync effect sees
     every switch. Shell still owns layout; this is chrome state passed down
     as props, same shape as railOpen/propsOpen. Absent = uncontrolled. */
  tab?: AppTab;
  onTabChange?: (tab: AppTab) => void;
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
export default function Shell({
  brand,
  systemSwitcher,
  actions,
  tabs,
  tab: controlledTab,
  onTabChange,
}: ShellSlots) {
  // Uncontrolled fallback still honors a deep-linked ?tab= on mount (the
  // controlled path gets it from App instead — same reader either way).
  // Shell never writes the URL: App owns the single replaceState writer so
  // tab switches can't clobber the system/compare params mid-write.
  const [innerTab, setInnerTab] = useState<AppTab>(() => readViewUrl().tab ?? "tokens");
  const tab = controlledTab ?? innerTab;

  return (
    <Tabs.Root
      value={tab}
      onValueChange={(v) => {
        if (!isKnownTab(v, tabs)) return;
        if (controlledTab === undefined) setInnerTab(v);
        onTabChange?.(v);
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
