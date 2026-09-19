import { useState } from "react";
import { Icon } from "../../../lib/icons.tsx";
import "./screens.css";

const RESULTS: [string, string, string][] = [
  ["Token reference", "Schema of 192 tokens with coverage…", "#patterns"],
  ["Preview app", "Radix primitives styled by tokens…", "#screen-dashboard"],
  ["Compare mode", "Diff two systems side by side…", "#screen-table"],
];

export default function SearchBody() {
  const [page, setPage] = useState(2);
  const [facet, setFacet] = useState("All");
  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div className="dsv-input-wrap dsv-input-wrap--prefix" style={{ marginBottom: "var(--space-3)" }}>
        <span className="dsv-adorn dsv-adorn--prefix">
          <Icon name="search" size={14} />
        </span>
        <input className="dsv-input" defaultValue="design tokens" aria-label="Search" />
      </div>
      <div className="dsv-segmented" style={{ marginBottom: "var(--space-4)" }}>
        {["All", "Docs", "Components", "People"].map((f) => (
          <button key={f} aria-pressed={facet === f} onClick={() => setFacet(f)}>
            {f}
          </button>
        ))}
      </div>
      <div className="dsv-stack" style={{ gap: "var(--space-4)" }}>
        {RESULTS.map(([t, b, href]) => (
          <div key={t}>
            <a
              className="dsv-link"
              href={href}
              style={{ fontSize: "var(--font-size-base)", fontWeight: "var(--font-weight-medium)" }}
            >
              {t}
            </a>
            <p className="dsv-muted" style={{ fontSize: "var(--font-size-sm)", margin: "var(--space-1) 0 0" }}>
              {b}
            </p>
          </div>
        ))}
      </div>
      <div className="dsv-pagination" style={{ marginTop: "var(--space-5)" }}>
        {[1, 2, 3, 4].map((n) => (
          <button key={n} aria-current={n === page ? "page" : undefined} onClick={() => setPage(n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
