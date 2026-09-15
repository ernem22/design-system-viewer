import * as Dialog from "@radix-ui/react-dialog";
import { Button, Field } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import { Avat } from "./screenBits.tsx";
import "./screens.css";

const ROWS: [string, string, string][] = [
  ["Ada Lovelace", "Admin", "success"],
  ["Grace Hopper", "Editor", "info"],
  ["Alan Turing", "Viewer", "warning"],
];

export default function TeamBody() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="dsv-inline" style={{ justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
        <div className="dsv-avatar-group">
          {[13, 22, 31].map((n) => (
            <Avat key={n} n={n} size="sm" />
          ))}
          <span className="dsv-avatar dsv-avatar-more dsv-avatar--sm">+5</span>
        </div>
        <Dialog.Root>
          <Dialog.Trigger asChild>
            <Button size="sm">
              <Icon name="plus" size={14} /> Invite
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="dsv-overlay" />
            <Dialog.Content className="dsv-modal">
              <Dialog.Title asChild>
                <h3>Invite member</h3>
              </Dialog.Title>
              <Dialog.Description asChild>
                <p>They get an email with a join link.</p>
              </Dialog.Description>
              <Field label="Email" id="tm-e">
                <input id="tm-e" className="dsv-input" placeholder="turing@example.com" />
              </Field>
              <div className="dsv-modal-actions" style={{ marginTop: "var(--space-5)" }}>
                <Dialog.Close asChild>
                  <Button variant="ghost">Cancel</Button>
                </Dialog.Close>
                <Dialog.Close asChild>
                  <Button>Send invite</Button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      <div className="dsv-table-wrap">
        <table className="dsv-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([name, role, tone]) => (
              <tr key={name}>
                <td>
                  <span className="dsv-inline">
                    <Avat n={name.length + 10} size="sm" /> {name}
                  </span>
                </td>
                <td>{role}</td>
                <td>
                  <span className={`dsv-badge dsv-badge--${tone}`}>Active</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
