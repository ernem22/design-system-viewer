import { useState } from "react";
import * as Progress from "@radix-ui/react-progress";
import { Button, Field } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import "./screens.css";

const LABELS = ["Workspace", "Invite", "Connect", "Done"];

export default function OnboardingBody() {
  const [step, setStep] = useState(1);
  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div
        className="dsv-steps dsv-steps--center"
        style={{ marginBottom: "var(--space-5)" }}
        role="list"
        aria-label="Onboarding progress"
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
      <Progress.Root
        className="dsv-progress"
        value={(step + 1) * 25}
        style={{ width: "100%", marginBottom: "var(--space-5)" }}
      >
        <Progress.Indicator
          className="dsv-progress-indicator"
          style={{ width: `${(step + 1) * 25}%` }}
        />
      </Progress.Root>
      <div className="dsv-card">
        <h3 style={{ margin: "0 0 var(--space-2)", fontSize: "var(--font-size-lg)" }}>
          {LABELS[step]}
        </h3>
        <p className="dsv-muted" style={{ fontSize: "var(--font-size-sm)", margin: "0 0 var(--space-4)" }}>
          Step {step + 1} of {LABELS.length}
        </p>
        <Field label="Value" id="ob-v">
          <input id="ob-v" className="dsv-input" placeholder={`Your ${LABELS[step].toLowerCase()}…`} />
        </Field>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-5)" }}>
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          <Button onClick={() => setStep((s) => Math.min(LABELS.length - 1, s + 1))}>
            {step === LABELS.length - 1 ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
