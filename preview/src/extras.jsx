import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Button, Demo, Icon } from "./ui.jsx";

const Section = ({ id, title, desc, children }) => (
  <section className="dsv-section" id={id}>
    <h2>{title}</h2>
    <p>{desc}</p>
    {children}
  </section>
);

function ListItem({ label, initial }) {
  const [on, setOn] = useState(initial);
  return (
    <div className={`dsv-list-item ${on ? "is-selected" : ""}`} onClick={() => setOn((v) => !v)} role="option" aria-selected={on} tabIndex={0}>
      <span className="dsv-check" data-state={on ? "checked" : "unchecked"} style={{ width: 16, height: 16 }}>{on && <Icon name="check" size={12} />}</span>
      {label}
    </div>
  );
}

function InteractiveTableDemo() {
  const base = [
    ["react", "18.3.1", "6.4 kB"],
    ["@radix-ui/react-dialog", "1.1.4", "12 kB"],
    ["vite", "5.4.11", "—"],
    ["eslint", "9.14.0", "3.1 kB"],
    ["typescript", "5.6.3", "8.8 kB"],
  ];
  const [sort, setSort] = useState({ col: 0, dir: 1 });
  const [selected, setSelected] = useState(["vite"]);
  const [compact, setCompact] = useState(false);
  const rows = useMemo(() => {
    const r = [...base];
    r.sort((a, b) => String(a[sort.col]).localeCompare(String(b[sort.col])) * sort.dir);
    return r;
  }, [sort]);
  const toggleSort = (col) => setSort((s) => s.col === col ? { col, dir: -s.dir } : { col, dir: 1 });
  const toggleRow = (name) => setSelected((s) => s.includes(name) ? s.filter((x) => x !== name) : [...s, name]);
  return (
    <div style={{ width: "100%", maxWidth: 520 }}>
      <label className="dsv-control-label" style={{ fontSize: "var(--font-size-xs)", marginBottom: "var(--space-2)" }}>
        <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} /> compact density
      </label>
      <div className="dsv-table-wrap" style={{ maxHeight: 240, overflowY: "auto" }}>
        <table className="dsv-table dsv-table--zebra" style={compact ? { fontSize: "var(--font-size-xs)" } : undefined}>
          <thead><tr>
            {["Package", "Version", "Size", ""].map((h, i) => (
              <th key={h} onClick={() => i < 3 && toggleSort(i)} style={i < 3 ? { cursor: "pointer" } : undefined}>
                {h}{i < 3 && sort.col === i ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className={selected.includes(r[0]) ? "is-selected" : ""}>
                <td className="dsv-mono">{r[0]}</td><td>{r[1]}</td>
                <td style={compact ? { paddingTop: "var(--space-1)", paddingBottom: "var(--space-1)" } : undefined}>{r[2]}</td>
                <td><input type="checkbox" checked={selected.includes(r[0])} onChange={() => toggleRow(r[0])} aria-label={`Select ${r[0]}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───────────────────────────────────────── Data display
export function DataDisplaySection() {
  const [tags, setTags] = useState(["design", "tokens", "radix", "preview"]);
  return (
    <Section id="data-display" title="Data display" desc="Styled with tokens — not in Radix Primitives, built from theme variables.">
      <Demo title="Table — interactive (sort, select, sticky)">
        <InteractiveTableDemo />
      </Demo>

      <Demo title="Multi-select list (selected)">
        <div style={{ minWidth: 220 }}>
          {[["Design tokens", true], ["Component preview", true], ["Compare mode", false], ["Dark variant", false]].map(([label, init]) => (
            <ListItem key={label} label={label} initial={init} />
          ))}
        </div>
      </Demo>

      <Demo title="Card — tint wash & colored shadow">
        <div className="dsv-card dsv-card--tint" style={{ maxWidth: 300 }}>
          <div style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-sm)" }}>Tint wash card</div>
          <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>background: --color-tint-subtle</div>
        </div>
        <div className="dsv-card dsv-card--lift" style={{ maxWidth: 300 }}>
          <div style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-sm)" }}>Hover to lift</div>
          <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>shadow + --color-shadow tint</div>
        </div>
      </Demo>

      <Demo title="Data list">
        <dl className="dsv-datalist">
          <dt>Status</dt><dd><span className="dsv-badge dsv-badge--success">Active</span></dd>
          <dt>Plan</dt><dd>Pro (yearly)</dd>
          <dt>Renewal</dt><dd>Jan 12, 2027</dd>
          <dt>Seats</dt><dd>8 / 10</dd>
        </dl>
      </Demo>

      <Demo title="Stat cards">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "var(--space-3)" }}>
          <div className="dsv-stat"><div className="k">MRR</div><div className="v">$124k</div><div className="d up">▲ 8.2%</div></div>
          <div className="dsv-stat"><div className="k">Churn</div><div className="v">1.9%</div><div className="d down">▼ 0.4%</div></div>
          <div className="dsv-stat"><div className="k">NPS</div><div className="v">62</div><div className="d up">▲ 5</div></div>
        </div>
      </Demo>

      <Demo title="Stat — hero numbers">
        <div className="dsv-inline" style={{ gap: "var(--space-8)", alignItems: "baseline", flexWrap: "wrap" }}>
          <div>
            <div className="dsv-display dsv-display--4xl">$124k</div>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>MRR · bold / tight / tight tracking</div>
          </div>
          <div>
            <div className="dsv-display dsv-display--3xl">84%</div>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>adoption</div>
          </div>
          <p className="dsv-lede" style={{ margin: 0, flexBasis: "100%" }}>Lede line — snug leading, secondary text.</p>
        </div>
      </Demo>

      <Demo title="Code">
        <div style={{ maxWidth: 460, width: "100%" }}>
          <pre className="dsv-code">{`npm run build\n# creates preview/dist/\nnpm start`}</pre>
          <p style={{ fontSize: "var(--font-size-sm)", marginTop: "var(--space-2)" }}>
            Inline: <code className="dsv-code-inline">--color-accent</code> token.
          </p>
        </div>
      </Demo>

      <Demo title="Quote">
        <blockquote className="dsv-quote" style={{ maxWidth: 460 }}>
          “Good typography is invisible — until the wrong font makes it visible.”
          <cite>— design systems, everywhere</cite>
        </blockquote>
      </Demo>

      <Demo title="Tag / Chip (removable)">
        {tags.map((t) => (
          <span key={t} className="dsv-tag">
            {t}
            <button aria-label={`${t} remove`} onClick={() => setTags((xs) => xs.filter((x) => x !== t))}><Icon name="x" size={12} /></button>
          </span>
        ))}
        {!tags.length && <span className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>all removed</span>}
      </Demo>

      <Demo title="Timeline">
        <ul className="dsv-timeline" style={{ maxWidth: 360 }}>
          {[["Repo created", "3 days ago"], ["First commit", "3 days ago"], ["CI configured", "2 days ago"], ["v0.1.0 released", "today"]].map(([b, w]) => (
            <li key={b}><span className="node" /><div><div className="body">{b}</div><div className="when">{w}</div></div></li>
          ))}
        </ul>
      </Demo>
    </Section>
  );
}

// ───────────────────────────────────────── Status & loading
export function StatusSection() {
  const [banner, setBanner] = useState(true);
  return (
    <Section id="status" title="Status & loading" desc="Callout, banner, empty state, skeleton, spinner.">
      <Demo title="Callout">
        <div className="dsv-stack" style={{ maxWidth: 460, width: "100%" }}>
          <div className="dsv-callout dsv-callout--info"><span className="ico"><Icon name="bell" size={16} /></span><div>New version available. <a className="dsv-link" href="#status">Update from Settings.</a></div></div>
          <div className="dsv-callout dsv-callout--success"><span className="ico"><Icon name="check" size={16} /></span><div>Payment received. Invoice sent via email.</div></div>
          <div className="dsv-callout dsv-callout--warning"><span className="ico"><Icon name="bell" size={16} /></span><div>Your API key expires in 7 days.</div></div>
          <div className="dsv-callout dsv-callout--danger"><span className="ico"><Icon name="x" size={16} /></span><div>3 services not responding. Check status page.</div></div>
        </div>
      </Demo>

      <Demo title="Banner (dismissible)">
        {banner
          ? <div className="dsv-banner" style={{ maxWidth: 460, width: "100%" }}>
              <Icon name="bell" size={14} /> Friday 02:00–04:00 maintenance window.
              <button className="close" aria-label="Close" onClick={() => setBanner(false)}><Icon name="x" size={14} /></button>
            </div>
          : <Button variant="ghost" size="sm" onClick={() => setBanner(true)}>Restore banner</Button>}
      </Demo>

      <Demo title="Empty state">
        <div className="dsv-card" style={{ maxWidth: 460, width: "100%" }}>
          <div className="dsv-empty">
            <span className="glyph"><Icon name="search" size={24} /></span>
            <h4>No results</h4>
            <p>No matching records found for "lorem ipsum".</p>
            <Button variant="soft" size="sm">Clear filters</Button>
          </div>
        </div>
      </Demo>

      <Demo title="Skeleton">
        <div className="dsv-card" style={{ width: 300 }}>
          <div className="dsv-inline" style={{ marginBottom: "var(--space-3)" }}>
            <div className="dsv-skeleton" style={{ width: 40, height: 40, borderRadius: "var(--radius-full)" }} />
            <div style={{ flex: 1 }}>
              <div className="dsv-skeleton" style={{ height: 10, width: "60%", marginBottom: 6 }} />
              <div className="dsv-skeleton" style={{ height: 10, width: "40%" }} />
            </div>
          </div>
          <div className="dsv-skeleton" style={{ height: 10, marginBottom: 6 }} />
          <div className="dsv-skeleton" style={{ height: 10, marginBottom: 6 }} />
          <div className="dsv-skeleton" style={{ height: 10, width: "80%" }} />
        </div>
      </Demo>

      <Demo title="Spinner">
        <span className="dsv-spinner" />
        <Button disabled><span className="dsv-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Loading</Button>
      </Demo>

      <Demo title="Motion — instant toggle">
        <MotionInstantDemo />
      </Demo>

      <Demo title="File list">
        <div style={{ minWidth: 260 }}>
          {[["report.pdf", "2.4 MB", "done"], ["data.csv", "812 KB", "done"], ["video.mp4", "48%", "busy"]].map(([name, meta, st]) => (
            <div key={name} className="dsv-list-item" style={{ cursor: "default" }}>
              <Icon name="file" size={16} />
              <span style={{ flex: 1 }}>{name}</span>
              {st === "busy"
                ? <span className="dsv-inline"><span className="dsv-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /><span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>{meta}</span></span>
                : <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>{meta}</span>}
            </div>
          ))}
        </div>
      </Demo>
    </Section>
  );
}

function MotionInstantDemo() {
  const [instant, setInstant] = useState(false);
  return (
    <div className="dsv-inline" style={{ gap: "var(--space-4)" }}>
      <span className="dsv-spinner" style={instant ? { animationDuration: "var(--duration-instant)" } : undefined} />
      <label className="dsv-control-label" style={{ fontSize: "var(--font-size-xs)" }}>
        <input type="checkbox" checked={instant} onChange={(e) => setInstant(e.target.checked)} /> --duration-instant
      </label>
      <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>easing: var(--ease-linear) → var(--ease-spring)</span>
      <span className="dsv-inline" style={{ transition: "opacity var(--duration-fast) var(--ease-linear), transform var(--duration-normal) var(--ease-spring)" }}>preview</span>
    </div>
  );
}

// ───────────────────────────────────────── Navigation extras
export function NavExtrasSection() {
  const [page, setPage] = useState(3);
  const [seg, setSeg] = useState("week");
  return (
    <Section id="nav-extras" title="Navigation extras" desc="Breadcrumb, pagination, steps, segmented control, button group.">
      <Demo title="Breadcrumb">
        <nav className="dsv-breadcrumb">
          <a className="dsv-link" href="#data-display" style={{ textDecoration: "none" }}>Home</a><Icon name="chevronRight" size={12} />
          <a className="dsv-link" href="#data-display" style={{ textDecoration: "none" }}>Projects</a><Icon name="chevronRight" size={12} />
          <span aria-current="page">design-system-viewer</span>
        </nav>
      </Demo>
      <Demo title="Prose links">
        <p className="dsv-prose" style={{ margin: 0 }}>
          Read the <a className="dsv-link" href="#patterns">patterns guide</a>, then open the
          {" "}<a className="dsv-link" href="#data-display">component index</a> to see every token in context.
        </p>
      </Demo>

      <Demo title="Pagination">
        <div className="dsv-pagination">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous"><Icon name="chevronLeft" size={14} /></button>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} aria-current={n === page ? "page" : undefined} onClick={() => setPage(n)}>{n}</button>
          ))}
          <button disabled={page === 5} onClick={() => setPage((p) => p + 1)} aria-label="Next"><Icon name="chevronRight" size={14} /></button>
        </div>
      </Demo>

      <Demo title="Steps">
        <div className="dsv-steps">
          {[["Account", "done"], ["Profile", "done"], ["Plan", "active"], ["Confirm", ""]].map(([label, st], i, arr) => (
            <div key={label} className={`dsv-step ${st === "done" ? "dsv-step--done" : st === "active" ? "dsv-step--active" : ""}`}>
              <span className="dot">{st === "done" ? <Icon name="check" size={12} /> : i + 1}</span>{label}
              {i < arr.length - 1 && <span className="bar" />}
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="Segmented control">
        <div className="dsv-segmented">
          {[["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([v, l]) => (
            <button key={v} aria-pressed={seg === v} onClick={() => setSeg(v)}>{l}</button>
          ))}
        </div>
      </Demo>

      <Demo title="Button group">
        <div className="dsv-btn-group">
          <Button variant="outline" size="sm"><Icon name="alignLeft" size={14} /></Button>
          <Button variant="outline" size="sm"><Icon name="alignCenter" size={14} /></Button>
          <Button variant="outline" size="sm"><Icon name="alignRight" size={14} /></Button>
        </div>
        <Tooltip.Provider>
          <div className="dsv-btn-group">
            <Button variant="outline" size="sm">Save</Button>
            <Button variant="outline" size="sm" className="dsv-icon-btn"><Icon name="chevronDown" size={14} /></Button>
          </div>
        </Tooltip.Provider>
      </Demo>

      <Demo title="Footer links">
        <div className="dsv-inline" style={{ gap: "var(--space-4)", fontSize: "var(--font-size-sm)" }}>
          <a className="dsv-link" href="#nav-extras">Docs</a>
          <a className="dsv-link" href="#nav-extras">API</a>
          <a className="dsv-link" href="#nav-extras">Status</a>
          <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>© 2026 Acme</span>
        </div>
      </Demo>
    </Section>
  );
}

// ───────────────────────────────────────── Product patterns (non-Radix)
function CalendarDemo() {
  const [sel, setSel] = useState(14);
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  return (
    <div>
      <div className="dsv-inline" style={{ justifyContent: "space-between", maxWidth: 320, marginBottom: "var(--space-2)" }}>
        <strong style={{ fontSize: "var(--font-size-sm)" }}>June 2026</strong>
        <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>range 12–18 · today 9</span>
      </div>
      <div className="dsv-cal">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} className="dsv-cal-head">{d}</div>)}
        {days.map((d) => (
          <button
            key={d}
            className={`dsv-cal-day ${d === sel ? "is-selected" : ""} ${d === 9 ? "is-today" : ""} ${d >= 12 && d <= 18 ? "is-range" : ""}`}
            onClick={() => setSel(d)}
          >{d}</button>
        ))}
      </div>
    </div>
  );
}

function ComboboxDemo() {
  const all = ["Design tokens", "Component preview", "Compare mode", "Dark variant", "Command palette", "Analytics"];
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(["Compare mode"]);
  const opts = all.filter((o) => o.toLowerCase().includes(q.toLowerCase()) && !picked.includes(o));
  return (
    <Popover.Root>
      <div style={{ minWidth: 260 }}>
        <div className="dsv-row" style={{ marginBottom: "var(--space-2)" }}>
          {picked.map((t) => (
            <span key={t} className="dsv-tag">{t}<button aria-label={`${t} remove`} onClick={() => setPicked((xs) => xs.filter((x) => x !== t))}><Icon name="x" size={12} /></button></span>
          ))}
        </div>
        <Popover.Trigger asChild>
          <div className="dsv-input-wrap dsv-input-wrap--prefix" style={{ cursor: "text" }}>
            <span className="dsv-adorn dsv-adorn--prefix"><Icon name="search" size={14} /></span>
            <input className="dsv-input" placeholder="Search options…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="dsv-menu" sideOffset={6} align="start" style={{ minWidth: 260 }} onOpenAutoFocus={(e) => e.preventDefault()}>
            {opts.length === 0 && <div className="dsv-menu-label">No matches</div>}
            {opts.map((o) => (
              <div key={o} className="dsv-menu-item" onClick={() => { setPicked((p) => [...p, o]); setQ(""); }}>
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
      <button aria-label="Decrease" onClick={() => setN((v) => Math.max(0, v - 1))}>−</button>
      <input value={n} onChange={(e) => setN(Number(e.target.value) || 0)} aria-label="Quantity" inputMode="numeric" />
      <button aria-label="Increase" onClick={() => setN((v) => v + 1)}>+</button>
    </div>
  );
}

function RatingDemo() {
  const [v, setV] = useState(4);
  const [hov, setHov] = useState(0);
  return (
    <div className="dsv-rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} className={(hov || v) >= i ? "is-on" : ""} onClick={() => setV(i)} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(0)} aria-label={`${i} stars`}>
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
      <Button variant="outline" size="sm" onClick={() => { setDone(true); setTimeout(() => setDone(false), 1500); }}>
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
      <input className="dsv-input" value={val} onChange={(e) => setVal(e.target.value)} autoFocus style={{ minWidth: 200 }} />
      <Button size="sm" onClick={() => setEditing(false)}>Save</Button>
    </div>
  ) : (
    <div className="dsv-inline">
      <strong style={{ fontSize: "var(--font-size-sm)" }}>{val}</strong>
      <Button variant="ghost" size="sm" className="dsv-icon-btn" aria-label="Edit name" onClick={() => setEditing(true)}><Icon name="edit" size={14} /></Button>
    </div>
  );
}

function TreeDemo() {
  const [open, setOpen] = useState({ src: true, preview: true });
  const [sel, setSel] = useState("components.jsx");
  const t = (id, label, kids) => (
    <li key={id}>
      <div className={`dsv-tree-row ${sel === id ? "is-selected" : ""}`} onClick={() => { setSel(id); if (kids) setOpen((o) => ({ ...o, [id]: !o[id] })); }}>
        {kids && <Icon name="chevronRight" size={12} />}<Icon name="file" size={14} /> {label}
      </div>
      {kids && open[id] && <ul>{kids}</ul>}
    </li>
  );
  return (
    <ul className="dsv-tree" style={{ minWidth: 220 }}>
      {t("src", "src", <>{t("core", "core", <>{t("schema.js", "schema.js")}</>)} {t("preview", "preview", <>{t("components.jsx", "components.jsx")} {t("screens.jsx", "screens.jsx")}</>)}</>)}
    </ul>
  );
}

function DropzoneDemo() {
  const [st, setSt] = useState("idle");
  return (
    <div style={{ minWidth: 260 }}>
      <div className={`dsv-dropzone ${st === "over" ? "is-over" : ""} ${st === "done" ? "is-done" : ""}`}
        onMouseEnter={() => st === "idle" && setSt("over")}
        onMouseLeave={() => st === "over" && setSt("idle")}
        onClick={() => setSt(st === "done" ? "idle" : "done")}>
        {st === "done" ? "✓ report.pdf uploaded" : st === "over" ? "Drop to upload" : "Drag files here or browse"}
        <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", marginTop: "var(--space-1)" }}>idle / drag-over / done — inset well below</div>
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
        {bars.map((h, i) => <div key={i} className={`dsv-chart-bar ${i === 5 ? "dsv-chart-bar--hot" : ""}`} style={{ width: "var(--space-3)", height: h }} />)}
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

export function PatternsSection() {
  return (
    <Section id="patterns" title="Product patterns" desc="Non-Radix patterns every product needs — hand-built with tokens.">
      <Demo title="Calendar / date field"><CalendarDemo /></Demo>
      <Demo title="Combobox — multi-select tags"><ComboboxDemo /></Demo>
      <Demo title="Number stepper"><StepperDemo /></Demo>
      <Demo title="Rating"><RatingDemo /></Demo>
      <Demo title="Copy to clipboard"><CopyDemo /></Demo>
      <Demo title="Inline edit"><InlineEditDemo /></Demo>
      <Demo title="Avatar group"><AvatarGroupDemo /></Demo>
      <Demo title="Keyboard shortcuts">
        <table className="dsv-kbd-table" style={{ minWidth: 260 }}>
          <tbody>
            {[["Save", ["⌘", "S"]], ["Search", ["⌘", "K"]], ["Undo", ["⌘", "Z"]]].map(([label, keys]) => (
              <tr key={label}><td>{label}</td><td style={{ textAlign: "right" }}>{keys.map((k) => <kbd key={k} className="dsv-kbd" style={{ marginLeft: 4 }}>{k}</kbd>)}</td></tr>
            ))}
          </tbody>
        </table>
      </Demo>
      <Demo title="Tree view"><TreeDemo /></Demo>
      <Demo title="File dropzone"><DropzoneDemo /></Demo>
      <Demo title="Chart primitives"><ChartsDemo /></Demo>
    </Section>
  );
}

function AvatarGroupDemo() {
  return (
    <div className="dsv-avatar-group">
      {[13, 22, 31, 47].map((n) => (
        <span key={n} className="dsv-avatar" style={{ width: 32, height: 32 }}>
          <img src={`https://i.pravatar.cc/64?img=${n}`} alt="" loading="lazy" />
        </span>
      ))}
      <span className="dsv-avatar dsv-avatar-more" style={{ width: 32, height: 32 }}>+3</span>
    </div>
  );
}

export const EXTRA_SECTIONS = [
  { id: "patterns", label: "Product patterns", Comp: PatternsSection },
  { id: "data-display", label: "Data display", Comp: DataDisplaySection },
  { id: "status", label: "Status & loading", Comp: StatusSection },
  { id: "nav-extras", label: "Navigation extras", Comp: NavExtrasSection },
];
