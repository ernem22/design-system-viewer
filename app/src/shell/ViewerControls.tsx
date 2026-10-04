import IconActionButton from "./IconActionButton.tsx";
import HelpDialog from "./HelpDialog.tsx";
import { Icon } from "../lib/icons.tsx";
import { useViewerTheme } from "../lib/viewerTheme.ts";
import "./viewerChrome.css";

/**
 * Global viewer controls: the light/dark *viewer* theme toggle (chrome only,
 * independent of the inspected system — not the topbar Dark switch, which
 * toggles the active system's `themes.dark` variant) and the help dialog.
 *
 * Rendered from the brand slot because App.tsx/Shell.tsx — where the topbar's
 * action cluster is composed — are held by other open PRs; the brand slot is
 * the one always-present topbar element a coder can extend without colliding.
 */
export default function ViewerControls() {
  const [theme, toggleTheme] = useViewerTheme();
  const next = theme === "light" ? "dark" : "light";
  return (
    <span className="viewer-controls">
      <IconActionButton
        className="viewer-theme-toggle"
        onClick={toggleTheme}
        icon={<Icon name={theme === "light" ? "moon" : "sun"} size={15} />}
        label={`Switch to ${next} theme`}
      />
      <HelpDialog />
    </span>
  );
}
