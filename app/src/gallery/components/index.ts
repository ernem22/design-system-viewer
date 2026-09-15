import type { GalleryEntry } from "../registry.ts";
import FormsBody from "./forms.tsx";
import ValidationBody from "./validation.tsx";
import OverlaysBody from "./overlays.tsx";
import NavigationBody from "./navigation.tsx";
import FeedbackBody from "./feedback.tsx";
import LayoutBody from "./layout.tsx";
import UtilitiesBody from "./utilities.tsx";

export const COMPONENT_ENTRIES: GalleryEntry[] = [
  {
    id: "forms",
    label: "Forms",
    desc: "Inputs, selection and button primitives — all with the active system's tokens.",
    Body: FormsBody,
  },
  {
    id: "form",
    label: "Form + validation",
    desc: "Radix Form (built-in validation + messages), Password Toggle Field, One-Time Password Field.",
    Body: ValidationBody,
  },
  {
    id: "overlays",
    label: "Overlays",
    desc: "Dialog, menu, popover, tooltip — portal + scrim + focus from Radix, appearance from tokens.",
    Body: OverlaysBody,
  },
  {
    id: "navigation",
    label: "Navigation",
    desc: "Menubar, navigation menu, tabs, toolbar.",
    Body: NavigationBody,
  },
  {
    id: "feedback",
    label: "Feedback",
    desc: "Progress, toast, badge, tooltip states.",
    Body: FeedbackBody,
  },
  {
    id: "layout",
    label: "Layout",
    desc: "Accordion, collapsible, separator, avatar, scroll-area, aspect-ratio.",
    Body: LayoutBody,
  },
  {
    id: "utilities",
    label: "Utilities",
    desc: "Invisible but important: Accessible Icon, Visually Hidden, Direction Provider.",
    Body: UtilitiesBody,
  },
];
