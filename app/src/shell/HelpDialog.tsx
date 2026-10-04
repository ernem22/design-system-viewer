import * as Dialog from "@radix-ui/react-dialog";
import { Icon } from "../lib/icons.tsx";
import "./viewerChrome.css";

/**
 * How-to / help dialog (legacy `#kbdDlg`). Carries the critical caveat in
 * text — Preview reads only the canonical schema token names — which the new
 * app previously surfaced only conditionally, when a system already had
 * unmatched tokens (preview/PreviewNotes.tsx). Radix Dialog owns focus trap
 * and Escape-to-close, so it closes on Esc without a hand-rolled key handler.
 */
export default function HelpDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="app-iconbtn viewer-help-trigger" title="How to use" aria-label="How to use">
          <Icon name="help" size={15} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="tok-dialog-overlay viewer-help-overlay" />
        <Dialog.Content className="tok-dialog viewer-help-content" aria-describedby={undefined}>
          <Dialog.Title className="tok-dialog-title">How to use Design System Viewer</Dialog.Title>
          <Dialog.Description className="tok-dialog-desc">
            Your tokens → categorized gallery → live preview → compare → export. All local.
          </Dialog.Description>
          <ol className="viewer-help-steps">
            <li>
              <b>Add a system</b> — paste bare <code>--token: value;</code> lines (no <code>:root</code> needed), drop a
              .css file, or fetch from a URL. Last write wins.
            </li>
            <li>
              <b>Inspect</b> — the Tokens tab shows swatches, type specimens and WCAG contrast. Click to copy, or
              double-click to edit a token.
            </li>
            <li>
              <b>Preview</b> — real components render with your tokens via <code>var(--token)</code>.
            </li>
            <li>
              <b>Compare</b> — the same component side by side in 2–4 systems, or a token diff table.
            </li>
            <li>
              <b>Manage &amp; export</b> — add tokens, view the schema, export CSS/JSON, or delete the system from its
              Tokens toolbar.
            </li>
          </ol>
          <p className="viewer-help-rule">
            <b>Preview only reads canonical schema names.</b> Your token names must match the schema exactly
            (<code>--color-accent</code>, <code>--space-4</code>, …). The Tokens gallery groups any name by pattern, but
            a differently-named token shows fine there and does nothing in Preview.
          </p>
          <div className="tok-dialog-actions">
            <Dialog.Close className="tok-btn tok-btn-primary">Got it</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
