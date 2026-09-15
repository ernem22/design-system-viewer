import type { GalleryEntry } from "../registry.ts";
import FormsBody from "./forms.tsx";
import ValidationBody from "./validation.tsx";
import OverlaysBody from "./overlays.tsx";
import NavigationBody from "./navigation.tsx";
import FeedbackBody from "./feedback.tsx";
import LayoutBody from "./layout.tsx";
import UtilitiesBody from "./utilities.tsx";
import FoundationBody from "./foundation.tsx";
import PatternsBody from "./patterns.tsx";
import DataDisplayBody from "./dataDisplay.tsx";
import StatusBody from "./status.tsx";
import NavExtrasBody from "./navExtras.tsx";
import VizBody from "./screens/viz.tsx";
import FilesBody from "./screens/files.tsx";
import ActivityBody from "./screens/activity.tsx";
import NotFoundBody from "./screens/notFound.tsx";
import MarketingBody from "./screens/marketing.tsx";
import OnboardingBody from "./screens/onboarding.tsx";
import InboxBody from "./screens/inbox.tsx";
import ScheduleBody from "./screens/schedule.tsx";
import BillingBody from "./screens/billing.tsx";
import SearchBody from "./screens/search.tsx";
import TeamBody from "./screens/team.tsx";
import ReportBody from "./screens/report.tsx";
import LoginBody from "./screens/login.tsx";
import SignupBody from "./screens/signup.tsx";
import PricingBody from "./screens/pricing.tsx";
import SettingsBody from "./screens/settings.tsx";
import ProfileBody from "./screens/profile.tsx";
import DashboardBody from "./screens/dashboard.tsx";
import AnalyticsBody from "./screens/analytics.tsx";
import TableBody from "./screens/table.tsx";
import KanbanBody from "./screens/kanban.tsx";
import ChatBody from "./screens/chat.tsx";
import NotificationsBody from "./screens/notifications.tsx";
import CheckoutBody from "./screens/checkout.tsx";
import UploadBody from "./screens/upload.tsx";
import EmptyStateBody from "./screens/emptyState.tsx";
import CommandPaletteBody from "./screens/commandPalette.tsx";

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
  {
    id: "foundation",
    label: "Foundation tokens",
    desc: "Gradient, glow, motion, rhythm, media and layout scales — driven by the expanded token schema.",
    Body: FoundationBody,
  },
  {
    id: "patterns",
    label: "Product patterns",
    desc: "Non-Radix patterns every product needs — hand-built with tokens.",
    Body: PatternsBody,
  },
  {
    id: "data-display",
    label: "Data display",
    desc: "Styled with tokens — not in Radix Primitives, built from theme variables.",
    Body: DataDisplayBody,
  },
  {
    id: "status",
    label: "Status & loading",
    desc: "Callout, banner, empty state, skeleton, spinner.",
    Body: StatusBody,
  },
  {
    id: "nav-extras",
    label: "Navigation extras",
    desc: "Breadcrumb, pagination, steps, segmented control, button group.",
    Body: NavExtrasBody,
  },
  {
    id: "screen-viz",
    label: "Data viz",
    desc: "Chart theme tokens + grid + axis + tooltip.",
    Body: VizBody,
  },
  {
    id: "screen-files",
    label: "Files",
    desc: "Storage meter + file rows with sync states.",
    Body: FilesBody,
  },
  {
    id: "screen-activity",
    label: "Activity log",
    desc: "Filter + tinted timeline with footer link.",
    Body: ActivityBody,
  },
  {
    id: "screen-404",
    label: "404 / error",
    desc: "Display number, muted body, recovery actions.",
    Body: NotFoundBody,
  },
  {
    id: "screen-marketing",
    label: "Marketing hero",
    desc: "Display type, 2xl image, feature grid, CTA.",
    Body: MarketingBody,
  },
  {
    id: "screen-onboarding",
    label: "Onboarding wizard",
    desc: "Steps + progress + back/next.",
    Body: OnboardingBody,
  },
  {
    id: "screen-inbox",
    label: "Inbox",
    desc: "List + reading pane, selected row, toolbar.",
    Body: InboxBody,
  },
  {
    id: "screen-schedule",
    label: "Calendar / schedule",
    desc: "Sticky sub-nav + week grid with events.",
    Body: ScheduleBody,
  },
  {
    id: "screen-billing",
    label: "Billing / invoice",
    desc: "Line-item table, totals, print actions.",
    Body: BillingBody,
  },
  {
    id: "screen-search",
    label: "Search results",
    desc: "Query bar, facets, results, pagination.",
    Body: SearchBody,
  },
  {
    id: "screen-team",
    label: "Team management",
    desc: "Avatar group, role table, invite dialog.",
    Body: TeamBody,
  },
  {
    id: "screen-report",
    label: "Report / print",
    desc: "Serif document layout, no chrome.",
    Body: ReportBody,
  },
  {
    id: "screen-login",
    label: "Login",
    desc: "Form + checkbox + separator + button variants.",
    Body: LoginBody,
  },
  {
    id: "screen-signup",
    label: "Signup",
    desc: "Step indicator + form + next/back.",
    Body: SignupBody,
  },
  {
    id: "screen-pricing",
    label: "Pricing",
    desc: "Monthly/yearly switch + plan cards + badge.",
    Body: PricingBody,
  },
  {
    id: "screen-settings",
    label: "Settings",
    desc: "Tabs + switch + select + radio + slider.",
    Body: SettingsBody,
  },
  {
    id: "screen-profile",
    label: "Profile",
    desc: "Avatar + data list + tag + timeline.",
    Body: ProfileBody,
  },
  {
    id: "screen-dashboard",
    label: "Dashboard",
    desc: "Stat cards + progress + avatar + hover-card.",
    Body: DashboardBody,
  },
  {
    id: "screen-analytics",
    label: "Analytics",
    desc: "Bar chart + segmented control + data list + table.",
    Body: AnalyticsBody,
  },
  {
    id: "screen-table",
    label: "Data table",
    desc: "Toolbar + search + dialog + row dropdown.",
    Body: TableBody,
  },
  {
    id: "screen-kanban",
    label: "Kanban",
    desc: "Columns + cards + tag + avatar.",
    Body: KanbanBody,
  },
  {
    id: "screen-chat",
    label: "Chat",
    desc: "Chat bubbles + input bar.",
    Body: ChatBody,
  },
  {
    id: "screen-notifications",
    label: "Notifications",
    desc: "Tinted icons + list + timestamp.",
    Body: NotificationsBody,
  },
  {
    id: "screen-checkout",
    label: "Checkout",
    desc: "Payment form + order summary.",
    Body: CheckoutBody,
  },
  {
    id: "screen-upload",
    label: "File upload",
    desc: "Drag-and-drop area + upload progress.",
    Body: UploadBody,
  },
  {
    id: "screen-empty",
    label: "Empty state",
    desc: "Breadcrumb + empty state + CTA.",
    Body: EmptyStateBody,
  },
  {
    id: "screen-command",
    label: "Command palette",
    desc: "Search + grouped command list + kbd.",
    Body: CommandPaletteBody,
  },
];
