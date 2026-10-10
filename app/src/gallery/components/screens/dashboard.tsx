import * as HoverCard from "@radix-ui/react-hover-card";
import * as Progress from "@radix-ui/react-progress";
import * as Separator from "@radix-ui/react-separator";
import { Button, usePortalContainer } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import { Avat } from "./screenBits.tsx";
import "./screens.css";

// Grouped locale count — tr-TR grouping keeps the shown "1.284" shape.
const intCount = new Intl.NumberFormat("tr-TR");

const STATS: [string, string, string, string][] = [
  ["Revenue", "₺48.2k", "up", "▲ 12%"],
  ["Users", intCount.format(1284), "up", "▲ 4%"],
  ["Error rate", "0.4%", "down", "▼ 0.1%"],
  ["Uptime", "99.98%", "up", "▲ 0.02%"],
];

export default function DashboardBody() {
  const portalContainer = usePortalContainer();
  return (
    <div className="dsv-stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>Overview</h3>
          <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
            Last 30 days
          </div>
        </div>
        <div className="dsv-inline">
          <span className="dsv-badge dsv-badge--success">
            <Icon name="check" size={12} /> Live
          </span>
          <Button size="sm" variant="outline">
            <Icon name="plus" size={14} /> New
          </Button>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        {STATS.map(([k, v, dir, d]) => (
          <div key={k} className="dsv-stat">
            <div className="k">{k}</div>
            <div className="v">{v}</div>
            <div className={`d ${dir}`}>{d}</div>
          </div>
        ))}
      </div>
      <div className="dsv-card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
          <strong style={{ fontSize: "var(--font-size-sm)" }}>Monthly goal</strong>
          <span className="dsv-mono dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
            66 / 100
          </span>
        </div>
        <Progress.Root
          className="dsv-progress"
          value={66}
          aria-label="Monthly goal progress"
          style={{ width: "100%" }}
        >
          <Progress.Indicator className="dsv-progress-indicator" style={{ width: "66%" }} />
        </Progress.Root>
        <Separator.Root className="dsv-sep" />
        <div className="dsv-inline" style={{ justifyContent: "space-between", fontSize: "var(--font-size-xs)" }}>
          <span className="dsv-muted">Deploy succeeded · 2m ago</span>
          <span className="dsv-badge dsv-badge--success">Live</span>
        </div>
        <div className="dsv-inline" style={{ justifyContent: "space-between", fontSize: "var(--font-size-xs)" }}>
          <span className="dsv-muted">Quota warning · 3h ago</span>
          <span className="dsv-badge dsv-badge--warning">Pending</span>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
          {["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson"].map((name) => (
            <HoverCard.Root key={name} openDelay={120}>
              <HoverCard.Trigger asChild>
                <button
                  type="button"
                  aria-label={`Contributor ${name} details`}
                  style={{
                    display: "inline-flex",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  <Avat name={name} />
                </button>
              </HoverCard.Trigger>
              <HoverCard.Portal container={portalContainer}>
                <HoverCard.Content className="dsv-pop" sideOffset={6}>
                  <div className="dsv-hovercard">
                    <div>
                      <div className="name">{name}</div>
                      <div className="bio">24 commits, 3 PR reviews this month.</div>
                    </div>
                  </div>
                </HoverCard.Content>
              </HoverCard.Portal>
            </HoverCard.Root>
          ))}
        </div>
      </div>
    </div>
  );
}
