import { useEffect, useState } from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Button, Field, useCompareIdPrefix } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import { ScreenLink, ScreenSep } from "./screenBits.tsx";
import "./screens.css";

export default function LoginBody() {
  const id = useCompareIdPrefix();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!submitting) return;
    const timer = window.setTimeout(() => setSubmitting(false), 1200);
    return () => window.clearTimeout(timer);
  }, [submitting]);

  return (
    <div style={{ maxWidth: 360, margin: "0 auto" }}>
      <div className="dsv-card dsv-card--raised">
        <h3 style={{ margin: "0 0 var(--space-1)", fontSize: "var(--font-size-xl)" }}>
          Welcome back
        </h3>
        <p className="dsv-muted" style={{ margin: "0 0 var(--space-5)", fontSize: "var(--font-size-sm)" }}>
          Sign in to your account
        </p>
        <form
          className="dsv-stack"
          aria-busy={submitting || undefined}
          onSubmit={(event) => {
            event.preventDefault();
            if (!submitting) setSubmitting(true);
          }}
        >
          <Field label="Email" id={`${id}l-email`}>
            <input
              id={`${id}l-email`}
              className="dsv-input"
              type="email"
              placeholder="ada@example.com"
              autoComplete="email"
              spellCheck={false}
              required
            />
          </Field>
          <Field label="Password" id={`${id}l-pass`}>
            <input
              id={`${id}l-pass`}
              className="dsv-input"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </Field>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
            <label className="dsv-control-label">
              <Checkbox.Root className="dsv-check">
                <Checkbox.Indicator>
                  <Icon name="check" size={14} />
                </Checkbox.Indicator>
              </Checkbox.Root>
              Remember me
            </label>
            <ScreenLink to="#screen-login">Forgot password?</ScreenLink>
          </div>
          <Button type="submit" size="lg" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
          <ScreenSep>or</ScreenSep>
          <Button type="button" variant="outline" style={{ width: "100%" }}>
            Continue with GitHub
          </Button>
        </form>
      </div>
      <p
        className="dsv-muted"
        style={{ textAlign: "center", fontSize: "var(--font-size-sm)", marginTop: "var(--space-4)" }}
      >
        No account? <ScreenLink to="#screen-signup">Sign up</ScreenLink>
      </p>
    </div>
  );
}
