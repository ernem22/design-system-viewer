import { useState } from "react";
import * as Switch from "@radix-ui/react-switch";
import { Button } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import "./screens.css";

// [name, yearly price, monthly price, features] — matches preview's
// `yearly ? 12 : 15` inline pricing.
const PLANS: [string, number, number, string[]][] = [
  ["Starter", 0, 0, ["1 project", "Community support", "1 GB storage"]],
  ["Pro", 12, 15, ["Unlimited projects", "Priority support", "50 GB storage", "Analytics"]],
  ["Team", 32, 39, ["Everything in Pro", "SSO", "Role management", "Audit log"]],
];
export default function PricingBody() {
  const [yearly, setYearly] = useState(true);
  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
        <h3 style={{ margin: "0 0 var(--space-3)", fontSize: "var(--font-size-2xl)" }}>
          Simple pricing
        </h3>
        <label className="dsv-control-label" style={{ justifyContent: "center" }}>
          Monthly
          <Switch.Root className="dsv-switch" checked={yearly} onCheckedChange={setYearly}>
            <Switch.Thumb className="dsv-switch-thumb" />
          </Switch.Root>
          Yearly <span className="dsv-badge dsv-badge--success">2 months free</span>
        </label>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        {PLANS.map(([name, yearlyPrice, monthlyPrice, feats], i) => (
          <div
            key={name}
            className={`dsv-card ${i === 1 ? "dsv-card--raised" : ""}`}
            style={i === 1 ? { borderColor: "var(--color-accent-border)" } : undefined}
          >
            {i === 1 && (
              <span className="dsv-badge" style={{ marginBottom: "var(--space-2)" }}>
                Most popular
              </span>
            )}
            <div style={{ fontWeight: "var(--font-weight-semibold)" }}>{name}</div>
            <div style={{ margin: "var(--space-2) 0" }}>
              <span style={{ fontSize: "var(--font-size-3xl)", fontWeight: "var(--font-weight-bold)" }}>
                ₺{yearly ? yearlyPrice : monthlyPrice}
              </span>
              <span className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>
                /mo
              </span>
            </div>
            <Button variant={i === 1 ? "solid" : "outline"} style={{ width: "100%", marginBottom: "var(--space-3)" }}>
              Choose
            </Button>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              {feats.map((f) => (
                <li key={f} className="dsv-inline">
                  <Icon name="check" size={14} /> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
