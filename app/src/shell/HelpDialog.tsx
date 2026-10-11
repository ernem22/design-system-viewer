import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { COMPONENT_ENTRIES } from "../gallery/components/index.ts";
import { Icon } from "../lib/icons.tsx";
import "./HelpDialog.css";

/** Legacy parity (issue #89), rewritten for the current app (issue #316).
    The theme-toggle half of the old card stays retired (dark mode is not a
    product feature). Rendered from the always-mounted brand slot because the
    topbar action cluster (App.tsx) and the dialog host (Shell.tsx) are held
    by other open PRs. */

interface Step {
  title: string;
  body: ReactNode;
}

// Section counts come from the gallery registry — the single source for rail
// nav + demos — so the guide cannot drift from the app again.
const SECTION_COUNT = COMPONENT_ENTRIES.length;
const SCREEN_COUNT = COMPONENT_ENTRIES.filter((e) =>
  e.id.startsWith("screen-"),
).length;

const STEPS: Step[] = [
  {
    title: "Add a system",
    body: (
      <>
        Paste <code>--token: value;</code> lines, upload a <code>.css</code> file,
        fetch from a URL, or <b>Fill with schema</b>. Nothing is written until you
        save.
      </>
    ),
  },
  {
    title: "Tokens",
    body: (
      <>
        Click a token to inspect and copy it; edit the value in the inspector.
        Switch <b>Gallery</b> and <b>Schema</b> views any time.
      </>
    ),
  },
  {
    title: "Preview",
    body: (
      <>
        All {SECTION_COUNT} sections ({SCREEN_COUNT} screens) render with{" "}
        <b>your tokens</b> via <code>var(--token)</code>. <b>Preview only reads the
        canonical schema names</b> (<code>--color-accent</code>,{" "}
        <code>--space-4</code>, …) — a differently-named token shows in the gallery
        but does nothing here.
      </>
    ),
  },
  {
    title: "Compare",
    body: (
      <>
        <b>Component</b> shows one component in up to 4 systems side by side.{" "}
        <b>Token diff</b> puts every category side by side, with an{" "}
        <b>only differences</b> toggle.
      </>
    ),
  },
  {
    title: "System menu & safekeeping",
    body: (
      <>
        The <b>System actions</b> menu renames, duplicates, exports, or deletes the
        current system. Systems live in this browser — export CSS or JSON to keep a
        copy.
      </>
    ),
  },
];

export default function HelpDialog({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <Dialog.Root defaultOpen={defaultOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="app-iconbtn app-help-trigger"
          title="How to use"
          aria-label="How to use"
        >
          <Icon name="help" size={15} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="app-help-overlay" />
        <Dialog.Content className="app-help-dialog" aria-modal="true">
          <div className="app-help-head">
            <Dialog.Title className="app-help-title">
              How to use Design System Viewer
            </Dialog.Title>
            <Dialog.Description className="app-help-sub">
              Your tokens → categorized gallery → live preview → compare → export. All local,
              no build needed.
            </Dialog.Description>
          </div>
          <div className="app-help-body">
            <ol className="app-help-steps">
              {STEPS.map((step, i) => (
                <li key={step.title} className="app-help-step">
                  <span className="app-help-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="app-help-step-body">
                    <p className="app-help-step-title">{step.title}</p>
                    <p className="app-help-step-text">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="app-help-actions">
            <Dialog.Close className="app-help-done">Got it</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
