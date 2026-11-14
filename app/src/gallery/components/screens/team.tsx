import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Button, Field, useCompareIdPrefix, usePortalContainer } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import { Avat } from "./screenBits.tsx";
import "./screens.css";

const ROWS: [string, string, string][] = [
  ["Ada Lovelace", "Admin", "Active"],
  ["Grace Hopper", "Editor", "Active"],
  ["Alan Turing", "Viewer", "Invited"],
];

const STATUS_TONE: Record<string, string> = {
  Active: "success",
  Invited: "info",
  Suspended: "warning",
};

export default function TeamBody() {
  const portalContainer = usePortalContainer();
  const id = useCompareIdPrefix();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="dsv-inline" style={{ justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
        <div
          className="dsv-avatar-group"
          role="group"
          aria-label="Team members: Ada Lovelace, Grace Hopper, Alan Turing, and 5 more"
        >
          {["Ada Lovelace", "Grace Hopper", "Alan Turing"].map((name) => (
            <Avat key={name} name={name} size="sm" decorative />
          ))}
          <span className="dsv-avatar dsv-avatar-more dsv-avatar--sm" aria-hidden="true">
            +5
          </span>
        </div>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <Button size="sm">
              <Icon name="plus" size={14} /> Invite
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal container={portalContainer}>
            <Dialog.Overlay className="dsv-overlay" />
            <Dialog.Content className="dsv-modal">
              <Dialog.Title asChild>
                <h3>Invite member</h3>
              </Dialog.Title>
              <Dialog.Description asChild>
                <p>They get an email with a join link.</p>
              </Dialog.Description>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!e.currentTarget.checkValidity()) {
                    setError("Enter a valid email address.");
                    return;
                  }
                  setOpen(false);
                  setEmail("");
                  setError(undefined);
                }}
              >
                <Field label="Email" id={`${id}tm-e`} error={error}>
                  <input
                    id={`${id}tm-e`}
                    className="dsv-input"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="turing@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(undefined);
                    }}
                  />
                </Field>
                <div className="dsv-modal-actions" style={{ marginTop: "var(--space-5)" }}>
                  <Dialog.Close asChild>
                    <Button variant="ghost">Cancel</Button>
                  </Dialog.Close>
                  <Button type="submit">Send invite</Button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      <div className="dsv-table-wrap">
        <table className="dsv-table">
          <caption>
            <VisuallyHidden.Root>Team members, roles and invite status</VisuallyHidden.Root>
          </caption>
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([name, role, status]) => (
              <tr key={name}>
                <td>
                  <span className="dsv-inline">
                    <Avat name={name} size="sm" decorative /> {name}
                  </span>
                </td>
                <td>{role}</td>
                <td>
                  <span className={`dsv-badge dsv-badge--${STATUS_TONE[status]}`}>{status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
