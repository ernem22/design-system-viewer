import { useEffect, useState } from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as Separator from "@radix-ui/react-separator";
import { Button, Field, useCompareIdPrefix } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import "./screens.css";

export default function CheckoutBody() {
  const id = useCompareIdPrefix();
  const [processing, setProcessing] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!processing) return;
    const timer = window.setTimeout(() => setProcessing(false), 1400);
    return () => window.clearTimeout(timer);
  }, [processing]);

  return (
    <form
      aria-busy={processing || undefined}
      onInput={() => setInvalid(false)}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!form.checkValidity()) {
          setInvalid(true);
          form.reportValidity();
          return;
        }
        setInvalid(false);
        if (!processing) setProcessing(true);
      }}
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
          <Field label="Name on card" id={`${id}c-name`}>
            <input
              id={`${id}c-name`}
              className="dsv-input"
              defaultValue="Ada Lovelace"
              autoComplete="cc-name"
              required
              aria-invalid={invalid || undefined}
            />
          </Field>
          <Field label="Card number" id={`${id}c-num`}>
            <input
              id={`${id}c-num`}
              className="dsv-input"
              placeholder="•••• •••• •••• ••••"
              inputMode="numeric"
              autoComplete="cc-number"
              required
              aria-invalid={invalid || undefined}
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--space-3)" }}>
            <Field label="Expiry" id={`${id}c-exp`}>
              <input
                id={`${id}c-exp`}
                className="dsv-input"
                placeholder="MM/YY"
                inputMode="numeric"
                autoComplete="cc-exp"
                required
                aria-invalid={invalid || undefined}
              />
            </Field>
            <Field label="CVC" id={`${id}c-cvc`}>
              <input
                id={`${id}c-cvc`}
                className="dsv-input"
                placeholder="•••"
                inputMode="numeric"
                autoComplete="cc-csc"
                required
                aria-invalid={invalid || undefined}
              />
            </Field>
          </div>
          <p className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
            Shipping to 221B Baker Street, London NW1 6XE
          </p>
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
          <Button type="submit" size="lg" disabled={processing} style={{ width: "100%", marginTop: "var(--space-4)" }}>
            {processing ? "Processing…" : "Pay"}
          </Button>
          <p
            className="dsv-muted"
            style={{ fontSize: "var(--font-size-xs)", textAlign: "center", marginTop: "var(--space-2)" }}
          >
            Secure with 256-bit SSL
          </p>
        </div>
      </div>
    </form>
  );
}
