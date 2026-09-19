import * as Separator from "@radix-ui/react-separator";
import { Button } from "../../ui.tsx";
import { Avat } from "./screenBits.tsx";
import "./screens.css";

const ACTIVITY: [string, string][] = [
  ["Invoice paid", "2 hours ago"],
  ["API key created", "yesterday"],
  ["Password changed", "3 days ago"],
];

export default function ProfileBody() {
  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <div className="dsv-card">
        <div className="dsv-inline" style={{ gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
          <Avat n={31} size="xl" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--font-size-lg)", fontWeight: "var(--font-weight-semibold)" }}>
              Ada Lovelace
            </div>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>
              @ada · Joined March 2024
            </div>
          </div>
          <Button variant="outline" size="sm">
            Edit
          </Button>
        </div>
        <dl className="dsv-datalist">
          <dt>Email</dt>
          <dd>ada@example.com</dd>
          <dt>Role</dt>
          <dd>
            <span className="dsv-badge">Admin</span>
          </dd>
          <dt>2FA</dt>
          <dd>
            <span className="dsv-badge dsv-badge--success">Enabled</span>
          </dd>
          <dt>Languages</dt>
          <dd className="dsv-inline">
            <span className="dsv-tag">TR</span>
            <span className="dsv-tag">EN</span>
            <span className="dsv-tag">FR</span>
          </dd>
        </dl>
        <Separator.Root className="dsv-sep" />
        <div
          style={{
            fontSize: "var(--font-size-sm)",
            fontWeight: "var(--font-weight-medium)",
            marginBottom: "var(--space-3)",
          }}
        >
          Recent activity
        </div>
        <ul className="dsv-timeline">
          {ACTIVITY.map(([b, w]) => (
            <li key={b}>
              <span className="node" />
              <div>
                <div className="body">{b}</div>
                <div className="when">{w}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
