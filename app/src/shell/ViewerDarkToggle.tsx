import * as Switch from "@radix-ui/react-switch";
import { useViewerDark } from "../lib/viewerDark.ts";

/** Always-present topbar control: switches the viewer chrome light/dark
 *  (issue #115). Unlike the per-system Dark variant switch, it is never gated
 *  on `active.themes.dark` — every system in the catalogue gets a reachable
 *  dark control, and systems that ship no dark theme still repaint the chrome.
 *  It renders from the brand slot, which the shell always mounts, so it does
 *  not depend on the active tab or system either. */
export default function ViewerDarkToggle() {
  const [dark, setDark] = useViewerDark();
  return (
    <label className="app-viewer-dark" title="Toggle the viewer's dark chrome">
      <Switch.Root
        className="app-viewer-dark-switch"
        checked={dark}
        onCheckedChange={setDark}
        aria-label="Viewer dark mode"
      >
        <Switch.Thumb className="app-viewer-dark-thumb" />
      </Switch.Root>
      Dark
    </label>
  );
}
