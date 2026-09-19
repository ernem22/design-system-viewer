import { useState } from "react";
import { Button } from "../../ui.tsx";
import "./screens.css";

const MAILS: [string, string, string, string][] = [
  ["Ada Lovelace", "Token bridge is live", "Preview updates via postMessage…", "9:41"],
  ["CI Bot", "Build passed", "preview/dist ready in 41s…", "8:15"],
  ["Grace Hopper", "Review request", "Can you check the diff table?…", "Yesterday"],
  ["Figma", "3 new comments", "On the hero exploration…", "Mon"],
];

export default function InboxBody() {
  const [sel, setSel] = useState(1);
  return (
    <div className="dsv-inbox">
      <div
        style={{
          borderRight: "var(--border-width-thin) solid var(--color-divider)",
          background: "var(--color-surface)",
        }}
      >
        <div
          className="dsv-inline"
          style={{ padding: "var(--space-3)", borderBottom: "var(--border-width-thin) solid var(--color-divider)" }}
        >
          <input
            className="dsv-input"
            placeholder="Search mail…"
            aria-label="Search mail"
            style={{ flex: 1, minWidth: 0 }}
          />
        </div>
        {MAILS.map(([from, subj, body, when], i) => (
          <div
            key={subj}
            role="option"
            aria-selected={sel === i}
            tabIndex={0}
            className={`dsv-list-item ${sel === i ? "is-selected" : ""}`}
            style={{ borderRadius: 0, padding: "var(--space-3)" }}
            onClick={() => setSel(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSel(i);
              }
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="dsv-inline" style={{ justifyContent: "space-between" }}>
                <strong style={{ fontSize: "var(--font-size-sm)" }}>{from}</strong>
                <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
                  {when}
                </span>
              </div>
              <div style={{ fontSize: "var(--font-size-sm)" }}>{subj}</div>
              <div
                className="dsv-muted"
                style={{
                  fontSize: "var(--font-size-xs)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {body}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: "var(--space-5)", background: "var(--color-bg)", minWidth: 0 }}>
        <div className="dsv-inline" style={{ marginBottom: "var(--space-3)" }}>
          <Button variant="ghost" size="sm">
            Archive
          </Button>
          <Button variant="ghost" size="sm">
            Snooze
          </Button>
          <Button variant="ghost" size="sm">
            Delete
          </Button>
        </div>
        <h3 style={{ margin: "0 0 var(--space-1)", fontSize: "var(--font-size-lg)" }}>
          {MAILS[sel][1]}
        </h3>
        <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", marginBottom: "var(--space-4)" }}>
          {MAILS[sel][0]} · {MAILS[sel][3]}
        </div>
        <p className="dsv-prose" style={{ margin: 0 }}>
          Hi team — {MAILS[sel][2]} Full thread renders here with{" "}
          <a className="dsv-link" href="#screen-inbox">
            inline links
          </a>{" "}
          and attachments.
        </p>
      </div>
    </div>
  );
}
