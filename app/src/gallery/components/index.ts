import { lazy } from "react";
import type { ComponentType } from "react";
import type { GalleryEntry } from "../registry.ts";

type BodyLoader = () => Promise<{ default: ComponentType }>;

/** Section bodies are code-split (issue #328): the rail, search and Compare
 *  picker need only id/label/desc, so keeping the demo modules out of the
 *  entry chunk means the default Tokens tab never downloads demo code. */
function lazyBody(load: BodyLoader): ComponentType {
  return lazy(load);
}

/** One loader per section, keyed by entry id. Kept separately from the entry
 *  list so Preview can warm the remaining chunks on idle (preloadGalleryBodies)
 *  without importing them eagerly. */
export const BODY_LOADERS: Record<string, BodyLoader> = {
  forms: () => import("./forms.tsx"),
  form: () => import("./validation.tsx"),
  overlays: () => import("./overlays.tsx"),
  navigation: () => import("./navigation.tsx"),
  feedback: () => import("./feedback.tsx"),
  layout: () => import("./layout.tsx"),
  utilities: () => import("./utilities.tsx"),
  foundation: () => import("./foundation.tsx"),
  patterns: () => import("./patterns.tsx"),
  "data-display": () => import("./dataDisplay.tsx"),
  status: () => import("./status.tsx"),
  "nav-extras": () => import("./navExtras.tsx"),
  "screen-viz": () => import("./screens/viz.tsx"),
  "screen-files": () => import("./screens/files.tsx"),
  "screen-activity": () => import("./screens/activity.tsx"),
  "screen-404": () => import("./screens/notFound.tsx"),
  "screen-marketing": () => import("./screens/marketing.tsx"),
  "screen-onboarding": () => import("./screens/onboarding.tsx"),
  "screen-inbox": () => import("./screens/inbox.tsx"),
  "screen-schedule": () => import("./screens/schedule.tsx"),
  "screen-billing": () => import("./screens/billing.tsx"),
  "screen-search": () => import("./screens/search.tsx"),
  "screen-team": () => import("./screens/team.tsx"),
  "screen-report": () => import("./screens/report.tsx"),
  "screen-login": () => import("./screens/login.tsx"),
  "screen-signup": () => import("./screens/signup.tsx"),
  "screen-pricing": () => import("./screens/pricing.tsx"),
  "screen-settings": () => import("./screens/settings.tsx"),
  "screen-profile": () => import("./screens/profile.tsx"),
  "screen-dashboard": () => import("./screens/dashboard.tsx"),
  "screen-analytics": () => import("./screens/analytics.tsx"),
  "screen-table": () => import("./screens/table.tsx"),
  "screen-kanban": () => import("./screens/kanban.tsx"),
  "screen-chat": () => import("./screens/chat.tsx"),
  "screen-notifications": () => import("./screens/notifications.tsx"),
  "screen-checkout": () => import("./screens/checkout.tsx"),
  "screen-upload": () => import("./screens/upload.tsx"),
  "screen-empty": () => import("./screens/emptyState.tsx"),
  "screen-command": () => import("./screens/commandPalette.tsx"),
};

/** Requests every section body chunk. Called on idle once Preview is first
 *  opened so scrolling to a section that has not mounted yet never waits on
 *  the network. The dynamic import is module-cached, so warming a body that is
 *  already loading is a no-op. */
export function preloadGalleryBodies(): void {
  for (const load of Object.values(BODY_LOADERS)) void load();
}

export const COMPONENT_ENTRIES: GalleryEntry[] = [
  {
    id: "forms",
    label: "Forms",
    desc: "Inputs, selection and button primitives — all with the active system's tokens.",
    Body: lazyBody(BODY_LOADERS.forms),
  },
  {
    id: "form",
    label: "Form + validation",
    desc: "Radix Form (built-in validation + messages), Password Toggle Field, One-Time Password Field.",
    Body: lazyBody(BODY_LOADERS.form),
  },
  {
    id: "overlays",
    label: "Overlays",
    desc: "Dialog, menu, popover, tooltip — portal + scrim + focus from Radix, appearance from tokens.",
    Body: lazyBody(BODY_LOADERS.overlays),
  },
  {
    id: "navigation",
    label: "Navigation",
    desc: "Menubar, navigation menu, tabs, toolbar.",
    Body: lazyBody(BODY_LOADERS.navigation),
  },
  {
    id: "feedback",
    label: "Feedback",
    desc: "Progress, toast, badge, tooltip states.",
    Body: lazyBody(BODY_LOADERS.feedback),
  },
  {
    id: "layout",
    label: "Layout",
    desc: "Accordion, collapsible, separator, avatar, scroll-area, aspect-ratio.",
    Body: lazyBody(BODY_LOADERS.layout),
  },
  {
    id: "utilities",
    label: "Utilities",
    desc: "Invisible but important: Accessible Icon, Visually Hidden, Direction Provider.",
    Body: lazyBody(BODY_LOADERS.utilities),
  },
  {
    id: "foundation",
    label: "Foundation tokens",
    desc: "Gradient, glow, motion, rhythm, media and layout scales — driven by the expanded token schema.",
    Body: lazyBody(BODY_LOADERS.foundation),
  },
  {
    id: "patterns",
    label: "Product patterns",
    desc: "Non-Radix patterns every product needs — hand-built with tokens.",
    Body: lazyBody(BODY_LOADERS.patterns),
  },
  {
    id: "data-display",
    label: "Data display",
    desc: "Styled with tokens — not in Radix Primitives, built from theme variables.",
    Body: lazyBody(BODY_LOADERS["data-display"]),
  },
  {
    id: "status",
    label: "Status & loading",
    desc: "Callout, banner, empty state, skeleton, spinner.",
    Body: lazyBody(BODY_LOADERS.status),
  },
  {
    id: "nav-extras",
    label: "Navigation extras",
    desc: "Breadcrumb, pagination, steps, segmented control, button group.",
    Body: lazyBody(BODY_LOADERS["nav-extras"]),
  },
  {
    id: "screen-viz",
    label: "Data viz",
    desc: "Chart theme tokens + grid + axis + tooltip.",
    Body: lazyBody(BODY_LOADERS["screen-viz"]),
  },
  {
    id: "screen-files",
    label: "Files",
    desc: "Storage meter + file rows with sync states.",
    Body: lazyBody(BODY_LOADERS["screen-files"]),
  },
  {
    id: "screen-activity",
    label: "Activity log",
    desc: "Filter + tinted timeline with footer link.",
    Body: lazyBody(BODY_LOADERS["screen-activity"]),
  },
  {
    id: "screen-404",
    label: "404 / error",
    desc: "Display number, muted body, recovery actions.",
    Body: lazyBody(BODY_LOADERS["screen-404"]),
  },
  {
    id: "screen-marketing",
    label: "Marketing hero",
    desc: "Display type, 2xl image, feature grid, CTA.",
    Body: lazyBody(BODY_LOADERS["screen-marketing"]),
  },
  {
    id: "screen-onboarding",
    label: "Onboarding wizard",
    desc: "Steps + progress + back/next.",
    Body: lazyBody(BODY_LOADERS["screen-onboarding"]),
  },
  {
    id: "screen-inbox",
    label: "Inbox",
    desc: "List + reading pane, selected row, toolbar.",
    Body: lazyBody(BODY_LOADERS["screen-inbox"]),
  },
  {
    id: "screen-schedule",
    label: "Calendar / schedule",
    desc: "Sticky sub-nav + week grid with events.",
    Body: lazyBody(BODY_LOADERS["screen-schedule"]),
  },
  {
    id: "screen-billing",
    label: "Billing / invoice",
    desc: "Line-item table, totals, print actions.",
    Body: lazyBody(BODY_LOADERS["screen-billing"]),
  },
  {
    id: "screen-search",
    label: "Search results",
    desc: "Query bar, facets, results, pagination.",
    Body: lazyBody(BODY_LOADERS["screen-search"]),
  },
  {
    id: "screen-team",
    label: "Team management",
    desc: "Avatar group, role table, invite dialog.",
    Body: lazyBody(BODY_LOADERS["screen-team"]),
  },
  {
    id: "screen-report",
    label: "Report / print",
    desc: "Serif document layout, no chrome.",
    Body: lazyBody(BODY_LOADERS["screen-report"]),
  },
  {
    id: "screen-login",
    label: "Login",
    desc: "Form + checkbox + separator + button variants.",
    Body: lazyBody(BODY_LOADERS["screen-login"]),
  },
  {
    id: "screen-signup",
    label: "Signup",
    desc: "Step indicator + form + next/back.",
    Body: lazyBody(BODY_LOADERS["screen-signup"]),
  },
  {
    id: "screen-pricing",
    label: "Pricing",
    desc: "Monthly/yearly switch + plan cards + badge.",
    Body: lazyBody(BODY_LOADERS["screen-pricing"]),
  },
  {
    id: "screen-settings",
    label: "Settings",
    desc: "Tabs + switch + select + radio + slider.",
    Body: lazyBody(BODY_LOADERS["screen-settings"]),
  },
  {
    id: "screen-profile",
    label: "Profile",
    desc: "Avatar + data list + tag + timeline.",
    Body: lazyBody(BODY_LOADERS["screen-profile"]),
  },
  {
    id: "screen-dashboard",
    label: "Dashboard",
    desc: "Stat cards + progress + avatar + hover-card.",
    Body: lazyBody(BODY_LOADERS["screen-dashboard"]),
  },
  {
    id: "screen-analytics",
    label: "Analytics",
    desc: "Bar chart + segmented control + data list + table.",
    Body: lazyBody(BODY_LOADERS["screen-analytics"]),
  },
  {
    id: "screen-table",
    label: "Data table",
    desc: "Toolbar + search + dialog + row dropdown.",
    Body: lazyBody(BODY_LOADERS["screen-table"]),
  },
  {
    id: "screen-kanban",
    label: "Kanban",
    desc: "Columns + cards + tag + avatar.",
    Body: lazyBody(BODY_LOADERS["screen-kanban"]),
  },
  {
    id: "screen-chat",
    label: "Chat",
    desc: "Chat bubbles + input bar.",
    Body: lazyBody(BODY_LOADERS["screen-chat"]),
  },
  {
    id: "screen-notifications",
    label: "Notifications",
    desc: "Tinted icons + list + timestamp.",
    Body: lazyBody(BODY_LOADERS["screen-notifications"]),
  },
  {
    id: "screen-checkout",
    label: "Checkout",
    desc: "Payment form + order summary.",
    Body: lazyBody(BODY_LOADERS["screen-checkout"]),
  },
  {
    id: "screen-upload",
    label: "File upload",
    desc: "Drag-and-drop area + upload progress.",
    Body: lazyBody(BODY_LOADERS["screen-upload"]),
  },
  {
    id: "screen-empty",
    label: "Empty state",
    desc: "Breadcrumb + empty state + CTA.",
    Body: lazyBody(BODY_LOADERS["screen-empty"]),
  },
  {
    id: "screen-command",
    label: "Command palette",
    desc: "Search + grouped command list + kbd.",
    Body: lazyBody(BODY_LOADERS["screen-command"]),
  },
];
