// Preview tab's right-rail inspector: thin adapter between App-owned system
// state and the gallery's inspector chrome. Value display reads the active
// system's stored tokens (falling back to the computed :root value for
// tokens the system doesn't define); value edits write through App's
// patchToken mutation — the same plumbing as the Tokens tab write flows —
// while per-demo swaps stay ephemeral in the inspector store.
import { useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ScopePanel } from "../gallery/tokenInspector.tsx";
import { baseValue, setMobileOpen, useInspector } from "../lib/tokenOverrides.ts";
import type { DesignSystem } from "../systems/store.ts";

function useValueOf(system: DesignSystem | null): (token: string) => string {
  const tokenValues = useMemo(
    () =>
      new Map(
        (system?.groups ?? []).flatMap((g) => g.tokens).map((t) => [t.name, t.value] as const),
      ),
    [system],
  );
  return (name: string) => tokenValues.get(name) ?? baseValue(name);
}

/** Docked props-panel content — replaces the "Select a component" placeholder. */
export function PreviewProps({
  system,
  onPatch,
}: {
  system: DesignSystem | null;
  onPatch: (name: string, value: string) => void;
}) {
  const valueOf = useValueOf(system);
  return <ScopePanel valueOf={valueOf} onPatch={onPatch} />;
}

/** Small-screen overlay for the same scope — desktop docks into the panel
    above instead (see openScope in lib/tokenOverrides.ts). Mounted once next
    to the Preview content; never in Compare. */
export function PreviewScopeDialog({
  system,
  onPatch,
}: {
  system: DesignSystem | null;
  onPatch: (name: string, value: string) => void;
}) {
  const { mobileOpen, selected } = useInspector();
  const valueOf = useValueOf(system);
  if (!selected) return null;
  return (
    <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="dsv-drawer-overlay" />
        <Dialog.Content className="dsv-drawer" aria-label={`${selected.title} tokens`}>
          <ScopePanel valueOf={valueOf} onPatch={onPatch} inDialog />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
