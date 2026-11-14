import { useState } from "react";
import type { ChangeEvent } from "react";
import { Button, Field, useCompareIdPrefix } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import "./screens.css";

const LABELS = ["Account", "Profile", "Team", "Confirm"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Values = { email: string; password: string; name: string; team: string; invites: string };
type Errors = Partial<Record<"email" | "password" | "name" | "team", string>>;

const EMPTY: Values = { email: "", password: "", name: "", team: "Acme", invites: "" };

export default function SignupBody() {
  // Start on Team so the specimen opens on the step with the richest form;
  // Back still walks the earlier steps and Finish lands on the confirm view.
  const [step, setStep] = useState(2);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);
  const id = useCompareIdPrefix();

  const set = (key: keyof Values) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (step === 0) {
      if (!values.email.trim()) next.email = "Enter your email address.";
      else if (!EMAIL.test(values.email)) next.email = "Enter a valid email address.";
      if (!values.password) next.password = "Choose a password.";
      else if (values.password.length < 8) next.password = "Use at least 8 characters.";
    }
    if (step === 1 && !values.name.trim()) next.name = "Enter your name.";
    if (step === 2 && !values.team.trim()) next.team = "Enter a team name.";
    return next;
  };

  const advance = () => {
    const next = validate();
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    if (step === LABELS.length - 1) setDone(true);
    else setStep((current) => current + 1);
  };

  const back = () => {
    setErrors({});
    setStep((current) => Math.max(0, current - 1));
  };

  const reset = () => {
    setValues(EMPTY);
    setErrors({});
    setStep(0);
    setDone(false);
  };

  return (
    <div>
      <div
        className="dsv-steps dsv-steps--center"
        style={{ maxWidth: 560, margin: "0 auto var(--space-5)" }}
        role="list"
        aria-label="Signup progress"
      >
        {LABELS.map((l, i) => (
          <div
            key={l}
            role="listitem"
            aria-current={!done && i === step ? "step" : undefined}
            className={`dsv-step ${done || i < step ? "dsv-step--done" : i === step ? "dsv-step--active" : ""}`}
          >
            <span className="dot">{done || i < step ? <Icon name="check" size={12} /> : i + 1}</span>
            <span className="label">{l}</span>
            {i < LABELS.length - 1 && <span className="bar" aria-hidden="true" />}
          </div>
        ))}
      </div>
      <div className="dsv-card" style={{ maxWidth: 420, margin: "0 auto" }}>
        {done ? (
          <div style={{ textAlign: "center" }}>
            <span
              className="dsv-feature-ico"
              style={{ margin: "0 auto var(--space-4)" }}
              aria-hidden="true"
            >
              <Icon name="check" size={20} />
            </span>
            <h3 style={{ margin: "0 0 var(--space-2)", fontSize: "var(--font-size-lg)" }}>
              You're all set
            </h3>
            <p className="dsv-muted" style={{ fontSize: "var(--font-size-sm)", margin: "0 0 var(--space-5)" }}>
              {values.team.trim() || "Your workspace"} is ready for {values.email || "your team"}.
            </p>
            <Button type="button" variant="outline" onClick={reset}>
              Start over
            </Button>
          </div>
        ) : (
          <>
            <h3 style={{ margin: "0 0 var(--space-4)", fontSize: "var(--font-size-lg)" }}>
              {LABELS[step]}
            </h3>
            <div className="dsv-stack">
              {step === 0 && (
                <>
                  <Field label="Email" id={`${id}s-email`} error={errors.email}>
                    <input
                      id={`${id}s-email`}
                      className="dsv-input"
                      type="email"
                      placeholder="ada@example.com"
                      autoComplete="email"
                      spellCheck={false}
                      required
                      value={values.email}
                      onChange={set("email")}
                    />
                  </Field>
                  <Field
                    label="Password"
                    id={`${id}s-pass`}
                    hint="At least 8 characters"
                    error={errors.password}
                  >
                    <input
                      id={`${id}s-pass`}
                      className="dsv-input"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      value={values.password}
                      onChange={set("password")}
                    />
                  </Field>
                </>
              )}
              {step === 1 && (
                <Field label="Full name" id={`${id}s-name`} error={errors.name}>
                  <input
                    id={`${id}s-name`}
                    className="dsv-input"
                    placeholder="Ada Lovelace"
                    autoComplete="name"
                    required
                    value={values.name}
                    onChange={set("name")}
                  />
                </Field>
              )}
              {step === 2 && (
                <>
                  <Field label="Team name" id={`${id}s-team`} error={errors.team}>
                    <input
                      id={`${id}s-team`}
                      className="dsv-input"
                      required
                      value={values.team}
                      onChange={set("team")}
                    />
                  </Field>
                  <Field label="Invite emails" id={`${id}s-inv`} hint="comma separated">
                    <input
                      id={`${id}s-inv`}
                      className="dsv-input"
                      placeholder="a@x.com, b@x.com"
                      spellCheck={false}
                      autoComplete="off"
                      value={values.invites}
                      onChange={set("invites")}
                    />
                  </Field>
                </>
              )}
              {step === 3 && (
                <dl className="dsv-datalist" style={{ gridTemplateColumns: "max-content 1fr" }}>
                  <dt>Email</dt>
                  <dd>{values.email || "—"}</dd>
                  <dt>Name</dt>
                  <dd>{values.name || "—"}</dd>
                  <dt>Team</dt>
                  <dd>{values.team || "—"}</dd>
                  <dt>Invites</dt>
                  <dd>{values.invites || "—"}</dd>
                </dl>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-6)" }}>
              <Button type="button" variant="ghost" disabled={step === 0} onClick={back}>
                Back
              </Button>
              <Button type="button" onClick={advance}>
                {step === LABELS.length - 1 ? "Finish" : "Continue"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
