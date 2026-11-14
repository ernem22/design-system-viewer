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

type Range = "day" | "week" | "month";

// Each range changes the chart, totals and duration, so the segmented control
// is a real filter rather than a pressed-looking decoration.
const RANGES: Record<Range, {
  label: string;
  bars: number[];
  total: number;
  unique: number;
  avgDays: number;
  avgSeconds: number;
}> = {
  day: { label: "Day", bars: [30, 45, 38, 52, 60, 48, 70, 64, 58, 76, 68, 82], total: 4280, unique: 1810, avgDays: 0, avgSeconds: 41 },
  week: { label: "Week", bars: [38, 55, 47, 62, 70, 85, 66, 78, 72, 88, 74, 90], total: 31240, unique: 14210, avgDays: 1, avgSeconds: 12 },
  month: { label: "Month", bars: BARS, total: 128402, unique: 54190, avgDays: 2, avgSeconds: 41 },
};

// Grouped locale totals — tr-TR grouping keeps the shown "128.402"/"54.190"
// shapes while the values stay real numbers.
const intTotal = new Intl.NumberFormat("tr-TR");
const intPart = new Intl.NumberFormat("tr-TR", { useGrouping: false });

export default function AnalyticsBody() {
  const [range, setRange] = useState<Range>("month");
  const data = RANGES[range];
  const barLabel = `${data.label} traffic by period: ${data.bars.map((b) => `${b}%`).join(", ")}`;
  return (
    <div className="dsv-stack dsv-analytics">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>Traffic</h3>
        <div className="dsv-segmented">
          {(
            [
              ["day", "Day"],
              ["week", "Week"],
              ["month", "Month"],
            ] as [Range, string][]
          ).map(([v, l]) => (
            <button key={v} aria-pressed={range === v} onClick={() => setRange(v)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="dsv-card">
        <div
          role="img"
          aria-label={barLabel}
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "var(--space-1-5)",
            height: "var(--space-32)",
          }}
        >
          {data.bars.map((h, i) => (
            <div
              key={i}
              aria-hidden="true"
              title={`${h}%`}
              style={{
                flex: 1,
                height: `${h}%`,
                background:
                  i === data.bars.length - 1 ? "var(--color-accent)" : "var(--color-accent-muted)",
                borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
              }}
            />
          ))}
        </div>
        <Separator.Root className="dsv-sep" />
        <div className="dsv-inline" style={{ gap: "var(--space-6)", alignItems: "center" }}>
          <svg width="140" height="48" viewBox="0 0 140 48" aria-hidden="true">
            <path
              d="M0,36 L24,30 L48,33 L72,20 L96,24 L120,10 L140,14"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <svg width="56" height="56" viewBox="0 0 72 72" aria-hidden="true">
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
        </div>
        <Separator.Root className="dsv-sep" />
        <dl className="dsv-datalist">
          <dt>Total visits</dt>
          <dd>{intTotal.format(data.total)}</dd>
          <dt>Unique visitors</dt>
          <dd>{intTotal.format(data.unique)}</dd>
          <dt>Avg. duration</dt>
          <dd>
            {intPart.format(data.avgDays)}d {intPart.format(data.avgSeconds)}s
          </dd>
          <dt>Bounce rate</dt>
          <dd>38%</dd>
        </dl>
      </div>
      <div className="dsv-table-wrap">
        <table className="dsv-table dsv-table--zebra">
          <thead>
            <tr>
              <th scope="col">Page</th>
              <th scope="col" className="dsv-num">
                Views
              </th>
              <th scope="col" className="dsv-num">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {PAGES.map(([p, v, d]) => (
              <tr key={p}>
                <td className="dsv-mono">{p}</td>
                <td className="dsv-num">{v}</td>
                <td className="dsv-num">
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
