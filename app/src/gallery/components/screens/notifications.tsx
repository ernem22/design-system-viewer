import { useState } from "react";
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
  const [unread, setUnread] = useState<boolean[]>(() => ITEMS.map((_, i) => i < 3));
  const unreadCount = unread.filter(Boolean).length;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="dsv-card" style={{ padding: 0, overflow: "clip" }}>
        <div
          className="dsv-inline"
          style={{
            justifyContent: "space-between",
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "var(--border-width-thin) solid var(--color-divider)",
          }}
        >
          <div className="dsv-inline" style={{ gap: "var(--space-2)" }}>
            <h3 style={{ margin: 0, fontSize: "var(--font-size-sm)" }}>Notifications</h3>
            {unreadCount > 0 && (
              <span className="dsv-badge dsv-badge--info">{unreadCount} unread</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={unreadCount === 0}
            onClick={() => setUnread((prev) => prev.map(() => false))}
          >
            Mark all as read
          </Button>
        </div>
        <div role="list" aria-label="Notifications">
          {ITEMS.map(([ic, tone, title, body, when], i) => (
            <div
              key={i}
              role="listitem"
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    fontSize: "var(--font-size-sm)",
                    fontWeight: unread[i] ? "var(--font-weight-semibold)" : "var(--font-weight-medium)",
                  }}
                >
                  {!unread[i] ? null : (
                    <span
                      aria-label="Unread"
                      role="img"
                      style={{
                        width: "var(--space-2)",
                        height: "var(--space-2)",
                        borderRadius: "var(--radius-full)",
                        background: "var(--color-accent)",
                        flex: "none",
                      }}
                    />
                  )}
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
    </div>
  );
}
