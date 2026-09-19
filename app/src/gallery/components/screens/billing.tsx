import { Button } from "../../ui.tsx";
import "./screens.css";

const ROWS: [string, string, string][] = [
  ["Pro plan · yearly", "1", "₺144.00"],
  ["Extra seats", "3", "₺108.00"],
  ["Overage", "1", "₺12.00"],
];

export default function BillingBody() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div
        className="dsv-screen-subnav dsv-inline"
        style={{ padding: "var(--space-2) var(--space-3)", marginBottom: "var(--space-4)", borderRadius: "var(--radius-md)" }}
      >
        <strong style={{ fontSize: "var(--font-size-sm)" }}>INV-2026-041</strong>
        <span className="dsv-badge dsv-badge--warning">Due Jun 30</span>
        <span style={{ flex: 1 }} />
        <Button size="sm" variant="ghost">
          Print
        </Button>
      </div>
      <div className="dsv-table-wrap">
        <table className="dsv-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([d, q, a]) => (
              <tr key={d}>
                <td>{d}</td>
                <td>{q}</td>
                <td style={{ textAlign: "right" }}>{a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="dsv-datalist" style={{ gridTemplateColumns: "1fr max-content", marginTop: "var(--space-4)" }}>
        <dt>Subtotal</dt>
        <dd>₺264.00</dd>
        <dt>VAT 20%</dt>
        <dd>₺52.80</dd>
        <dt>
          <strong>Total</strong>
        </dt>
        <dd>
          <strong>₺316.80</strong>
        </dd>
      </dl>
      <div className="dsv-inline" style={{ marginTop: "var(--space-5)" }}>
        <Button>Pay now</Button>
        <Button variant="outline">Download PDF</Button>
      </div>
    </div>
  );
}
