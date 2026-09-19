import * as Checkbox from "@radix-ui/react-checkbox";
import * as Separator from "@radix-ui/react-separator";
import { Button, Field } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import "./screens.css";

export default function CheckoutBody() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "var(--space-5)",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <div className="dsv-card" style={{ minWidth: 0 }}>
        <h3 style={{ margin: "0 0 var(--space-4)", fontSize: "var(--font-size-lg)" }}>Payment</h3>
        <div className="dsv-stack">
          <Field label="Name on card" id="c-name">
            <input id="c-name" className="dsv-input" defaultValue="Ada Lovelace" />
          </Field>
          <Field label="Card number" id="c-num">
            <input id="c-num" className="dsv-input" placeholder="•••• •••• •••• ••••" inputMode="numeric" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--space-3)" }}>
            <Field label="Expiry" id="c-exp">
              <input
                id="c-exp"
                className="dsv-input"
                placeholder="MM/YY"
                inputMode="numeric"
                autoComplete="cc-exp"
              />
            </Field>
            <Field label="CVC" id="c-cvc">
              <input
                id="c-cvc"
                className="dsv-input"
                placeholder="•••"
                inputMode="numeric"
                autoComplete="cc-csc"
              />
            </Field>
          </div>
          <label className="dsv-control-label">
            <Checkbox.Root className="dsv-check" defaultChecked>
              <Checkbox.Indicator>
                <Icon name="check" size={14} />
              </Checkbox.Indicator>
            </Checkbox.Root>
            Billing address same as shipping
          </label>
        </div>
      </div>
      <div>
        <div className="dsv-card">
          <div
            style={{
              fontSize: "var(--font-size-sm)",
              fontWeight: "var(--font-weight-medium)",
              marginBottom: "var(--space-3)",
            }}
          >
            Order summary
          </div>
          <dl className="dsv-datalist" style={{ gridTemplateColumns: "1fr max-content" }}>
            <dt>Pro (yearly)</dt>
            <dd>₺144</dd>
            <dt>Extra seats × 3</dt>
            <dd>₺108</dd>
            <dt>VAT 20%</dt>
            <dd>₺50.40</dd>
          </dl>
          <Separator.Root className="dsv-sep" />
          <div
            className="dsv-inline"
            style={{ justifyContent: "space-between", fontWeight: "var(--font-weight-semibold)" }}
          >
            <span>Total</span>
            <span>₺302.40</span>
          </div>
          <Button size="lg" style={{ width: "100%", marginTop: "var(--space-4)" }}>
            Pay
          </Button>
          <p
            className="dsv-muted"
            style={{ fontSize: "var(--font-size-xs)", textAlign: "center", marginTop: "var(--space-2)" }}
          >
            Secure with 256-bit SSL
          </p>
        </div>
      </div>
    </div>
  );
}
