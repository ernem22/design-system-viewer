import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button, Field, usePortalContainer } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import "./screens.css";

const ROWS: [string, string, string, string][] = [
  ["INV-1001", "Ada Lovelace", "Paid", "₺1.200"],
  ["INV-1002", "Grace Hopper", "Pending", "₺840"],
  ["INV-1003", "Alan Turing", "Overdue", "₺2.100"],
  ["INV-1004", "Katherine Johnson", "Paid", "₺560"],
  ["INV-1005", "Edsger Dijkstra", "Pending", "₺1.940"],
  ["INV-1006", "Barbara Liskov", "Paid", "₺720"],
];

const BADGE: Record<string, string> = { Paid: "success", Pending: "warning", Overdue: "danger" };

export default function TableBody() {
  const portalContainer = usePortalContainer();
  return (
    <div className="dsv-card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        className="dsv-toolbar"
        style={{
          border: "none",
          borderBottom: "var(--border-width-thin) solid var(--color-divider)",
          borderRadius: 0,
          padding: "var(--space-3)",
        }}
      >
        <div
          className="dsv-input-wrap dsv-input-wrap--prefix"
          style={{ minWidth: "min(220px, 100%)", flex: "1 1 180px", maxWidth: 280 }}
        >
          <span className="dsv-adorn dsv-adorn--prefix">
            <Icon name="search" size={14} />
          </span>
          <input
            className="dsv-input"
            placeholder="Search invoices…"
            aria-label="Search invoices"
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ flex: 1 }} />
        <Dialog.Root>
          <Dialog.Trigger asChild>
            <Button size="sm">
              <Icon name="plus" size={14} /> Invoice
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal container={portalContainer}>
            <Dialog.Overlay className="dsv-overlay" />
            <Dialog.Content className="dsv-modal">
              <Dialog.Title asChild>
                <h3>New invoice</h3>
              </Dialog.Title>
              <Dialog.Description asChild>
                <p>Enter customer and amount.</p>
              </Dialog.Description>
              <div className="dsv-stack">
                <Field label="Customer" id="t-cust">
                  <input id="t-cust" className="dsv-input" />
                </Field>
                <Field label="Amount" id="t-amt">
                  <input id="t-amt" className="dsv-input" placeholder="₺" />
                </Field>
              </div>
              <div className="dsv-modal-actions" style={{ marginTop: "var(--space-5)" }}>
                <Dialog.Close asChild>
                  <Button variant="ghost">Cancel</Button>
                </Dialog.Close>
                <Dialog.Close asChild>
                  <Button>Create</Button>
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
              {["Invoice", "Customer", "Status", "Amount", ""].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([id, cust, st, amt]) => (
              <tr key={id}>
                <td className="dsv-mono">{id}</td>
                <td>{cust}</td>
                <td>
                  <span className={`dsv-badge dsv-badge--${BADGE[st]}`}>{st}</span>
                </td>
                <td>{amt}</td>
                <td style={{ textAlign: "right" }}>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <Button variant="ghost" size="sm" className="dsv-icon-btn" aria-label="Actions">
                        <Icon name="dots" size={14} />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal container={portalContainer}>
                      <DropdownMenu.Content className="dsv-menu" align="end" sideOffset={4}>
                        <DropdownMenu.Item className="dsv-menu-item">View</DropdownMenu.Item>
                        <DropdownMenu.Item className="dsv-menu-item">Copy</DropdownMenu.Item>
                        <DropdownMenu.Separator className="dsv-menu-sep" />
                        <DropdownMenu.Item className="dsv-menu-item dsv-menu-item--danger">
                          Delete
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
