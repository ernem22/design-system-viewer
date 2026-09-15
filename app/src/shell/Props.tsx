import type { ReactNode } from "react";

/** Properties panel chrome. Collapse state is owned by the parent
   (toggled from the topbar) so no floating edge handle sits next to
   the main scrollbar. */
export default function Props({ children, open }: { children: ReactNode; open: boolean }) {
  return (
    <div className="app-props-clip" data-open={open}>
      <div className="app-props-inner" inert={!open}>
        {children}
      </div>
    </div>
  );
}
