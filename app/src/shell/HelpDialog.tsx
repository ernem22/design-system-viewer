import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Icon } from "../lib/icons.tsx";
import "./HelpDialog.css";

/** Legacy parity (issue #89): the old viewer's "How to use" button and its
    `#kbdDlg` guide were dropped in the React migration. The theme-toggle half
    of that card is retired (dark mode is not a product feature), so only the
    guide is restored. It carries the one rule that is otherwise almost
    undiscoverable: Preview reads canonical schema names only. Rendered from
    the always-mounted brand slot because the topbar action cluster (App.tsx)
    and the dialog host (Shell.tsx) are held by other open PRs. */

interface Step {
  title: string;
  hint?: string;
  body: ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Add a system",
    hint: "Add system",
    body: (
      <>
        Paste bare <code>--token: value;</code> lines (no <code>:root</code> needed), drag
        &amp; drop a <code>.css</code> file, or fetch from a URL. Use <b>Fill template</b>{" "}
        for the full-token skeleton. Last write wins.
      </>
    ),
  },
  {
    title: "Inspect — Tokens tab",
    body: (
      <>
        Swatches (color), type specimens, bars, cards. <b>Filter</b>, <b>Show missing</b>,{" "}
        <b>Schema</b> &amp; <b>Contrast</b> (WCAG). Click to copy; <b>Update</b> or
        double-click to edit a token.
      </>
    ),
  },
  {
    title: "Preview — real components",
    body: (
      <>
        ~35 Radix primitives and 15 screens render with <b>your tokens</b> via{" "}
        <code>var(--token)</code>. <b>Preview only reads the canonical schema names</b> (
        <code>--color-accent</code>, <code>--space-4</code>, …) — a differently-named token
        shows in the gallery but does nothing here.
      </>
    ),
  },
  {
    title: "Compare — side-by-side or diff",
    body: (
      <>
        <b>Component</b>: the same component in 2–4 systems, each column isolated.{" "}
        <b>Token diff</b>: a table grouped by category with an <b>only differences</b>{" "}
        toggle.
      </>
    ),
  },
  {
    title: "Manage & export — in the toolbar",
    body: (
      <>
        For the system you are looking at, add tokens, open the schema view, export CSS or
        JSON, or delete it — all from the toolbar above the gallery.
      </>
    ),
  },
];

export default function HelpDialog() {
  return (
    <Dialog.Root>
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
          <Dialog.Title className="app-help-title">
            How to use Design System Viewer
          </Dialog.Title>
          <Dialog.Description className="app-help-sub">
            Your tokens → categorized gallery → live preview → compare → export. All local,
            no build needed.
          </Dialog.Description>
          <ol className="app-help-steps">
            {STEPS.map((step, i) => (
              <li key={step.title} className="app-help-step">
                <span className="app-help-num" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="app-help-step-body">
                  <p className="app-help-step-title">
                    {step.title}
                    {step.hint && <span className="app-help-hint"> — {step.hint}</span>}
                  </p>
                  <p className="app-help-step-text">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="app-help-tips">
            <p className="app-help-tips-title">Tips</p>
            <p className="app-help-tips-text">
              Value warnings (unitless, bad hex, unknown colour, undefined var) never block
              save. The coverage bar shows <b>present / expected</b> against the schema
              reference. All data lives in <code>systems/*.json</code> on disk — reload after
              restart.
            </p>
          </div>
          <div className="app-help-actions">
            <Dialog.Close className="app-help-done">Got it</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
