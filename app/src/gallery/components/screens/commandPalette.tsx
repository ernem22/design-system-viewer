import { Icon } from "../../../lib/icons.tsx";
import "./screens.css";

const GROUPS: [string, string[]][] = [
  ["Go", ["Go to homepage", "Go to settings", "Go to invoices"]],
  ["Action", ["New project", "Invite member", "Create API key"]],
];

export default function CommandPaletteBody() {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="dsv-menu" style={{ position: "static", padding: 0, animation: "none", minWidth: 0 }}>
        <div
          className="dsv-inline"
          style={{
            gap: "var(--space-2)",
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "var(--border-width-thin) solid var(--color-divider)",
          }}
        >
          <Icon name="search" size={16} />
          <input
            className="dsv-input"
            placeholder="Search commands or pages…"
            aria-label="Search commands"
            style={{
              border: "none",
              padding: 0,
              height: "auto",
              background: "transparent",
              flex: 1,
              minWidth: 0,
            }}
          />
          <kbd className="dsv-kbd">Esc</kbd>
        </div>
        <div style={{ padding: "var(--space-1-5)" }}>
          {GROUPS.map(([g, items], gi) => (
            <div key={g}>
              <div className="dsv-menu-label">{g}</div>
              {items.map((it, i) => (
                <div
                  key={it}
                  className="dsv-menu-item"
                  data-highlighted={gi === 0 && i === 0 ? "" : undefined}
                >
                  <Icon name={gi === 0 ? "chevronRight" : "plus"} size={14} /> {it}
                  {gi === 0 && i === 0 && <span className="dsv-menu-shortcut">↵</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
