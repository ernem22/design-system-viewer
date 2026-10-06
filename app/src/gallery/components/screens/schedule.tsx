import { Button } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import "./screens.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// Real month date through Intl — keeps the shown "June 2026" stamp.
const monthStamp = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
}).format(new Date(2026, 5, 1));

const EVENTS: Record<string, [string, string, string][]> = {
  Tue: [
    ["9:30", "Standup", "success"],
    ["14:00", "Design review", "info"],
  ],
  Wed: [["11:00", "1:1 Ada", "warning"]],
  Thu: [
    ["10:00", "Sprint planning", "info"],
    ["16:00", "Demo", "success"],
  ],
};

export default function ScheduleBody() {
  return (
    <div>
      <div
        className="dsv-screen-subnav dsv-inline"
        style={{ padding: "var(--space-2) var(--space-3)", marginBottom: "var(--space-4)", borderRadius: "var(--radius-md)" }}
      >
        <strong style={{ fontSize: "var(--font-size-sm)" }}>{monthStamp}</strong>
        <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
          Week 24
        </span>
        <span style={{ flex: 1 }} />
        <Button size="sm" variant="ghost">
          Today
        </Button>
        <Button size="sm">
          <Icon name="plus" size={14} /> Event
        </Button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        {DAYS.map((d) => (
          <div key={d} className="dsv-card" style={{ padding: "var(--space-3)", minWidth: 0 }}>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", marginBottom: "var(--space-2)" }}>
              {d}
            </div>
            {(EVENTS[d] || []).map(([t, label, tone]) => (
              <div key={label} className={`dsv-badge dsv-badge--${tone}`} style={{ display: "flex", marginBottom: "var(--space-1)" }}>
                {t} · {label}
              </div>
            ))}
            {!(EVENTS[d] || []).length && (
              <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
                —
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
