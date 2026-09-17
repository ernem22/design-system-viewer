import { useState } from "react";
import type { CSSProperties } from "react";
import { InCompareContext, PortalContainerContext } from "../gallery/ui.tsx";
import type { ComparableOption } from "./registry.tsx";

/** One column = one CSS-variable scope. Radix `*.Portal` content (selects,
   dialogs, popovers…) needs to land inside this DOM node — not
   document.body — to pick up this column's tokens instead of another
   column's or the page's :root. The ref only resolves after mount, so the
   Provider (and its container prop) waits for a real node; until then,
   portal content falls through to context's `undefined` default, i.e.
   Radix's own document.body. Ported from preview/src/compare.jsx's
   CompareColumn. */
export function CompareColumn({
  name,
  style,
  pct,
  option,
}: {
  name: string;
  style: CSSProperties;
  pct: number | null;
  option: ComparableOption;
}) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const { Render } = option;
  const body = (
    <InCompareContext.Provider value={true}>
      <div className="cmp-col-body">
        <Render />
      </div>
    </InCompareContext.Provider>
  );
  return (
    <section ref={setNode} className="cmp-col" style={style}>
      <h3 className="cmp-col-head">
        <span className="cmp-swatch" style={{ background: "var(--color-accent)" }} />
        {name}
        <span className="cmp-cov">{pct != null ? `${pct}%` : ""}</span>
      </h3>
      {node ? <PortalContainerContext.Provider value={node}>{body}</PortalContainerContext.Provider> : body}
    </section>
  );
}
