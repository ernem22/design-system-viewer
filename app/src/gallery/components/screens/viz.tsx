import "./screens.css";

const BARS = [42, 68, 55, 88, 60, 96, 74, 80];

const CHANNELS = ["Organic", "Paid", "Referral", "Social", "Email", "Direct", "Partner", "Other"];

export default function VizBody() {
  return (
    <div className="dsv-stack">
      <div className="dsv-inline" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>Channel mix</h3>
        <span className="dsv-chart-tip">Q2 · all channels</span>
      </div>
      <div className="dsv-card">
        <div className="dsv-inline" style={{ alignItems: "flex-end", gap: "var(--space-2)", height: 150 }}>
          {BARS.map((h, i) => (
            <div
              key={i}
              title={`${h}%`}
              style={{
                flex: 1,
                height: `${h}%`,
                background: `var(--color-chart-${i + 1})`,
                borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
              }}
            />
          ))}
        </div>
        <div className="dsv-chart-grid" style={{ height: "var(--space-5)" }} />
        <div className="dsv-chart-axis" />
        <div className="dsv-inline" style={{ gap: "var(--space-3)", marginTop: "var(--space-3)", flexWrap: "wrap" }}>
          {CHANNELS.map((l, i) => (
            <span key={l} className="dsv-inline" style={{ fontSize: "var(--font-size-xs)" }}>
              <span
                style={{
                  width: "var(--space-2-5)",
                  height: "var(--space-2-5)",
                  borderRadius: "var(--radius-sm)",
                  background: `var(--color-chart-${i + 1})`,
                }}
              />
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
