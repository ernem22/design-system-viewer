import type { ComponentType } from "react";

/** One gallery block: anchor id, rail label, and its component. */
export interface Section {
  id: string;
  label: string;
  Comp: ComponentType;
}
