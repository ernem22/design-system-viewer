import type { ReactNode } from "react";

export interface PropsFrameProps {
  /** Whole-panel collapse state, owned by App (toggled from the topbar). */
  open: boolean;
  /** The active tab's props content. The frame is rendered once by Shell, so
     tab switches swap this subtree instead of building a second props frame. */
  children: ReactNode;
}

/** The one props frame in the app: the clip, the scroller and the
   panel-collapse state live here, in `shell/`, and a tab only fills them with
   content. The rail's twin is RailFrame.tsx; keeping this element identity
   stable across a tab switch is what keeps a single `.app-props-inner` (a
   per-tab frame would duplicate it, one per force-mounted tab). */
export default function PropsFrame({ open, children }: PropsFrameProps) {
  return (
    <div className="app-props-clip" data-open={open}>
      <div className="app-props-inner" inert={!open}>
        {children}
      </div>
    </div>
  );
}
