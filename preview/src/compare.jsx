import { Fragment, useEffect, useMemo, useState } from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Switch from "@radix-ui/react-switch";
import * as Slider from "@radix-ui/react-slider";
import * as Select from "@radix-ui/react-select";
import * as Tabs from "@radix-ui/react-tabs";
import * as Accordion from "@radix-ui/react-accordion";
import * as Progress from "@radix-ui/react-progress";
import { Button, Field, Icon } from "./ui.jsx";
import { loadGoogleFonts } from "./useSystemTokens.js";

// ── comparable component renderers (stateless-ish; local state is per column) ──
const Buttons = () => (
  <div className="cmp-stack">
    <div className="dsv-row">
      <Button>Solid</Button><Button variant="soft">Soft</Button><Button variant="outline">Outline</Button>
    </div>
    <div className="dsv-row">
      <Button variant="ghost">Ghost</Button><Button variant="danger">Danger</Button><Button disabled>Disabled</Button>
    </div>
    <div className="dsv-row">
      <Button size="sm">Small</Button><Button>Medium</Button><Button size="lg">Large</Button>
    </div>
  </div>
);

const Inputs = () => (
  <div className="cmp-stack">
    <Field label="Email" id="c-e"><input id="c-e" className="dsv-input" placeholder="ada@example.com" /></Field>
    <Field label="Password" id="c-p" error="At least 8 characters"><input id="c-p" className="dsv-input" aria-invalid="true" defaultValue="123" type="password" /></Field>
    <Field label="Note" id="c-n"><textarea id="c-n" className="dsv-textarea" placeholder="…" /></Field>
    <Field label="Disabled" id="c-d"><input id="c-d" className="dsv-input" disabled defaultValue="read-only" /></Field>
  </div>
);

function Controls() {
  const [cb, setCb] = useState(true);
  const [rg, setRg] = useState("b");
  const [sw, setSw] = useState(true);
  return (
    <div className="cmp-stack">
      <label className="dsv-control-label">
        <Checkbox.Root className="dsv-check" checked={cb} onCheckedChange={setCb}><Checkbox.Indicator><Icon name="check" size={14} /></Checkbox.Indicator></Checkbox.Root>
        Checkbox
      </label>
      <RadioGroup.Root className="dsv-stack" value={rg} onValueChange={setRg}>
        {[["a", "Option A"], ["b", "Option B"]].map(([v, l]) => (
          <label key={v} className="dsv-control-label">
            <RadioGroup.Item className="dsv-radio" value={v}><RadioGroup.Indicator className="dsv-radio-indicator" /></RadioGroup.Item>{l}
          </label>
        ))}
      </RadioGroup.Root>
      <label className="dsv-control-label">
        <Switch.Root className="dsv-switch" checked={sw} onCheckedChange={setSw}><Switch.Thumb className="dsv-switch-thumb" /></Switch.Root>
        Switch
      </label>
    </div>
  );
}

function Sliders() {
  const [v, setV] = useState([45]);
  return (
    <Slider.Root className="dsv-slider" value={v} onValueChange={setV} max={100} style={{ width: "100%" }}>
      <Slider.Track className="dsv-slider-track"><Slider.Range className="dsv-slider-range" /></Slider.Track>
      <Slider.Thumb className="dsv-slider-thumb" aria-label="Value" />
    </Slider.Root>
  );
}

const Selects = () => (
  <Select.Root defaultValue="tr">
    <Select.Trigger className="dsv-select-trigger" aria-label="Language" style={{ width: "100%" }}>
      <Select.Value /><Select.Icon><Icon name="chevronDown" size={14} /></Select.Icon>
    </Select.Trigger>
    <Select.Portal>
      <Select.Content className="dsv-select-content" position="popper" sideOffset={6}>
        <Select.Viewport>
          {[["tr", "Turkish"], ["en", "English"], ["de", "German"]].map(([v, l]) => (
            <Select.Item key={v} value={v} className="dsv-select-item">
              <Select.ItemIndicator className="dsv-select-item-indicator"><Icon name="check" size={14} /></Select.ItemIndicator>
              <Select.ItemText>{l}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>
);

const Cards = () => (
  <div className="cmp-stack">
    <div className="dsv-card">
      <div style={{ fontWeight: "var(--font-weight-semibold)", marginBottom: "var(--space-1)" }}>Card title</div>
      <div className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>Shadow, border, radius tokens.</div>
    </div>
    <div className="dsv-card dsv-card--raised">
      <div className="dsv-inline" style={{ justifyContent: "space-between" }}>
        <span style={{ fontWeight: "var(--font-weight-medium)" }}>Elevated</span>
        <span className="dsv-badge dsv-badge--success">Active</span>
      </div>
    </div>
  </div>
);

const Badges = () => (
  <div className="cmp-stack">
    <div className="dsv-row">
      <span className="dsv-badge">Default</span>
      <span className="dsv-badge dsv-badge--success">Success</span>
      <span className="dsv-badge dsv-badge--warning">Warning</span>
      <span className="dsv-badge dsv-badge--danger">Error</span>
      <span className="dsv-badge dsv-badge--info">Info</span>
    </div>
    <div className="dsv-callout dsv-callout--info"><span className="ico"><Icon name="bell" size={16} /></span><div>Info message.</div></div>
    <div className="dsv-callout dsv-callout--danger"><span className="ico"><Icon name="x" size={16} /></span><div>Error message.</div></div>
  </div>
);

const Tabbed = () => (
  <Tabs.Root defaultValue="a">
    <Tabs.List className="dsv-tabs-list">
      <Tabs.Trigger className="dsv-tabs-trigger" value="a">Account</Tabs.Trigger>
      <Tabs.Trigger className="dsv-tabs-trigger" value="b">Password</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content className="dsv-tabs-content" value="a">Account tab content.</Tabs.Content>
    <Tabs.Content className="dsv-tabs-content" value="b">Password tab content.</Tabs.Content>
  </Tabs.Root>
);

const Accord = () => (
  <Accordion.Root type="single" collapsible className="dsv-accordion" defaultValue="1" style={{ maxWidth: "none" }}>
    {[["1", "First question"], ["2", "Second question"]].map(([v, q]) => (
      <Accordion.Item key={v} value={v} className="dsv-accordion-item">
        <Accordion.Header><Accordion.Trigger className="dsv-accordion-trigger">{q}<span className="chev"><Icon name="chevronDown" size={16} /></span></Accordion.Trigger></Accordion.Header>
        <Accordion.Content className="dsv-accordion-content">Short answer text.</Accordion.Content>
      </Accordion.Item>
    ))}
  </Accordion.Root>
);

const Progressy = () => (
  <div className="cmp-stack">
    <Progress.Root className="dsv-progress" value={66} style={{ width: "100%" }}>
      <Progress.Indicator className="dsv-progress-indicator" style={{ width: "66%" }} />
    </Progress.Root>
    <div className="dsv-inline"><span className="dsv-spinner" /> <span className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>Loading</span></div>
  </div>
);

const LoginCard = () => (
  <div className="dsv-card dsv-card--raised">
    <div style={{ fontSize: "var(--font-size-lg)", fontWeight: "var(--font-weight-semibold)", marginBottom: "var(--space-1)" }}>Sign in</div>
    <div className="dsv-muted" style={{ fontSize: "var(--font-size-sm)", marginBottom: "var(--space-4)" }}>Access your account</div>
    <div className="cmp-stack">
      <Field label="Email" id="lc-e"><input id="lc-e" className="dsv-input" placeholder="ada@example.com" /></Field>
      <Field label="Password" id="lc-p"><input id="lc-p" className="dsv-input" type="password" placeholder="••••••••" /></Field>
      <Button style={{ width: "100%" }}>Continue</Button>
    </div>
  </div>
);

export const REGISTRY = [
  { id: "button", label: "Button", Render: Buttons },
  { id: "input", label: "Input", Render: Inputs },
  { id: "controls", label: "Checkbox / Radio / Switch", Render: Controls },
  { id: "slider", label: "Slider", Render: Sliders },
  { id: "select", label: "Select", Render: Selects },
  { id: "card", label: "Card", Render: Cards },
  { id: "badge", label: "Badge / Callout", Render: Badges },
  { id: "tabs", label: "Tabs", Render: Tabbed },
  { id: "accordion", label: "Accordion", Render: Accord },
  { id: "progress", label: "Progress / Spinner", Render: Progressy },
  { id: "login", label: "Login card", Render: LoginCard },
];

// ── data ──
const isStaticHost = () => location.hostname.includes("github.io") || location.protocol === "file:";
async function fetchSystems() {
  if (!isStaticHost()) {
    try {
      const res = await fetch("/api/systems");
      if (res.ok) return res.json();
    } catch {}
  }
  try { const raw = localStorage.getItem("dsv.systems"); if (raw !== null) return JSON.parse(raw); } catch {}
  try { const r = await fetch("../systems/index.json"); if (r.ok) return r.json(); } catch {}
  try { const r = await fetch("./systems/index.json"); if (r.ok) return r.json(); } catch {}
  return [];
}
const tokenStyle = (system) =>
  Object.fromEntries((system.groups || []).flatMap((g) => g.tokens).map((t) => [t.name, t.value]));
const isColor = (v) => /^(#|rgb|hsl|oklch|color\()/i.test(String(v).trim()) || /^[a-z]+$/i.test(String(v).trim());

// ── token diff table ──
function DiffTable({ cols }) {
  const [onlyDiff, setOnlyDiff] = useState(true);

  // merge category structure + per-system value maps
  const { catOrder, byCat, valueMaps } = useMemo(() => {
    const catOrder = [];
    const byCat = new Map();       // label -> Set(name)
    const nameCat = new Map();     // name -> label
    const valueMaps = cols.map((s) => {
      const m = new Map();
      for (const g of s.groups || []) {
        if (!byCat.has(g.label)) { byCat.set(g.label, new Set()); catOrder.push(g.label); }
        for (const t of g.tokens) {
          m.set(t.name, t.value);
          if (!nameCat.has(t.name)) { nameCat.set(t.name, g.label); byCat.get(g.label).add(t.name); }
        }
      }
      return m;
    });
    for (const [name, label] of nameCat) byCat.get(label).add(name);
    return { catOrder, byCat, valueMaps };
  }, [cols]);

  let diffs = 0, total = 0;
  const sections = catOrder.map((label) => {
    const names = [...byCat.get(label)].sort();
    const rows = names.map((name) => {
      const vals = valueMaps.map((m) => m.get(name));
      const present = vals.filter((v) => v != null);
      const same = present.length === vals.length && present.every((v) => v === present[0]);
      total++;
      if (!same) diffs++;
      return { name, vals, same };
    }).filter((r) => !onlyDiff || !r.same);
    return rows.length ? { label, rows } : null;
  }).filter(Boolean);

  return (
    <div className="cmp-diff">
      <div className="cmp-diff-bar">
        <span className="dsv-muted"><b>{total}</b> tokens · <b>{diffs}</b> different · <b>{total - diffs}</b> same</span>
        <label className="dsv-control-label" style={{ fontSize: "var(--font-size-sm)" }}>
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
          only differences
        </label>
      </div>
      <table className="cmp-diff-table">
        <thead>
          <tr><th>token</th>{cols.map((s) => <th key={s.slug}>{s.name}</th>)}</tr>
        </thead>
        <tbody>
          {sections.map(({ label, rows }) => (
            <Fragment key={label}>
              <tr className="cmp-diff-cat"><td colSpan={cols.length + 1}>{label}</td></tr>
              {rows.map(({ name, vals, same }) => (
                <tr key={name} className={same ? "" : "is-diff"}>
                  <td className="cmp-diff-name">{name}</td>
                  {vals.map((v, i) => (
                    <td key={i} className="cmp-diff-val">
                      {v == null ? <span className="cmp-diff-missing">—</span> : (
                        <span className="cmp-diff-cell">
                          {isColor(v) && <span className="cmp-diff-chip" style={{ background: v }} />}
                          <code>{v}</code>
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      {!sections.length && <p className="dsv-muted" style={{ padding: "var(--space-4)" }}>No differences — selected systems match on these tokens.</p>}
    </div>
  );
}

// ── screen ──
const Q = new URLSearchParams(location.search);

export default function Compare() {
  const [systems, setSystems] = useState(null);
  const [error, setError] = useState(null);
  const [picked, setPicked] = useState(() => (Q.get("cmp") ? Q.get("cmp").split(",").filter(Boolean) : []));
  const [componentId, setComponentId] = useState(Q.get("c") || "button");
  const [view, setView] = useState(Q.get("v") === "diff" ? "diff" : "component");
  // no theme toggle — each column uses its system's own --color-bg, isolated

  useEffect(() => {
    fetchSystems()
      .then((all) => {
        setSystems(all);
        setPicked((cur) => {
          const valid = cur.filter((slug) => all.some((s) => s.slug === slug));
          return valid.length ? valid : all.slice(0, 2).map((s) => s.slug);
        });
      })
      .catch((e) => setError(String(e.message || e)));
  }, []);

  // Mirror shareable state into this frame's URL and up to the parent shell.
  useEffect(() => {
    if (!systems) return;
    const p = new URLSearchParams({ mode: "compare" });
    if (picked.length) p.set("cmp", picked.join(","));
    if (view !== "component") p.set("v", view);
    if (componentId !== "button") p.set("c", componentId);
    history.replaceState(null, "", `?${p}`);
    try {
      parent.postMessage(
        { type: "dsv:compare-state", cmp: picked.join(","), v: view, c: componentId },
        location.origin === "null" ? "*" : location.origin,
      );
    } catch {}
  }, [systems, picked, view, componentId]);

  const styleFor = useMemo(() => {
    const map = {};
    for (const s of systems || []) {
      const base = tokenStyle(s);
      map[s.slug] = base;
    }
    return map;
  }, [systems]);

  useEffect(() => {
    const cols = (systems || []).filter((s) => picked.includes(s.slug));
    loadGoogleFonts(cols.map((s) => s.css).join("\n"));
  }, [systems, picked]);

  if (error) return <div className="dsv-main"><div className="dsv-err">Failed to load systems ({error}).</div></div>;
  if (!systems) return <div className="dsv-main"><p className="dsv-muted">Loading…</p></div>;
  if (!systems.length) return <div className="dsv-main"><div className="dsv-err">Add at least one system to compare.</div></div>;

  const cols = systems.filter((s) => picked.includes(s.slug));
  const active = REGISTRY.find((r) => r.id === componentId) || REGISTRY[0];
  const toggle = (slug) =>
    setPicked((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug].slice(-4)));

  return (
    <div className="cmp-wrap">
      <header className="cmp-toolbar">
        <div className="cmp-seg">
          <button className={view === "component" ? "on" : ""} onClick={() => setView("component")}>Component</button>
          <button className={view === "diff" ? "on" : ""} onClick={() => setView("diff")}>Token diff</button>
        </div>
        {view === "component" && (
          <label className="cmp-field">
            Component
            <select value={componentId} onChange={(e) => setComponentId(e.target.value)} className="cmp-select">
              {REGISTRY.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
        )}
        <div className="cmp-systems">
          {systems.map((s) => (
            <label key={s.slug} className={`cmp-chip ${picked.includes(s.slug) ? "on" : ""}`}>
              <input type="checkbox" checked={picked.includes(s.slug)} onChange={() => toggle(s.slug)} />
              {s.name}
            </label>
          ))}
        </div>
        <span className="cmp-hint dsv-muted">max 4 systems</span>
      </header>

      {cols.length < 2 ? (
        <div className="dsv-main"><p className="dsv-muted">Select at least 2 systems to compare.</p></div>
      ) : view === "diff" ? (
        <DiffTable cols={cols} />
      ) : (
        <div className="cmp-cols" data-count={cols.length}>
          {cols.map((s) => (
            <section key={s.slug} className="cmp-col" style={styleFor[s.slug]}>
              <h3 className="cmp-col-head">
                <span className="cmp-swatch" style={{ background: "var(--color-accent)" }} />
                {s.name}
                <span className="cmp-cov">{s.coverage ? `${Math.round((s.coverage.present / s.coverage.expected) * 100)}%` : ""}</span>
              </h3>
              <div className="cmp-col-body"><active.Render /></div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
