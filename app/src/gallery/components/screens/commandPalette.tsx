import { useState } from "react";
import { Icon } from "../../../lib/icons.tsx";
import { useCompareIdPrefix } from "../../ui.tsx";
import "./screens.css";

const GROUPS: [string, string[]][] = [
  ["Go", ["Go to homepage", "Go to settings", "Go to invoices"]],
  ["Action", ["New project", "Invite member", "Create API key"]],
];

export default function CommandPaletteBody() {
  const id = useCompareIdPrefix();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [ran, setRan] = useState<string>();

  const q = query.trim().toLowerCase();
  const groups = GROUPS.map(([label, items]) => [
    label,
    items.filter((item) => !q || item.toLowerCase().includes(q)),
  ] as const).filter(([, items]) => items.length > 0);
  const flat = groups.flatMap(([, items]) => items);
  const current = flat.length === 0 ? -1 : Math.min(active, flat.length - 1);

  const listboxId = `${id}cmd-list`;
  const optionId = (index: number) => `${id}cmd-opt-${index}`;

  const move = (delta: number) => {
    if (flat.length === 0) return;
    setActive((current + delta + flat.length) % flat.length);
  };

  const run = (index: number) => {
    const item = flat[index];
    if (item) setRan(item);
  };

  let flatIndex = -1;

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
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={current >= 0 ? optionId(current) : undefined}
            aria-autocomplete="list"
            aria-label="Search commands"
            placeholder="Search commands or pages…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                move(1);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                move(-1);
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (current >= 0) run(current);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setQuery("");
                setActive(0);
                setRan(undefined);
              }
            }}
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
        <div id={listboxId} role="listbox" aria-label="Commands" style={{ padding: "var(--space-1-5)" }}>
          {groups.map(([group, items]) => (
            <div key={group} role="group" aria-label={group}>
              <div className="dsv-menu-label">{group}</div>
              {items.map((it) => {
                flatIndex += 1;
                const index = flatIndex;
                return (
                  <div
                    key={it}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === current}
                    className="dsv-menu-item"
                    data-highlighted={index === current ? "" : undefined}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => run(index)}
                  >
                    <Icon name={group === "Go" ? "chevronRight" : "plus"} size={14} /> {it}
                    {index === current && <span className="dsv-menu-shortcut">↵</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {flat.length === 0 && (
            <div className="dsv-menu-label" role="status">
              No commands match.
            </div>
          )}
        </div>
        <div
          role="status"
          aria-live="polite"
          style={{
            fontSize: "var(--font-size-xs)",
            color: "var(--color-text-muted)",
            padding: "var(--space-2) var(--space-4)",
            borderTop: "var(--border-width-thin) solid var(--color-divider)",
          }}
        >
          {ran ? `Ran “${ran}” · ↓↑ to move, ↵ to run, Esc to clear` : "↓↑ to move, ↵ to run, Esc to clear"}
        </div>
      </div>
    </div>
  );
}
