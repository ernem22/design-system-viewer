// Preview tab's right-rail inspector: thin adapter between App-owned system
// state and the gallery's inspector chrome. Value display reads the active
// system's stored tokens (falling back to the computed :root value for
// tokens the system doesn't define) layered under the inspector's ephemeral
// value overrides; value edits NEVER write to the system — they land in that
// same override store, and Reset (App topbar) drops them. The Tokens tab's
// inline editor remains the persistent write-through path.
import { useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ScopePanel } from "../gallery/tokenInspector.tsx";
import { resolvedValue, setMobileOpen, useInspector } from "../lib/tokenOverrides.ts";
import { tokenValueMap } from "../tokens/useTokensView.ts";
import type { DesignSystem } from "../systems/store.ts";

// Values come from the same shared map the Tokens tab reads (css, then groups
// per token, then the active dark theme) so the two panels can never disagree
// about a token; only a token the system doesn't author at all falls through to
// the computed `:root` value. The ephemeral override sits above that whole
// chain (resolvedValue: valueEdit > authored), so a what-if edit shows here
// without touching the map.
function useValueOf(system: DesignSystem | null, dark: boolean): (token: string) => string {
  const tokenValues = useMemo(() => tokenValueMap(system, dark), [system, dark]);
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

/** Docked props-panel content — replaces the "Select a component" placeholder. */
export function PreviewProps({
  system,
  dark = false,
}: {
  system: DesignSystem | null;
  dark?: boolean;
  /** Compatibility seam: App.tsx still passes `onPatch`, but Preview value
      edits are ephemeral now (#27) and never reach the store — the prop is
      accepted and ignored. Remove it from App.tsx with the deferred wiring,
      and drop this field with it. */
  onPatch?: (name: string, value: string) => void;
}) {
  const valueOf = useValueOf(system, dark);
  return <ScopePanel valueOf={valueOf} />;
}

/** Small-screen overlay for the same scope — desktop docks into the panel
    above instead (see openScope in lib/tokenOverrides.ts). Mounted once next
    to the Preview content; never in Compare. */
export function PreviewScopeDialog({
  system,
  dark = false,
}: {
  system: DesignSystem | null;
  dark?: boolean;
  /** Accepted and ignored, same as PreviewProps. */
  onPatch?: (name: string, value: string) => void;
}) {
  const { mobileOpen, selected } = useInspector();
  const valueOf = useValueOf(system, dark);
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
