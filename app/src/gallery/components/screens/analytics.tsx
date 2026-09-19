import { useState } from "react";
import * as Separator from "@radix-ui/react-separator";
import "./screens.css";

const BARS = [40, 65, 52, 80, 72, 95, 60, 88, 74, 92, 68, 100];

const PAGES: [string, string, string][] = [
  ["/", "42.1k", "up"],
  ["/pricing", "18.7k", "up"],
  ["/docs", "12.3k", "down"],
  ["/blog", "9.8k", "up"],
];

export default function AnalyticsBody() {
  const [range, setRange] = useState("month");
  return (
    <div className="dsv-stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>Traffic</h3>
        <div className="dsv-segmented">
          {(
            [
              ["day", "Day"],
              ["week", "Week"],
              ["month", "Month"],
            ] as [string, string][]
          ).map(([v, l]) => (
            <button key={v} aria-pressed={range === v} onClick={() => setRange(v)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="dsv-card">
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "var(--space-1-5)",
            height: "var(--space-32)",
          }}
        >
          {BARS.map((h, i) => (
            <div
              key={i}
              title={`${h}%`}
              style={{
                flex: 1,
                height: `${h}%`,
                background:
                  i === BARS.length - 1 ? "var(--color-accent)" : "var(--color-accent-muted)",
                borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
              }}
            />
          ))}
        </div>
        <Separator.Root className="dsv-sep" />
        <div className="dsv-inline" style={{ gap: "var(--space-6)", alignItems: "center" }}>
          <svg width="140" height="48" viewBox="0 0 140 48" role="img" aria-label="trend">
            <path
              d="M0,36 L24,30 L48,33 L72,20 L96,24 L120,10 L140,14"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <svg width="56" height="56" viewBox="0 0 72 72" role="img" aria-label="share">
            <circle cx="36" cy="36" r="28" fill="none" stroke="var(--color-surface-sunken)" strokeWidth="10" />
            <circle
              cx="36"
              cy="36"
              r="28"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="10"
              strokeDasharray="110 176"
              strokeLinecap="round"
              transform="rotate(-90 36 36)"
            />
          </svg>
          <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
            line + donut share the bar palette
          </span>
        </div>
        <Separator.Root className="dsv-sep" />
        <dl className="dsv-datalist">
          <dt>Total visits</dt>
          <dd>128.402</dd>
          <dt>Unique visitors</dt>
          <dd>54.190</dd>
          <dt>Avg. duration</dt>
          <dd>2d 41s</dd>
          <dt>Bounce rate</dt>
          <dd>38%</dd>
        </dl>
      </div>
      <div className="dsv-table-wrap">
        <table className="dsv-table dsv-table--zebra">
          <thead>
            <tr>
              <th>Page</th>
              <th>Views</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {PAGES.map(([p, v, d]) => (
              <tr key={p}>
                <td className="dsv-mono">{p}</td>
                <td>{v}</td>
                <td>
                  <span className={`dsv-badge dsv-badge--${d === "up" ? "success" : "danger"}`}>
                    {d === "up" ? "▲ up" : "▼ down"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
