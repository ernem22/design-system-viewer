import { useState } from "react";
import type { CSSProperties } from "react";
import "./screens.css";

const ITEMS: [string, string, string, string, string][] = [
  ["Deploy succeeded", "v0.2.0 live · CI Bot", "2m", "success", "Deploys"],
  ["Member joined", "@turing joined the team", "1h", "info", "Members"],
  ["Quota warning", "Storage 85% full", "3h", "warning", "Billing"],
  ["Payment failed", "Card declined — update", "yesterday", "danger", "Billing"],
  ["API key created", "by @ada · read-only", "2d", "info", "Deploys"],
];

const FILTERS = ["All", "Deploys", "Members", "Billing"];

function nodeStyle(tone: string): CSSProperties | undefined {
  if (tone === "success") return undefined;
  if (tone === "danger")
    return { background: "var(--color-danger-subtle)", borderColor: "var(--color-danger)" };
  if (tone === "warning")
    return { background: "var(--color-warning-subtle)", borderColor: "var(--color-warning)" };
  return { background: "var(--color-info-subtle)", borderColor: "var(--color-info)" };
}

export default function ActivityBody() {
  const [f, setF] = useState("All");
  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="dsv-segmented" style={{ marginBottom: "var(--space-4)" }}>
        {FILTERS.map((x) => (
          <button key={x} aria-pressed={f === x} onClick={() => setF(x)}>
            {x}
          </button>
        ))}
      </div>
      <ul className="dsv-timeline">
        {(f === "All" ? ITEMS : ITEMS.filter((it) => it[4] === f)).map(([b, w, when, tone]) => (
          <li key={b}>
            <span className="node" style={nodeStyle(tone)} />
            <div>
              <div className="body">{b}</div>
              <div className="when">
                {w} · {when}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
        Filter: {f} ·{" "}
        <a className="dsv-link" href="#screen-activity">
          view all
        </a>
      </p>
    </div>
  );
}
