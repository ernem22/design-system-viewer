import { Button } from "../../ui.tsx";
import "./screens.css";

const ROWS: [string, string, number][] = [
  ["Pro plan · yearly", "1", 144],
  ["Extra seats", "3", 108],
  ["Overage", "1", 12],
];

// Fixed-two-decimal invoice money ("144.00") and the "Jun 30" due stamp —
// real numbers/dates through Intl, keeping the shown shapes.
const intMoney = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dueStamp = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
  new Date(2026, 5, 30),
);

export default function BillingBody() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div
        className="dsv-screen-subnav dsv-inline"
        style={{ padding: "var(--space-2) var(--space-3)", marginBottom: "var(--space-4)", borderRadius: "var(--radius-md)" }}
      >
        <strong style={{ fontSize: "var(--font-size-sm)" }}>INV-2026-041</strong>
        <span className="dsv-badge dsv-badge--warning">Due {dueStamp}</span>
        <span style={{ flex: 1 }} />
        <Button size="sm" variant="ghost">
          Print
        </Button>
      </div>
      <div className="dsv-table-wrap">
        <table className="dsv-table">
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col">Qty</th>
              <th scope="col" style={{ textAlign: "right" }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([d, q, a]) => (
              <tr key={d}>
                <td>{d}</td>
                <td>{q}</td>
                <td style={{ textAlign: "right" }}>₺{intMoney.format(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="dsv-datalist" style={{ gridTemplateColumns: "1fr max-content", marginTop: "var(--space-4)" }}>
        <dt>Subtotal</dt>
        <dd>₺{intMoney.format(264)}</dd>
        <dt>VAT 20%</dt>
        <dd>₺{intMoney.format(52.8)}</dd>
        <dt>
          <strong>Total</strong>
        </dt>
        <dd>
          <strong>₺{intMoney.format(316.8)}</strong>
        </dd>
      </dl>
      <div className="dsv-inline" style={{ marginTop: "var(--space-5)" }}>
        <Button>Pay now</Button>
        <Button variant="outline">Download PDF</Button>
      </div>
    </div>
  );
}
