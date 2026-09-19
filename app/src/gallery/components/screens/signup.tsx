import { useState } from "react";
import { Button, Field } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import "./screens.css";

const LABELS = ["Account", "Profile", "Team", "Confirm"];

export default function SignupBody() {
  const [step, setStep] = useState(2);
  return (
    <div style={{ maxWidth: 420, margin: "0 auto" }}>
      <div
        className="dsv-steps dsv-steps--center"
        style={{ marginBottom: "var(--space-5)" }}
        role="list"
        aria-label="Signup progress"
      >
        {LABELS.map((l, i) => (
          <div
            key={l}
            role="listitem"
            aria-current={i === step ? "step" : undefined}
            className={`dsv-step ${i < step ? "dsv-step--done" : i === step ? "dsv-step--active" : ""}`}
          >
            <span className="dot">{i < step ? <Icon name="check" size={12} /> : i + 1}</span>
            <span className="label">{l}</span>
            {i < LABELS.length - 1 && <span className="bar" aria-hidden="true" />}
          </div>
        ))}
      </div>
      <div className="dsv-card">
        <h3 style={{ margin: "0 0 var(--space-4)", fontSize: "var(--font-size-lg)" }}>
          {LABELS[step]}
        </h3>
        <div className="dsv-stack">
          <Field label="Team name" id="s-team">
            <input id="s-team" className="dsv-input" defaultValue="Acme" />
          </Field>
          <Field label="Invite emails" id="s-inv" hint="comma separated">
            <input id="s-inv" className="dsv-input" placeholder="a@x.com, b@x.com" />
          </Field>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-6)" }}>
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          <Button onClick={() => setStep((s) => Math.min(LABELS.length - 1, s + 1))}>
            {step === LABELS.length - 1 ? "Finish" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
