import { useState } from "react";
import * as Form from "@radix-ui/react-form";
import * as OneTimePasswordField from "@radix-ui/react-one-time-password-field";
import * as PasswordToggleField from "@radix-ui/react-password-toggle-field";
import { Button, Demo } from "../ui.tsx";
import { Icon } from "../../lib/icons.tsx";
import "./validation.css";

function OtpDemo() {
  const [value, setValue] = useState("");
  return (
    <OneTimePasswordField.Root className="dsv-otp" value={value} onValueChange={setValue} aria-label="One-time password">
      {Array.from({ length: 6 }, (_, i) => (
        <OneTimePasswordField.Input key={i} aria-label={`Digit ${i + 1}`} />
      ))}
      <OneTimePasswordField.HiddenInput />
    </OneTimePasswordField.Root>
  );
}

export default function ValidationBody() {
  const [sent, setSent] = useState(0);

  return (
    <>
      <Demo title="Radix Form — client validation">
        {/* key: successful submit rebuilds the tree → native form reset behavior */}
        <Form.Root
          key={sent}
          className="dsv-form-card"
          onSubmit={(e) => {
            e.preventDefault();
            setSent((n) => n + 1);
          }}
        >
          <Form.Field name="email" className="dsv-form-field">
            <div className="dsv-form-row">
              <Form.Label className="dsv-label">Email</Form.Label>
              <Form.Message className="dsv-form-message" match="valueMissing">
                required
              </Form.Message>
              <Form.Message className="dsv-form-message" match="typeMismatch">
                invalid email
              </Form.Message>
            </div>
            <Form.Control asChild>
              <input className="dsv-input" type="email" required placeholder="ada@example.com" autoComplete="email" spellCheck={false} />
            </Form.Control>
          </Form.Field>
          <Form.Field name="msg" className="dsv-form-field">
            <div className="dsv-form-row">
              <Form.Label className="dsv-label">Message</Form.Label>
              <Form.Message className="dsv-form-message" match="valueMissing">
                required
              </Form.Message>
              <Form.Message className="dsv-form-message" match={(v) => v.length < 10}>
                at least 10 characters
              </Form.Message>
            </div>
            <Form.Control asChild>
              <textarea className="dsv-textarea" required />
            </Form.Control>
          </Form.Field>
          <Form.Submit asChild>
            <Button className="dsv-form-submit">Submit</Button>
          </Form.Submit>
          {sent > 0 && (
            <p className="dsv-form-message dsv-form-message--sent" data-valid>
              ✓ submitted
            </p>
          )}
        </Form.Root>
      </Demo>

      <Demo title="Password Toggle Field">
        <div className="dsv-field dsv-pwd-field">
          <label className="dsv-label" htmlFor="v-pass">Password</label>
          <PasswordToggleField.Root>
            <div className="dsv-pwd">
              <PasswordToggleField.Input id="v-pass" className="dsv-input" autoComplete="current-password" placeholder="Enter password" />
              <PasswordToggleField.Toggle aria-label="Show/hide password">
                <PasswordToggleField.Icon visible={<Icon name="eyeOff" size={15} />} hidden={<Icon name="eye" size={15} />} />
              </PasswordToggleField.Toggle>
            </div>
          </PasswordToggleField.Root>
        </div>
      </Demo>

      <Demo title="One-Time Password Field (6 digits, paste supported)">
        <OtpDemo />
      </Demo>
    </>
  );
}
