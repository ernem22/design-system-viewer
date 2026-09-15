import "./screens.css";

export default function ReportBody() {
  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        fontFamily: "var(--font-serif)",
        lineHeight: "var(--line-height-relaxed)",
      }}
    >
      <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", fontFamily: "var(--font-sans)" }}>
        Q2 · Design systems report
      </div>
      <h3
        className="dsv-display dsv-display--3xl"
        style={{ margin: "var(--space-3) 0", fontFamily: "var(--font-serif)" }}
      >
        Coverage is up, drift is down
      </h3>
      <p
        className="dsv-prose"
        style={{ fontFamily: "var(--font-serif)", fontSize: "var(--font-size-base)" }}
      >
        Token adoption rose from 61% to 84% this quarter. The preview now exercises every scale —
        color, type, spacing, radius, shadow and motion — so drift surfaces before it ships.
      </p>
      <blockquote className="dsv-quote">
        “One link per view changed how we review.”<cite>— design ops</cite>
      </blockquote>
      <p className="dsv-prose" style={{ fontFamily: "var(--font-serif)" }}>
        Next: dark-variant review and print styles for invoices.
      </p>
    </div>
  );
}
