import { useState } from "react";
import type { CSSProperties } from "react";
import { CompareIdPrefixContext, InCompareContext, PortalContainerContext } from "../gallery/ui.tsx";
import type { ComparableOption } from "./registry.tsx";

/** One column = one CSS-variable scope. Radix `*.Portal` content (selects,
   dialogs, popovers…) needs to land inside this DOM node — not
   document.body — to pick up this column's tokens instead of another
   column's or the page's :root. A ref only resolves after commit, so a
   portal opened during the first render would read the context's
   `undefined` default and mount to document.body; holding the Provider
   behind a ref-held node would also remount the whole subtree when it
   flips. Instead the container node is created eagerly — it exists from
   the very first render — and the ref below attaches it under the
   `<section>` during that same commit, before paint. So the Provider
   always has a real node, the first paint already resolves this column's
   scope, and no effect/re-render repairs it. Ported from
   preview/src/compare.jsx's CompareColumn. */
export function CompareColumn({
  slug,
  name,
  style,
  pct,
  option,
}: {
  slug: string;
  name: string;
  style: CSSProperties;
  pct: number | null;
  option: ComparableOption;
}) {
  const [portalHost] = useState(() => document.createElement("div"));
  const { Render } = option;
  const body = (
    <CompareIdPrefixContext.Provider value={`${slug}-`}>
      <InCompareContext.Provider value={true}>
        <div className="cmp-col-body">
          <Render />
        </div>
      </InCompareContext.Provider>
    </CompareIdPrefixContext.Provider>
  );
  return (
    <section className="cmp-col" style={style}>
      <h3 className="cmp-col-head">
        <span className="cmp-swatch" style={{ background: "var(--color-accent)" }} />
        {name}
        <span className="cmp-cov">{pct != null ? `${pct}%` : ""}</span>
      </h3>
      <PortalContainerContext.Provider value={portalHost}>{body}</PortalContainerContext.Provider>
      {/* Zero-box host: the portalled content still lays out as a direct
          child of the column (display:contents) while inheriting its token
          scope. Appended imperatively because portalHost is created outside
          React; the guard keeps StrictMode's ref re-runs idempotent. */}
      <div
        ref={(el) => {
          if (el && portalHost.parentNode !== el) el.appendChild(portalHost);
        }}
        style={{ display: "contents" }}
      />
    </section>
  );
}
