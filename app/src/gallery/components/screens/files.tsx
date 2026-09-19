import * as Progress from "@radix-ui/react-progress";
import { Button } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import "./screens.css";

const FILES: [string, string, string, number][] = [
  ["report.pdf", "2.4 MB", "Ada", 100],
  ["data.csv", "812 KB", "Grace", 100],
  ["video.mp4", "1.2 GB", "Alan", 46],
];

export default function FilesBody() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="dsv-inline" style={{ justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
        <div>
          <strong style={{ fontSize: "var(--font-size-sm)" }}>Storage</strong>
          <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
            6.1 of 10 GB used
          </div>
        </div>
        <Button size="sm">
          <Icon name="plus" size={14} /> Upload
        </Button>
      </div>
      <Progress.Root className="dsv-progress" value={61} style={{ width: "100%", marginBottom: "var(--space-5)" }}>
        <Progress.Indicator className="dsv-progress-indicator" style={{ width: "61%" }} />
      </Progress.Root>
      <div className="dsv-card" style={{ padding: 0, overflow: "hidden" }}>
        {FILES.map(([name, size, who, pct]) => (
          <div
            key={name}
            className="dsv-inline"
            style={{
              padding: "var(--space-3) var(--space-4)",
              borderBottom: "var(--border-width-thin) solid var(--color-border-subtle)",
              gap: "var(--space-3)",
            }}
          >
            <Icon name="file" size={16} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "var(--font-size-sm)",
                  fontWeight: "var(--font-weight-medium)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </div>
              <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
                {size} · {who} · {pct === 100 ? "done" : `${pct}%`}
              </div>
            </div>
            {pct === 100 ? (
              <span className="dsv-badge dsv-badge--success">Synced</span>
            ) : (
              <span className="dsv-spinner dsv-spinner--sm" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
