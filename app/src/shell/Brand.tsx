/** App identity: icon + name, as one lockup — not assembled ad hoc at the
   call site, since the two never appear apart. `title` repeats the name
   for when `.app-brand-name`'s ellipsis truncation (shell.css) clips it —
   sighted users can still hover for the full string.
   Icon ported 1:1 from the legacy dsv-brand mark (preview/src/App.jsx). */

import HelpDialog from "./HelpDialog.tsx";

function BrandMark() {
  return (
    <svg className="app-brand-mark" width="18" height="18" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" rx="2.5" fill="var(--color-accent)" />
      <rect x="12" y="1" width="9" height="9" rx="2.5" fill="var(--color-accent)" opacity=".5" />
      <rect x="1" y="12" width="9" height="9" rx="2.5" fill="var(--color-accent)" opacity=".5" />
      <rect x="12" y="12" width="9" height="9" rx="2.5" fill="var(--color-accent)" opacity=".2" />
    </svg>
  );
}

export default function Brand() {
  return (
    <>
      {/* Issue #327: at ≤480px the wordmark hides (shell.css) and only the
         mark stays, so the lockup carries the name itself — role="img" lets
         the generic span expose the aria-label as its accessible name. */}
      <span className="app-brand" title="Design System Viewer" role="img" aria-label="Design System Viewer">
        <BrandMark />
        <span className="app-brand-name">Design System Viewer</span>
      </span>
      <HelpDialog />
    </>
  );
}
