import { useState } from "react";
import * as Progress from "@radix-ui/react-progress";
import { Button, Field, useCompareIdPrefix } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import "./screens.css";

const LABELS = ["Workspace", "Invite", "Connect", "Done"];

const STEP_FIELDS = [
  { label: "Workspace name", placeholder: "Acme Inc.", autoComplete: "organization" },
  { label: "Invite emails", placeholder: "a@x.com, b@x.com", autoComplete: "off" },
  { label: "Connect a tool", placeholder: "Slack, GitHub, Figma…", autoComplete: "off" },
] as const;

export default function OnboardingBody() {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<string[]>(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const id = useCompareIdPrefix();
  const finalStep = LABELS.length - 1;
  const isFinal = step === finalStep;
  const field = STEP_FIELDS[Math.min(step, STEP_FIELDS.length - 1)];
  const percent = (step + 1) * 25;

  const setValue = (next: string) => {
    setValues((current) => current.map((v, i) => (i === step ? next : v)));
    setError(null);
  };

  const advance = () => {
    if (!values[step].trim()) {
      setError(`Enter ${field.label.toLowerCase()} to continue.`);
      return;
    }
    setError(null);
    setStep((current) => Math.min(finalStep, current + 1));
  };

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
        value={percent}
        aria-label="Onboarding completion"
        style={{ width: "100%", marginBottom: "var(--space-5)" }}
      >
        <Progress.Indicator className="dsv-progress-indicator" style={{ width: `${percent}%` }} />
      </Progress.Root>
      <div className="dsv-card">
        {isFinal ? (
          <div style={{ textAlign: "center" }}>
            <span
              className="dsv-feature-ico"
              style={{ margin: "0 auto var(--space-4)" }}
              aria-hidden="true"
            >
              <Icon name="check" size={20} />
            </span>
            <h3 style={{ margin: "0 0 var(--space-2)", fontSize: "var(--font-size-lg)" }}>
              You're ready
            </h3>
            <p className="dsv-muted" style={{ fontSize: "var(--font-size-sm)", margin: "0 0 var(--space-5)" }}>
              {values[0].trim() || "Your workspace"} is set up and ready to use.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep(0);
                setValues(["", "", "", ""]);
                setError(null);
              }}
            >
              Start over
            </Button>
          </div>
        ) : (
          <>
            <h3 style={{ margin: "0 0 var(--space-2)", fontSize: "var(--font-size-lg)" }}>
              {LABELS[step]}
            </h3>
            <p className="dsv-muted" style={{ fontSize: "var(--font-size-sm)", margin: "0 0 var(--space-4)" }}>
              Step {step + 1} of {LABELS.length}
            </p>
            <Field label={field.label} id={`${id}ob-v`} error={error}>
              <input
                id={`${id}ob-v`}
                className="dsv-input"
                placeholder={field.placeholder}
                autoComplete={field.autoComplete}
                spellCheck={field.autoComplete === "off" ? false : undefined}
                required
                value={values[step]}
                onChange={(event) => setValue(event.target.value)}
              />
            </Field>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-5)" }}>
              <Button
                type="button"
                variant="ghost"
                disabled={step === 0}
                onClick={() => {
                  setError(null);
                  setStep((current) => Math.max(0, current - 1));
                }}
              >
                Back
              </Button>
              <Button type="button" onClick={advance}>
                {step === finalStep - 1 ? "Finish" : "Next"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
