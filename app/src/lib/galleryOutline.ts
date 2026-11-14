import { useLayoutEffect, useState } from "react";
import type { RailLink } from "./railTypes.ts";

/** Demo blocks rendered inside each gallery section, keyed by section id.
   Read from the DOM right after mount (Demo sets its own id + data-demo-title)
   instead of a second, hand-kept list of every demo title living apart
   from the <Demo title="…"> calls that already declare them.
   useLayoutEffect, not useEffect: Rail renders from this same tick, so the
   real ids/labels must land before paint — otherwise Rail briefly shows
   every group with 0 children and then jumps to the real counts. */
export function useGalleryOutline(sectionIds: string[]): Record<string, RailLink[]> {
  const [outline, setOutline] = useState<Record<string, RailLink[]>>({});

  useLayoutEffect(() => {
    const next: Record<string, RailLink[]> = {};
    for (const id of sectionIds) {
      const section = document.getElementById(id);
      const blocks = section ? section.querySelectorAll<HTMLElement>("[data-demo-title]") : [];
      next[id] = [...blocks].map((el) => ({ id: el.id, label: el.dataset.demoTitle ?? "" }));
    }
    setOutline(next);
  }, [sectionIds]);

  return outline;
}
