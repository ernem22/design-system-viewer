import * as Progress from "@radix-ui/react-progress";
import { Icon } from "../../../lib/icons.tsx";
import { ScreenLink } from "./screenBits.tsx";
import "./screens.css";

const FILES: [string, string, number][] = [
  ["report.pdf", "2.4 MB", 100],
  ["data.csv", "812 KB", 100],
  ["presentation.key", "18 MB", 46],
];

export default function UploadBody() {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <div className="dsv-card">
        <div
          style={{
            border: "var(--border-width-thick) dashed var(--color-border-strong)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-8)",
            textAlign: "center",
            color: "var(--color-text-muted)",
          }}
        >
          <span
            className="glyph"
            style={{
              display: "inline-flex",
              width: "var(--space-12)",
              height: "var(--space-12)",
              borderRadius: "var(--radius-full)",
              background: "var(--color-surface-sunken)",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "var(--space-3)",
            }}
          >
            <Icon name="plus" size={20} />
          </span>
          <div style={{ fontSize: "var(--font-size-sm)" }}>
            Drag files here or <ScreenLink to="#screen-upload">browse</ScreenLink>
          </div>
        </div>
        <div className="dsv-stack" style={{ marginTop: "var(--space-4)", gap: "var(--space-3)" }}>
          {FILES.map(([name, size, pct]) => (
            <div key={name}>
              <div
                className="dsv-inline"
                style={{ justifyContent: "space-between", fontSize: "var(--font-size-sm)" }}
              >
                <span className="dsv-inline">
                  <Icon name="file" size={14} /> {name}
                </span>
                <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
                  {pct === 100 ? size : `${pct}%`}
                </span>
              </div>
              <Progress.Root
                className="dsv-progress"
                value={pct}
                style={{ width: "100%", marginTop: "var(--space-1)" }}
              >
                <Progress.Indicator
                  className="dsv-progress-indicator"
                  style={{
                    width: `${pct}%`,
                    background: pct === 100 ? "var(--color-success)" : "var(--color-accent)",
                  }}
                />
              </Progress.Root>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
