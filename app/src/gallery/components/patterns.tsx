import { useState } from "react";
import type { ReactNode } from "react";
import * as Avatar from "@radix-ui/react-avatar";
import * as Popover from "@radix-ui/react-popover";
import { Button, Demo, usePortalContainer } from "../ui.tsx";
import { Icon } from "../../lib/icons.tsx";
import "./patterns.css";

function CalendarDemo() {
  const [offset, setOffset] = useState(0);
  const [sel, setSel] = useState(14);
  const base = new Date(2026, 5 + offset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const title = base.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const isJune = offset === 0;
  const pick = (d: number) => setSel(d);
  return (
    <div>
      <div
        className="dsv-inline"
        style={{ justifyContent: "space-between", maxWidth: 320, marginBottom: "var(--space-2)" }}
      >
        <strong style={{ fontSize: "var(--font-size-sm)" }}>{title}</strong>
        <span className="dsv-inline" style={{ gap: "var(--space-1)" }}>
          <button
            className="dsv-btn dsv-btn--ghost dsv-btn--sm dsv-icon-btn"
            aria-label="Previous month"
            onClick={() => setOffset((o) => o - 1)}
          >
            <Icon name="chevronLeft" size={14} />
          </button>
          <button
            className="dsv-btn dsv-btn--ghost dsv-btn--sm"
            onClick={() => {
              setOffset(0);
              setSel(9);
            }}
          >
            Today
          </button>
          <button
            className="dsv-btn dsv-btn--ghost dsv-btn--sm dsv-icon-btn"
            aria-label="Next month"
            onClick={() => setOffset((o) => o + 1)}
          >
            <Icon name="chevronRight" size={14} />
          </button>
        </span>
      </div>
      {isJune && (
        <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", marginBottom: "var(--space-2)" }}>
          range 12–18 · today 9
        </div>
      )}
      <div className="dsv-cal">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="dsv-cal-head">
            {d}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
          <button
            key={`${year}-${month}-${d}`}
            type="button"
            aria-pressed={d === sel}
            aria-label={`${title} ${d}`}
            className={`dsv-cal-day ${d === sel ? "is-selected" : ""} ${isJune && d === 9 ? "is-today" : ""} ${isJune && d >= 12 && d <= 18 ? "is-range" : ""}`}
            onClick={() => pick(d)}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", marginTop: "var(--space-2)" }}>
        Selected: {sel != null ? `${title} ${sel}` : "—"}
      </div>
    </div>
  );
}

function ComboboxDemo() {
  const portalContainer = usePortalContainer();
  const all = ["Design tokens", "Component preview", "Compare mode", "Dark variant", "Command palette", "Analytics"];
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(["Compare mode"]);
  const opts = all.filter((o) => o.toLowerCase().includes(q.toLowerCase()) && !picked.includes(o));
  return (
    <Popover.Root>
      <div style={{ minWidth: 260 }}>
        <div className="dsv-row" style={{ marginBottom: "var(--space-2)" }}>
          {picked.map((t) => (
            <span key={t} className="dsv-tag">
              {t}
              <button
                aria-label={`${t} remove`}
                onClick={() => setPicked((xs) => xs.filter((x) => x !== t))}
              >
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
        </div>
        <Popover.Trigger asChild>
          <div className="dsv-input-wrap dsv-input-wrap--prefix" style={{ cursor: "text" }}>
            <span className="dsv-adorn dsv-adorn--prefix">
              <Icon name="search" size={14} />
            </span>
            <input
              className="dsv-input"
              placeholder="Search options…"
              aria-label="Search options"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </Popover.Trigger>
        <Popover.Portal container={portalContainer}>
          <Popover.Content
            className="dsv-menu"
            sideOffset={6}
            align="start"
            style={{ minWidth: 260 }}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {opts.length === 0 && <div className="dsv-menu-label">No matches</div>}
            {opts.map((o) => (
              <div
                key={o}
                className="dsv-menu-item"
                onClick={() => {
                  setPicked((p) => [...p, o]);
                  setQ("");
                }}
              >
                <Icon name="plus" size={14} /> {o}
              </div>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </div>
    </Popover.Root>
  );
}

function StepperDemo() {
  const [n, setN] = useState(2);
  return (
    <div className="dsv-stepper">
      <button aria-label="Decrease" onClick={() => setN((v) => Math.max(0, v - 1))}>
        −
      </button>
      <input
        value={n}
        onChange={(e) => setN(Number(e.target.value) || 0)}
        aria-label="Quantity"
        inputMode="numeric"
      />
      <button aria-label="Increase" onClick={() => setN((v) => v + 1)}>
        +
      </button>
    </div>
  );
}

function RatingDemo() {
  const [v, setV] = useState(4);
  const [hov, setHov] = useState(0);
  return (
    <div className="dsv-rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          className={(hov || v) >= i ? "is-on" : ""}
          onClick={() => setV(i)}
          onMouseEnter={() => setHov(i)}
          onMouseLeave={() => setHov(0)}
          aria-label={`${i} stars`}
        >
          <Icon name="star" size={20} />
        </button>
      ))}
    </div>
  );
}

function CopyDemo() {
  const [done, setDone] = useState(false);
  return (
    <div className="dsv-inline">
      <code className="dsv-code-inline">npm run build</code>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
      >
        <Icon name={done ? "check" : "copy"} size={14} /> {done ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function InlineEditDemo() {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("Acme workspace");
  return editing ? (
    <div className="dsv-inline">
      <input
        className="dsv-input"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        autoFocus
        style={{ minWidth: 200 }}
      />
      <Button size="sm" onClick={() => setEditing(false)}>
        Save
      </Button>
    </div>
  ) : (
    <div className="dsv-inline">
      <strong style={{ fontSize: "var(--font-size-sm)" }}>{val}</strong>
      <Button
        variant="ghost"
        size="sm"
        className="dsv-icon-btn"
        aria-label="Edit name"
        onClick={() => setEditing(true)}
      >
        <Icon name="edit" size={14} />
      </Button>
    </div>
  );
}

function TreeDemo() {
  const [open, setOpen] = useState<Record<string, boolean>>({ src: true, preview: true });
  const [sel, setSel] = useState("components.jsx");
  const t = (id: string, label: string, kids?: ReactNode) => (
    <li key={id}>
      <div
        className={`dsv-tree-row ${sel === id ? "is-selected" : ""} ${kids && open[id] ? "is-open" : ""}`}
        role="treeitem"
        aria-expanded={kids ? !!open[id] : undefined}
        aria-selected={sel === id}
        tabIndex={0}
        onClick={() => {
          setSel(id);
          if (kids) setOpen((o) => ({ ...o, [id]: !o[id] }));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSel(id);
            if (kids) setOpen((o) => ({ ...o, [id]: !o[id] }));
          }
        }}
      >
        {kids && <Icon name="chevronRight" size={12} />}
        <Icon name="file" size={14} /> {label}
      </div>
      {kids && open[id] && <ul role="group">{kids}</ul>}
    </li>
  );
  return (
    <ul className="dsv-tree" role="tree" aria-label="Project files" style={{ minWidth: 220 }}>
      {t(
        "src",
        "src",
        <>
          {t("core", "core", <>{t("schema.js", "schema.js")}</>)}
          {t(
            "preview",
            "preview",
            <>
              {t("components.jsx", "components.jsx")} {t("screens.jsx", "screens.jsx")}
            </>,
          )}
        </>,
      )}
    </ul>
  );
}

function DropzoneDemo() {
  const [st, setSt] = useState("idle");
  return (
    <div style={{ minWidth: 260 }}>
      <div
        className={`dsv-dropzone ${st === "over" ? "is-over" : ""} ${st === "done" ? "is-done" : ""}`}
        onMouseEnter={() => st === "idle" && setSt("over")}
        onMouseLeave={() => st === "over" && setSt("idle")}
        onClick={() => setSt(st === "done" ? "idle" : "done")}
      >
        {st === "done" ? "✓ report.pdf uploaded" : st === "over" ? "Drop to upload" : "Drag files here or browse"}
        <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", marginTop: "var(--space-1)" }}>
          idle / drag-over / done — inset well below
        </div>
      </div>
      <div className="dsv-well" style={{ marginTop: "var(--space-3)", fontSize: "var(--font-size-xs)" }}>
        <code className="dsv-code-inline">--shadow-inner</code> pressed / drop-target well
      </div>
    </div>
  );
}

function ChartsDemo() {
  const bars = [34, 58, 46, 80, 64, 92, 70];
  const line = "M0,60 L20,52 L40,56 L60,38 L80,44 L100,22 L120,30";
  return (
    <div className="dsv-inline" style={{ gap: "var(--space-6)", alignItems: "flex-end" }}>
      <div className="dsv-inline" style={{ alignItems: "flex-end", gap: 4, height: 90 }}>
        {bars.map((h, i) => (
          <div
            key={i}
            className={`dsv-chart-bar ${i === 5 ? "dsv-chart-bar--hot" : ""}`}
            style={{ width: "var(--space-3)", height: h }}
          />
        ))}
      </div>
      <svg width="140" height="70" viewBox="0 0 140 70" role="img" aria-label="sparkline">
        <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="100" cy="22" r="3" fill="var(--color-accent)" />
      </svg>
      <svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label="donut">
        <circle cx="36" cy="36" r="28" fill="none" stroke="var(--color-surface-sunken)" strokeWidth="10" />
        <circle cx="36" cy="36" r="28" fill="none" stroke="var(--color-success)" strokeWidth="10" strokeDasharray="120 176" strokeLinecap="round" transform="rotate(-90 36 36)" />
        <circle cx="36" cy="36" r="28" fill="none" stroke="var(--color-warning)" strokeWidth="10" strokeDasharray="30 176" strokeDashoffset="-120" strokeLinecap="round" transform="rotate(-90 36 36)" />
      </svg>
    </div>
  );
}

function ChartThemeDemo() {
  const bars = [38, 62, 48, 80, 56, 90, 70, 66];
  return (
    <div style={{ width: "100%", maxWidth: 420 }}>
      <div className="dsv-inline" style={{ alignItems: "flex-end", gap: "var(--space-2)", height: 110 }}>
        {bars.map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: h,
              background: `var(--color-chart-${i + 1})`,
              borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
            }}
          />
        ))}
      </div>
      <div className="dsv-chart-grid" style={{ height: "var(--space-4)" }} />
      <div className="dsv-chart-axis" />
      <div className="dsv-inline" style={{ justifyContent: "space-between", marginTop: "var(--space-2)" }}>
        <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
          grid + axis tokens
        </span>
        <span className="dsv-chart-tip">1,284 visits</span>
      </div>
    </div>
  );
}

function AvatarGroupDemo() {
  return (
    <div className="dsv-avatar-group">
      {[13, 22, 31, 47].map((n) => (
        <span key={n} className="dsv-avatar dsv-avatar--md">
          <Avatar.Root style={{ width: "100%", height: "100%", display: "flex" }}>
            <Avatar.Image src={`https://i.pravatar.cc/64?img=${n}`} alt="" />
            <Avatar.Fallback className="dsv-avatar-fallback" delayMs={600}>
              U{n % 10}
            </Avatar.Fallback>
          </Avatar.Root>
        </span>
      ))}
      <span className="dsv-avatar dsv-avatar-more dsv-avatar--md">+3</span>
    </div>
  );
}

const SHORTCUTS: [string, string[]][] = [
  ["Save", ["⌘", "S"]],
  ["Search commands", ["⌘", "K"]],
  ["Undo", ["⌘", "Z"]],
  ["New project", ["⌘", "N"]],
  ["Delete", ["⌫"]],
  ["Toggle sidebar", ["⌘", "B"]],
];

export default function PatternsBody() {
  return (
    <>
      <Demo title="Calendar / date field">
        <CalendarDemo />
      </Demo>
      <Demo title="Combobox — multi-select tags">
        <ComboboxDemo />
      </Demo>
      <Demo title="Number stepper">
        <StepperDemo />
      </Demo>
      <Demo title="Rating">
        <RatingDemo />
      </Demo>
      <Demo title="Copy to clipboard">
        <CopyDemo />
      </Demo>
      <Demo title="Inline edit">
        <InlineEditDemo />
      </Demo>
      <Demo title="Avatar group">
        <AvatarGroupDemo />
      </Demo>
      <Demo title="Keyboard shortcuts">
        <table className="dsv-kbd-table" style={{ minWidth: 260 }}>
          <tbody>
            {SHORTCUTS.map(([label, keys]) => (
              <tr key={label}>
                <td>{label}</td>
                <td style={{ textAlign: "right" }}>
                  {keys.map((k) => (
                    <kbd key={k} className="dsv-kbd" style={{ marginLeft: 4 }}>
                      {k}
                    </kbd>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Demo>
      <Demo title="Tree view">
        <TreeDemo />
      </Demo>
      <Demo title="File dropzone">
        <DropzoneDemo />
      </Demo>
      <Demo title="Chart primitives">
        <ChartsDemo />
      </Demo>
      <Demo title="Chart theme tokens">
        <ChartThemeDemo />
      </Demo>
    </>
  );
}
