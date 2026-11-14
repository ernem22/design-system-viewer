import type { ReactNode } from "react";

export interface RailFrameProps {
  /** Whole-panel collapse state, owned by App (toggled from the topbar). */
  open: boolean;
  /** The active tab's rail content. The frame is rendered once by Shell, so
     tab switches swap this subtree instead of building a second rail. */
  children: ReactNode;
}

/** The one rail frame in the app: the clip, the scroller and the panel-collapse
   state live here, in `shell/`, and a tab only fills them with content. Keeping
   this element identity stable across a tab switch is what preserves the rail's
   scroll position (a per-tab frame rebuilt on every switch lost it). */
export default function RailFrame({ open, children }: RailFrameProps) {
  return (
    <div className="app-rail-clip" data-open={open}>
      <div className="app-rail-inner" inert={!open}>
        {children}
      </div>
    </div>
  );
}
