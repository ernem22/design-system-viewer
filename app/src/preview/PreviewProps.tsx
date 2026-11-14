// Preview tab's right-rail inspector: thin adapter between App-owned system
// state and the gallery's inspector chrome. Value display reads the active
// system's stored tokens (falling back to the computed :root value for
// tokens the system doesn't define) layered under the inspector's ephemeral
// value overrides; value edits NEVER write to the system — they land in that
// same override store, and Reset (App topbar) drops them. The Tokens tab's
// inline editor remains the persistent write-through path.
import { useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { COMPONENT_ENTRIES } from "../gallery/components/index.ts";
import { ScopePanel } from "../gallery/tokenInspector.tsx";
import type { InViewSection } from "../gallery/tokenInspector.tsx";
import { useScrollSpy } from "../lib/scrollspy.ts";
import { tokensForEntry } from "../lib/tokenUsage.ts";
import { resolvedValue, setMobileOpen, useInspector } from "../lib/tokenOverrides.ts";
import { tokenValueMap } from "../tokens/useTokensView.ts";
import type { DesignSystem } from "../systems/store.ts";

// Values come from the same shared map the Tokens tab reads (css, then groups
// per token) so the two panels can never disagree about a token; only a token
// the system doesn't author at all falls through to the computed `:root`
// value. The ephemeral override sits above that whole chain (resolvedValue:
// valueEdit > authored), so a what-if edit shows here without touching the map.
function useValueOf(system: DesignSystem | null): (token: string) => string {
  const tokenValues = useMemo(() => tokenValueMap(system), [system]);
  const { valueEdits } = useInspector();
  // `valueEdits` is passed into resolvedValue rather than read from module
  // state inside it, so the memo re-creates (and the panels re-read) whenever
  // an override changes — the hook owns the subscription, the helper stays
  // pure.
  return useMemo(
    () => (name: string) => resolvedValue((n) => tokenValues.get(n) ?? "", name, valueEdits),
    [tokenValues, valueEdits],
  );
}

// Stable across renders — the same entry ids the Preview content renders as
// sections (see App.tsx's ENTRY_IDS). Scrollspy reads live geometry on its
// own rAF-throttled cadence, so the panel needs no scroll listener of its own.
const ENTRY_IDS = COMPONENT_ENTRIES.map((e) => e.id);

/** The Preview section currently in view, for the empty panel's "In view"
    offer (issue #318): the entry's label plus tokensForEntry(id) — the same
    id/title/tokens its GallerySection badge was built with, so inspecting it
    is identical to clicking that badge. Null while the panel isn't the open
    surface, or when no listed section exists in the DOM. */
function useInViewSection(enabled: boolean): InViewSection | null {
  const [activeId] = useScrollSpy(ENTRY_IDS, enabled);
  return useMemo(() => {
    if (!activeId) return null;
    const entry = COMPONENT_ENTRIES.find((e) => e.id === activeId);
    if (!entry) return null;
    return { id: entry.id, title: entry.label, tokens: tokensForEntry(entry.id) };
  }, [activeId]);
}

/** Docked props-panel content — replaces the "Select a component" placeholder. */
export function PreviewProps({
  system,
  active = true,
}: {
  system: DesignSystem | null;
  /** Whether the docked panel is the open surface — Preview tab active and the
      props panel expanded. App passes the live state so the panel's Escape
      handler is inert while another tab (or a collapsed panel) owns the
      keyboard; defaults on for direct mounts. */
  active?: boolean;
  /** Compatibility seam: App.tsx still passes `onPatch`, but Preview value
      edits are ephemeral now (#27) and never reach the store — the prop is
      accepted and ignored. Remove it from App.tsx with the deferred wiring,
      and drop this field with it. */
  onPatch?: (name: string, value: string) => void;
}) {
  const valueOf = useValueOf(system);
  const inView = useInViewSection(active);
  return <ScopePanel valueOf={valueOf} active={active} inView={inView} />;
}

/** Small-screen overlay for the same scope — desktop docks into the panel
    above instead (see openScope in lib/tokenOverrides.ts). Mounted once next
    to the Preview content; never in Compare. */
export function PreviewScopeDialog({
  system,
}: {
  system: DesignSystem | null;
  /** Accepted and ignored, same as PreviewProps. */
  onPatch?: (name: string, value: string) => void;
}) {
  const { mobileOpen, selected } = useInspector();
  const valueOf = useValueOf(system);
  if (!selected) return null;
  return (
    <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="dsv-drawer-overlay" />
        <Dialog.Content className="dsv-drawer" aria-label={`${selected.title} tokens`}>
          <ScopePanel valueOf={valueOf} inDialog />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
