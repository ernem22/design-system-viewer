import { useState } from "react";
import { Button, useCompareIdPrefix } from "../../ui.tsx";
import "./screens.css";

const MAILS: [string, string, string, string][] = [
  ["Ada Lovelace", "Token bridge is live", "Preview updates via postMessage…", "9:41"],
  ["CI Bot", "Build passed", "preview/dist ready in 41s…", "8:15"],
  ["Grace Hopper", "Review request", "Can you check the diff table?…", "Yesterday"],
  ["Figma", "3 new comments", "On the hero exploration…", "Mon"],
];

export default function InboxBody() {
  const id = useCompareIdPrefix();
  const [sel, setSel] = useState(1);
  // First two start unread so the triage state is visible on load.
  const [read, setRead] = useState<boolean[]>(() => MAILS.map((_, i) => i > 1));

  const markRead = (index: number) => {
    setRead((prev) => (prev[index] ? prev : prev.map((r, i) => (i === index ? true : r))));
  };

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
        <div
          id={`${id}inbox-list`}
          role="listbox"
          aria-label="Messages"
          aria-controls={`${id}inbox-pane`}
          style={{ display: "contents" }}
        >
          {MAILS.map(([from, subj, body, when], i) => (
            <div
              key={subj}
              role="option"
              aria-selected={sel === i}
              aria-label={`${read[i] ? "" : "Unread. "}${from}, ${subj}`}
              tabIndex={0}
              className={`dsv-list-item ${sel === i ? "is-selected" : ""}`}
              style={{ borderRadius: 0, padding: "var(--space-3)" }}
              onClick={() => {
                setSel(i);
                markRead(i);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSel(i);
                  markRead(i);
                }
              }}
            >
            <div style={{ minWidth: 0 }}>
              <div className="dsv-inline" style={{ justifyContent: "space-between" }}>
                <span className="dsv-inline" style={{ gap: "var(--space-2)" }}>
                  {!read[i] && (
                    <span
                      aria-hidden="true"
                      style={{
                        width: "var(--space-2)",
                        height: "var(--space-2)",
                        borderRadius: "var(--radius-full)",
                        background: "var(--color-accent)",
                        flex: "none",
                      }}
                    />
                  )}
                  <strong
                    style={{
                      fontSize: "var(--font-size-sm)",
                      fontWeight: read[i] ? "var(--font-weight-medium)" : "var(--font-weight-semibold)",
                    }}
                  >
                    {from}
                  </strong>
                </span>
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
      </div>
      <div
        id={`${id}inbox-pane`}
        aria-live="polite"
        style={{ padding: "var(--space-5)", background: "var(--color-bg)", minWidth: 0 }}
      >
        <div className="dsv-inline" style={{ marginBottom: "var(--space-3)" }}>
          <Button variant="ghost" size="sm">
            Archive
          </Button>
          <Button variant="ghost" size="sm">
            Snooze
          </Button>
          <Button variant="danger" size="sm">
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
