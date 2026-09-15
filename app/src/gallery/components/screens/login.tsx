import * as Checkbox from "@radix-ui/react-checkbox";
import { Button, Field } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import { ScreenLink, ScreenSep } from "./screenBits.tsx";
import "./screens.css";

export default function LoginBody() {
  return (
    <div style={{ maxWidth: 360, margin: "0 auto" }}>
      <div className="dsv-card dsv-card--raised">
        <h3 style={{ margin: "0 0 var(--space-1)", fontSize: "var(--font-size-xl)" }}>
          Welcome back
        </h3>
        <p className="dsv-muted" style={{ margin: "0 0 var(--space-5)", fontSize: "var(--font-size-sm)" }}>
          Sign in to your account
        </p>
        <div className="dsv-stack">
          <Field label="Email" id="l-email">
            <input id="l-email" className="dsv-input" type="email" placeholder="ada@example.com" />
          </Field>
          <Field label="Password" id="l-pass">
            <input id="l-pass" className="dsv-input" type="password" placeholder="••••••••" />
          </Field>
          <label className="dsv-control-label">
            <Checkbox.Root className="dsv-check" defaultChecked>
              <Checkbox.Indicator>
                <Icon name="check" size={14} />
              </Checkbox.Indicator>
            </Checkbox.Root>
            Remember me
          </label>
          <Button size="lg" style={{ width: "100%" }}>
            Sign in
          </Button>
          <ScreenSep>or</ScreenSep>
          <Button variant="outline" style={{ width: "100%" }}>
            Continue with GitHub
          </Button>
        </div>
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
