import { Button } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import type { IconName } from "../../../lib/icons.tsx";
import "./screens.css";

const ITEMS: [IconName, string, string, string, string][] = [
  ["check", "success", "Deploy succeeded", "v0.2.0 live", "2m"],
  ["user", "info", "New member", "@turing joined the team", "1h"],
  ["bell", "warning", "Quota warning", "Storage 85% full", "3h"],
  ["x", "danger", "Payment failed", "Card declined — update", "yesterday"],
];

export default function NotificationsBody() {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="dsv-card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          className="dsv-inline"
          style={{
            justifyContent: "space-between",
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "var(--border-width-thin) solid var(--color-divider)",
          }}
        >
          <strong style={{ fontSize: "var(--font-size-sm)" }}>Notifications</strong>
          <Button variant="ghost" size="sm">
            Mark all as read
          </Button>
        </div>
        {ITEMS.map(([ic, tone, title, body, when], i) => (
          <div
            key={i}
            className="dsv-inline"
            style={{
              alignItems: "flex-start",
              gap: "var(--space-3)",
              padding: "var(--space-3) var(--space-4)",
              borderBottom:
                i < ITEMS.length - 1
                  ? "var(--border-width-thin) solid var(--color-border-subtle)"
                  : "none",
            }}
          >
            <span
              className={`dsv-badge dsv-badge--${tone}`}
              style={{ borderRadius: "var(--radius-full)", padding: "var(--space-1)" }}
            >
              <Icon name={ic} size={12} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)" }}>
                {title}
              </div>
              <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
                {body}
              </div>
            </div>
            <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
              {when}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
