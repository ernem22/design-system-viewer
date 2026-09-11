import { useEffect, useMemo, useRef, useState } from "react";
import * as Avatar from "@radix-ui/react-avatar";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Button, Demo, Icon, usePortalContainer } from "./ui.jsx";

// Live token value badge — reads the active system's computed value so the
// demo shows real numbers (480px, 20ch…) instead of hardcoded guesses.
// Reads its own computed style (not document.documentElement): custom
// properties inherit down the DOM, so this resolves correctly whether tokens
// live on :root (single-system Preview) or on an ancestor's inline style
// (Compare's per-column scope) — reading :root directly would always show
// the wrong (or fallback) column's value in Compare.
function VarVal({ name }) {
  const ref = useRef(null);
  const [val, setVal] = useState("");
  useEffect(() => {
    try {
      setVal(getComputedStyle(ref.current).getPropertyValue(name).trim());
    } catch { setVal(""); }
  }, [name]);
  if (!val) return <code ref={ref} className="dsv-code-inline" hidden />;
  return <code ref={ref} className="dsv-code-inline">{val}</code>;
}

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
    <div className={`dsv-list-item ${on ? "is-selected" : ""}`} onClick={() => setOn((v) => !v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOn((v) => !v); } }} role="option" aria-selected={on} tabIndex={0}>
      <span className="dsv-check dsv-check--static" data-state={on ? "checked" : "unchecked"}><Icon name="check" size={12} /></span>
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
  const allNames = rows.map((r) => r[0]);
  const allOn = selected.length === rows.length;
  return (
    <div style={{ width: "100%", maxWidth: 520 }}>
      <label className="dsv-control-label" style={{ fontSize: "var(--font-size-xs)", marginBottom: "var(--space-2)" }}>
        <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} /> compact density
      </label>
      <div className="dsv-table-wrap" style={{ maxHeight: 240, overflowY: "auto" }}>
        <table className="dsv-table dsv-table--zebra" style={compact ? { fontSize: "var(--font-size-xs)" } : undefined}>
          <thead><tr>
            {["Package", "Version", "Size"].map((h, i) => (
              <th key={h} onClick={() => toggleSort(i)} style={{ cursor: "pointer" }}>
                {h}{sort.col === i ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
              </th>
            ))}
            <th><input
              type="checkbox" checked={allOn} onChange={() => setSelected(allOn ? [] : allNames)} aria-label="Select all"
              ref={(el) => { if (el) el.indeterminate = selected.length > 0 && !allOn; }}
            /></th>
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
      <div className="dsv-inline" style={{ justifyContent: "space-between", marginTop: "var(--space-2)" }}>
        <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>{selected.length} of {rows.length} selected</span>
        {selected.length > 0 && <button className="dsv-btn dsv-btn--ghost dsv-btn--sm" style={{ minHeight: 28 }} onClick={() => setSelected([])}>Clear</button>}
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
        {[["dsv-card--tint", "Tint wash", "--color-tint-subtle", null], ["dsv-card--lift", "Hover to lift", "--color-shadow", "shadow-lg"], ["is-picked", "Selected", "--color-selected", "--color-accent-border"]].map(([cls, title, token, extra]) => (
          <div key={title} className="dsv-stack" style={{ gap: "var(--space-1)", maxWidth: 300 }}>
            <div className={`dsv-card ${cls === "is-picked" ? "" : cls}`} style={cls === "is-picked" ? { borderColor: "var(--color-accent-border)", background: "var(--color-selected)" } : undefined}>
              <div style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-sm)" }}>{title}{extra === "shadow-lg" ? " — hover me" : ""}</div>
              <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>{token}{extra && extra !== "shadow-lg" ? ` · ${extra}` : ""}</div>
            </div>
            <code className="dsv-code-inline" style={{ alignSelf: "flex-start" }}>{cls === "is-picked" ? "accent-border + selected" : `.${cls}`}</code>
          </div>
        ))}
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "var(--space-3)", width: "100%" }}>
          {[["MRR", "$124k", "▲ 8.2%", "up", "M0,26 L12,22 L24,23 L36,14 L48,16 L60,6"], ["Churn", "1.9%", "▼ 0.4%", "down", "M0,8 L12,10 L24,9 L36,16 L48,15 L60,22"], ["NPS", "62", "▲ 5", "up", "M0,24 L12,20 L24,21 L36,14 L48,15 L60,8"], ["Active", "8.412", "▲ 2.1%", "up", "M0,22 L12,18 L24,19 L36,12 L48,13 L60,5"]].map(([k, v, d, dir, line]) => (
            <div key={k} className="dsv-stat">
              <div className="k">{k}</div><div className="v">{v}</div>
              <div className={`d ${dir}`}>{d}</div>
              <svg width="100%" height="28" viewBox="0 0 60 30" preserveAspectRatio="none" role="img" aria-label={`${k} trend`} style={{ marginTop: "var(--space-2)", display: "block" }}>
                <path d={line} fill="none" stroke={dir === "up" ? "var(--color-success)" : "var(--color-danger)"} strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          ))}
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

      <Demo title="Type — display sizes">
        <div style={{ width: "100%" }}>
          <div className="dsv-display dsv-display--6xl">6xl display</div>
          <div className="dsv-display dsv-display--7xl">7xl display</div>
          <div className="dsv-display dsv-display--dxs">Display xs</div>
          <div className="dsv-display dsv-display--dsm">Display sm</div>
          <div className="dsv-display dsv-display--dmd">Display md</div>
          <div className="dsv-display dsv-display--dlg">Display lg</div>
          <div className="dsv-display dsv-display--dxl">Display xl</div>
          <div className="dsv-light" style={{ fontSize: "var(--font-size-lg)", marginTop: "var(--space-2)" }}>Light weight sample (--font-weight-light)</div>
          <div className="dsv-tracking-wider" style={{ fontSize: "var(--font-size-sm)", marginTop: "var(--space-1)" }}>WIDER TRACKING SAMPLE (--letter-spacing-wider)</div>
          <div className="dsv-tracking-tighter" style={{ fontSize: "var(--font-size-sm)", marginTop: "var(--space-1)" }}>Tighter tracking sample (--letter-spacing-tighter)</div>
          <div className="dsv-leading-loose" style={{ fontSize: "var(--font-size-sm)", marginTop: "var(--space-1)" }}>Loose leading<br />second line (--line-height-loose)</div>
          <div className="dsv-leading-none" style={{ fontSize: "var(--font-size-sm)", marginTop: "var(--space-1)" }}>None leading<br />second line (--line-height-none)</div>
        </div>
      </Demo>

      <Demo title="Neutral ramp">
        {/* tokenUsage: var(--color-neutral-50) var(--color-neutral-100) var(--color-neutral-200) var(--color-neutral-300) var(--color-neutral-400) var(--color-neutral-500) var(--color-neutral-600) var(--color-neutral-700) var(--color-neutral-800) var(--color-neutral-900) var(--color-neutral-950) var(--color-neutral-1000) */}
        <div className="dsv-inline" style={{ flexWrap: "wrap", gap: "var(--space-2)" }}>
          {["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950", "1000"].map((s) => (
            <span key={s} className="dsv-neutral-chip">
              <span style={{ width: "var(--space-6)", height: "var(--space-6)", borderRadius: "var(--radius-md)", background: `var(--color-neutral-${s})`, border: "var(--border-width-thin) solid var(--color-border)" }} />
              {s}
            </span>
          ))}
          <span className="dsv-neutral-chip">
            <span style={{ width: "var(--space-6)", height: "var(--space-6)", borderRadius: "var(--radius-md)", background: "var(--color-accent-secondary)" }} />
            secondary
          </span>
        </div>
        {/* tokenUsage: var(--color-brand-50) var(--color-brand-100) var(--color-brand-200) var(--color-brand-300) var(--color-brand-400) var(--color-brand-500) var(--color-brand-600) var(--color-brand-700) var(--color-brand-800) var(--color-brand-900) */}
        <div className="dsv-inline" style={{ flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
          {["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"].map((s) => (
            <span key={s} className="dsv-neutral-chip">
              <span style={{ width: "var(--space-6)", height: "var(--space-6)", borderRadius: "var(--radius-md)", background: `var(--color-brand-${s})`, border: "var(--border-width-thin) solid var(--color-border)" }} />
              {s}
            </span>
          ))}
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
        <Button disabled><span className="dsv-spinner dsv-spinner--sm" /> Loading</Button>
      </Demo>

      <Demo title="Motion — instant toggle">
        <MotionInstantDemo />
      </Demo>

      <Demo title="Motion — duration scale">
        <div className="dsv-dur-list">
          {DURATION_SCALE.map((d) => (
            <div key={d.label} className="dsv-dur-row" title={`${d.label} — ${d.token}`}>
              <span className="dsv-dur-dot" style={{ animationDuration: d.token }} aria-hidden="true" />
              <span className="dsv-dur-meta">
                <strong>{d.label}</strong>
                <code className="dsv-code-inline">{d.token}</code>
              </span>
              <span className="dsv-dur-track" aria-hidden="true">
                <span className="dsv-dur-fill" style={{ animationDuration: d.token }} />
              </span>
              <VarVal name={d.name} />
            </div>
          ))}
        </div>
        <p className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", margin: "var(--space-2) 0 0" }}>
          Dot blinks and bar slides on the real token — instant jumps, slowest glides.
        </p>
      </Demo>

      <Demo title="File list">
        <div style={{ minWidth: 260 }}>
          {[["report.pdf", "2.4 MB", "done"], ["data.csv", "812 KB", "done"], ["video.mp4", "48%", "busy"]].map(([name, meta, st]) => (
            <div key={name} className="dsv-list-item" style={{ cursor: "default" }}>
              <Icon name="file" size={16} />
              <span style={{ flex: 1 }}>{name}</span>
              {st === "busy"
                ? <span className="dsv-inline"><span className="dsv-spinner dsv-spinner--xs" /><span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>{meta}</span></span>
                : <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>{meta}</span>}
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="Blur / outline / bounce">
        <div className="dsv-blur-grid">
          <div className="dsv-blur-card">
            <div className="dsv-blur-card-title">Blur scale</div>
            <div className="dsv-inline" style={{ gap: "var(--space-3)", flexWrap: "wrap" }}>
              {[["sm", "--blur-sm"], ["md", "--blur-md"], ["lg", "--blur-lg"], ["xl", "--blur-xl"]].map(([s, token]) => (
                <span key={s} className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
                  <span className="dsv-blur-tile-wrap" aria-hidden="true">
                    <span className="dsv-blur-tile-bg">Aa</span>
                    <span className={`dsv-blur-tile-fg dsv-blur-${s}`}>Aa</span>
                  </span>
                  <code className="dsv-code-inline">{s}</code>
                  <VarVal name={token} />
                </span>
              ))}
            </div>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>backdrop &amp; filter blur ramp</div>
          </div>
          <div className="dsv-blur-card dsv-outline-card">
            <div className="dsv-blur-card-title">Outline &amp; focus</div>
            <div className="dsv-inline" style={{ gap: "var(--space-3)", flexWrap: "wrap" }}>
              <span className="dsv-outline-chip">--shadow-outline</span>
              <button className="dsv-btn dsv-btn--outline dsv-btn--sm dsv-focus-demo">Tab to focus</button>
            </div>
            <div className="dsv-inline" style={{ gap: "var(--space-1)", flexWrap: "wrap" }}>
              <VarVal name="--shadow-outline" />
              <VarVal name="--color-focus-ring" />
            </div>
          </div>
          <div className="dsv-blur-card">
            <div className="dsv-blur-card-title">Bounce &amp; press</div>
            <div className="dsv-inline" style={{ gap: "var(--space-4)", flexWrap: "wrap" }}>
              <span className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
                <span className="dsv-inline" style={{ gap: "var(--space-2)", alignItems: "flex-end" }}>
                  <span className="dsv-bounce-dot dsv-bounce-dot--sm" />
                  <span className="dsv-bounce-dot" />
                  <span className="dsv-bounce-dot dsv-bounce-dot--lg" />
                </span>
                <VarVal name="--ease-bounce" />
              </span>
              <span className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
                <span className="dsv-hover-fade dsv-tag">hover to fade</span>
                <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>--opacity-hover</span>
              </span>
              <span className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
                <button className="dsv-btn dsv-btn--soft dsv-btn--sm dsv-pressable">press me</button>
                <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>--motion-scale-active</span>
              </span>
            </div>
          </div>
        </div>
      </Demo>
    </Section>
  );
}

const DURATION_SCALE = [
  { label: "instant", name: "--duration-instant", token: "var(--duration-instant)" },
  { label: "fast", name: "--duration-fast", token: "var(--duration-fast)" },
  { label: "normal", name: "--duration-normal", token: "var(--duration-normal)" },
  { label: "slow", name: "--duration-slow", token: "var(--duration-slow)" },
  { label: "slower", name: "--duration-slower", token: "var(--duration-slower)" },
  { label: "slowest", name: "--duration-slowest", token: "var(--duration-slowest)" },
];

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
        <div className="dsv-steps" role="list" aria-label="Checkout progress">
          {[["Account", "done"], ["Profile", "done"], ["Plan", "active"], ["Confirm", ""]].map(([label, st], i, arr) => (
            <div key={label} role="listitem" aria-current={st === "active" ? "step" : undefined} className={`dsv-step ${st === "done" ? "dsv-step--done" : st === "active" ? "dsv-step--active" : ""}`}>
              <span className="dot">{st === "done" ? <Icon name="check" size={12} /> : i + 1}</span><span className="label">{label}</span>
              {i < arr.length - 1 && <span className="bar" aria-hidden="true" />}
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
        <div className="dsv-btn-group">
          <Button variant="solid" size="lg"><Icon name="alignLeft" size={16} /></Button>
          <Button variant="solid" size="lg"><Icon name="alignCenter" size={16} /></Button>
          <Button variant="solid" size="lg"><Icon name="alignRight" size={16} /></Button>
        </div>
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
  const [offset, setOffset] = useState(0);
  const [sel, setSel] = useState(14);
  const base = new Date(2026, 5 + offset, 1);
  const year = base.getFullYear(), month = base.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const title = base.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const isJune = offset === 0;
  const pick = (d) => setSel(d);
  return (
    <div>
      <div className="dsv-inline" style={{ justifyContent: "space-between", maxWidth: 320, marginBottom: "var(--space-2)" }}>
        <strong style={{ fontSize: "var(--font-size-sm)" }}>{title}</strong>
        <span className="dsv-inline" style={{ gap: "var(--space-1)" }}>
          <button className="dsv-btn dsv-btn--ghost dsv-btn--sm dsv-icon-btn" aria-label="Previous month" onClick={() => setOffset((o) => o - 1)}><Icon name="chevronLeft" size={14} /></button>
          <button className="dsv-btn dsv-btn--ghost dsv-btn--sm" onClick={() => { setOffset(0); setSel(9); }}>Today</button>
          <button className="dsv-btn dsv-btn--ghost dsv-btn--sm dsv-icon-btn" aria-label="Next month" onClick={() => setOffset((o) => o + 1)}><Icon name="chevronRight" size={14} /></button>
        </span>
      </div>
      {isJune && <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", marginBottom: "var(--space-2)" }}>range 12–18 · today 9</div>}
      <div className="dsv-cal">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} className="dsv-cal-head">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
          <button
            key={`${year}-${month}-${d}`}
            type="button"
            aria-pressed={d === sel}
            aria-label={`${title} ${d}`}
            className={`dsv-cal-day ${d === sel ? "is-selected" : ""} ${isJune && d === 9 ? "is-today" : ""} ${isJune && d >= 12 && d <= 18 ? "is-range" : ""}`}
            onClick={() => pick(d)}
          >{d}</button>
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
            <span key={t} className="dsv-tag">{t}<button aria-label={`${t} remove`} onClick={() => setPicked((xs) => xs.filter((x) => x !== t))}><Icon name="x" size={12} /></button></span>
          ))}
        </div>
        <Popover.Trigger asChild>
          <div className="dsv-input-wrap dsv-input-wrap--prefix" style={{ cursor: "text" }}>
            <span className="dsv-adorn dsv-adorn--prefix"><Icon name="search" size={14} /></span>
            <input className="dsv-input" placeholder="Search options…" aria-label="Search options" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </Popover.Trigger>
        <Popover.Portal container={portalContainer}>
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
      <div
        className={`dsv-tree-row ${sel === id ? "is-selected" : ""} ${kids && open[id] ? "is-open" : ""}`}
        role="treeitem"
        aria-expanded={kids ? !!open[id] : undefined}
        aria-selected={sel === id}
        tabIndex={0}
        onClick={() => { setSel(id); if (kids) setOpen((o) => ({ ...o, [id]: !o[id] })); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(id); if (kids) setOpen((o) => ({ ...o, [id]: !o[id] })); } }}
      >
        {kids && <Icon name="chevronRight" size={12} />}<Icon name="file" size={14} /> {label}
      </div>
      {kids && open[id] && <ul role="group">{kids}</ul>}
    </li>
  );
  return (
    <ul className="dsv-tree" role="tree" aria-label="Project files" style={{ minWidth: 220 }}>
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
            {[["Save", ["⌘", "S"]], ["Search commands", ["⌘", "K"]], ["Undo", ["⌘", "Z"]], ["New project", ["⌘", "N"]], ["Delete", ["⌫"]], ["Toggle sidebar", ["⌘", "B"]]].map(([label, keys]) => (
              <tr key={label}><td>{label}</td><td style={{ textAlign: "right" }}>{keys.map((k) => <kbd key={k} className="dsv-kbd" style={{ marginLeft: 4 }}>{k}</kbd>)}</td></tr>
            ))}
          </tbody>
        </table>
      </Demo>
      <Demo title="Tree view"><TreeDemo /></Demo>
      <Demo title="File dropzone"><DropzoneDemo /></Demo>
      <Demo title="Chart primitives"><ChartsDemo /></Demo>
      <Demo title="Chart theme tokens"><ChartThemeDemo /></Demo>
    </Section>
  );
}

function ChartThemeDemo() {
  // tokenUsage: var(--color-chart-1) var(--color-chart-2) var(--color-chart-3) var(--color-chart-4) var(--color-chart-5) var(--color-chart-6) var(--color-chart-7) var(--color-chart-8)
  const bars = [38, 62, 48, 80, 56, 90, 70, 66];
  return (
    <div style={{ width: "100%", maxWidth: 420 }}>
      <div className="dsv-inline" style={{ alignItems: "flex-end", gap: "var(--space-2)", height: 110 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ flex: 1, height: h, background: `var(--color-chart-${i + 1})`, borderRadius: "var(--radius-sm) var(--radius-sm) 0 0" }} />
        ))}
      </div>
      <div className="dsv-chart-grid" style={{ height: "var(--space-4)" }} />
      <div className="dsv-chart-axis" />
      <div className="dsv-inline" style={{ justifyContent: "space-between", marginTop: "var(--space-2)" }}>
        <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>grid + axis tokens</span>
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
            <Avatar.Fallback className="dsv-avatar-fallback" delayMs={600}>U{n % 10}</Avatar.Fallback>
          </Avatar.Root>
        </span>
      ))}
      <span className="dsv-avatar dsv-avatar-more dsv-avatar--md">+3</span>
    </div>
  );
}

// ───────────────────────────────────────── Foundation tokens (432-ref)
export function FoundationSection() {
  return (
    <Section id="foundation" title="Foundation tokens" desc="Gradient, glow, motion, rhythm, media and layout scales — driven by the expanded token schema.">
      <Demo title="Gradient">
        <div className="dsv-gradient-row">
          {[["brand", "--gradient-brand"], ["brand-subtle", "--gradient-brand-subtle"], ["surface", "--gradient-surface"], ["surface-subtle", "--gradient-surface-subtle"], ["glow", "--gradient-glow"], ["fade", "--gradient-fade"], ["hero", "--gradient-hero"]].map(([label, token]) => (
            <span key={label} className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
              <span className={`dsv-gradient-tile dsv-gradient-tile--${label}`}>{label}</span>
              <code className="dsv-code-inline">{token}</code>
            </span>
          ))}
        </div>
      </Demo>

      <Demo title="Glow">
        <div className="dsv-glow-row">
          {[["sm", "--glow-sm"], ["md", "--glow-md"], ["lg", "--glow-lg"], ["xl", "--glow-xl"]].map(([label, token]) => (
            <span key={label} className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
              <span className={`dsv-glow-tile dsv-glow-tile--${label}`}>{label}</span>
              <code className="dsv-code-inline">{token}</code>
            </span>
          ))}
        </div>
      </Demo>

      <Demo title="Semantic motion (hover to play)">
        <div className="dsv-motion-row">
          {[["hover", "--motion-hover"], ["press", "--motion-press"], ["reveal", "--motion-reveal"], ["layout", "--motion-layout"], ["smooth", "--duration-normal + --ease-smooth"], ["emphasized", "--duration-normal + --ease-emphasized"], ["exit", "--motion-exit"]].map(([label, token]) => (
            <span key={label} className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
              <span className={`dsv-motion-box dsv-motion-box--${label}`}>{label}</span>
              <code className="dsv-code-inline">{token}</code>
            </span>
          ))}
        </div>
      </Demo>

      <Demo title="Section rhythm + composition">
        <div className="dsv-section-stack">
          <div className="ss-xs">section-space-xs</div>
          <div className="ss-sm">section-space-sm</div>
          <div className="ss-md">section-space-md</div>
        </div>
        <div className="dsv-stack" style={{ gap: "var(--space-1)", marginTop: "var(--space-2)" }}>
          <div className="dsv-rhythm-slab" style={{ height: "var(--section-space-lg)" }}>section-space-lg</div>
          <div className="dsv-rhythm-slab" style={{ height: "var(--section-space-xl)" }}>section-space-xl</div>
          <div className="dsv-rhythm-slab" style={{ height: "var(--section-space-2xl)" }}>section-space-2xl</div>
          <div className="dsv-rhythm-slab" style={{ height: "var(--section-space-3xl)" }}>section-space-3xl</div>
        </div>
        <div className="dsv-composition-row" style={{ marginTop: "var(--space-4)" }}>
          <div className="dsv-card" style={{ maxWidth: "var(--composition-max-width-narrow)" }}>
            <div style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-sm)" }}>Narrow measure</div>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>max-width-narrow · composition-gutter</div>
          </div>
          <div className="dsv-stack" style={{ gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            {[["", "--composition-overlap-md", "md"], ["dsv-overlap-row--sm", "--composition-overlap-sm", "sm"], ["dsv-overlap-row--lg", "--composition-overlap-lg", "lg"]].map(([cls, token, label]) => (
              <span key={label} className="dsv-inline" style={{ gap: "var(--space-2)", flexWrap: "wrap" }}>
                <span className={`dsv-overlap-row ${cls}`}>
                  <div>A</div><div>B</div><div>C</div>
                </span>
                <VarVal name={token} />
              </span>
            ))}
          </div>
        </div>
      </Demo>

      <Demo title="Media">
        <div className="dsv-media-row">
          {[["wide", "--media-aspect-wide", false], ["standard", "--media-aspect-standard", "subtle"], ["square", "--media-aspect-square", false], ["portrait", "--media-aspect-portrait", "strong"], ["video", "--media-aspect-video", false]].map(([label, token, shade]) => (
            <span key={label} className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
              <span className={`dsv-media-tile dsv-media-tile--${label}`}>
                {shade && <span className={`shade${shade === true ? "" : ` shade--${shade}`}`} />}
                <span>{label}</span>
              </span>
              <VarVal name={token} />
            </span>
          ))}
        </div>
      </Demo>

      <Demo title="Breakpoint scale">
        <div className="dsv-bp-stack">
          {[["xs", "--breakpoint-xs"], ["sm", "--breakpoint-sm"], ["md", "--breakpoint-md"], ["lg", "--breakpoint-lg"], ["xl", "--breakpoint-xl"], ["2xl", "--breakpoint-2xl"]].map(([label, token]) => (
            <div key={label} className="dsv-inline" style={{ gap: "var(--space-2)", flexWrap: "wrap" }}>
              <div className={`dsv-bp-bar dsv-bp-${label}`} style={{ flex: "none", minWidth: 120 }}><span>{label}</span></div>
              <VarVal name={token} />
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="Overlay tokens">
        <div className="dsv-stack" style={{ gap: "var(--space-2)", alignItems: "flex-start" }}>
          <div className="dsv-overlay-tile"><span>scrim · opacity · blur · radius</span></div>
          <div className="dsv-inline" style={{ gap: "var(--space-1)", flexWrap: "wrap" }}>
            {["--color-scrim", "--overlay-opacity", "--overlay-blur", "--overlay-radius"].map((t) => <VarVal key={t} name={t} />)}
          </div>
        </div>
      </Demo>

      <Demo title="Accessibility — touch target minimum">
        <div className="dsv-stack" style={{ gap: "var(--space-2)" }}>
          <div className="dsv-touch-demo">
            <button className="dsv-btn dsv-btn--outline dsv-btn--sm dsv-touch-demo-btn" aria-label="Small button stretched to touch minimum">
              sm control
            </button>
          </div>
          <div className="dsv-inline" style={{ gap: "var(--space-1)", flexWrap: "wrap" }}>
            <VarVal name="--touch-target-min" />
            <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>hit area ≥ token · icon-only controls keep visual size</span>
          </div>
        </div>
      </Demo>

      <Demo title="Iconography">
        <div className="dsv-stroke-row">
          <span className="dsv-stroke-sample dsv-stroke-sample--thin"><Icon name="star" size={20} />thin</span>
          <span className="dsv-stroke-sample dsv-stroke-sample--base"><Icon name="star" size={20} />base</span>
          <span className="dsv-stroke-sample dsv-stroke-sample--medium"><Icon name="star" size={20} />medium</span>
          <span className="dsv-stroke-sample dsv-stroke-sample--bold"><Icon name="star" size={20} />bold</span>
        </div>
      </Demo>

      <Demo title="Responsive grid + containers">
        <div style={{ width: "100%" }}>
          <div className="dsv-grid-sm" style={{ marginBottom: "var(--space-2)" }}>
            {Array.from({ length: 4 }, (_, i) => <div key={i} style={{ height: "var(--space-4)", background: "var(--color-accent-subtle)", borderRadius: "var(--radius-sm)" }} />)}
          </div>
          <div className="dsv-grid-md" style={{ marginBottom: "var(--space-2)" }}>
            {Array.from({ length: 8 }, (_, i) => <div key={i} style={{ height: "var(--space-4)", background: "var(--color-accent-muted)", borderRadius: "var(--radius-sm)" }} />)}
          </div>
          <div className="dsv-stack" style={{ gap: "var(--space-1)" }}>
            <div className="dsv-container-xs" style={{ background: "var(--color-tint-subtle)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-size-xs)", padding: "var(--space-1) var(--space-2)" }}>container xs</div>
            <div className="dsv-container-xl" style={{ background: "var(--color-tint-subtle)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-size-xs)", padding: "var(--space-1) var(--space-2)" }}>container xl</div>
            <div className="dsv-container-2xl" style={{ background: "var(--color-tint-subtle)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-size-xs)", padding: "var(--space-1) var(--space-2)" }}>container 2xl</div>
          </div>
        </div>
      </Demo>

      <Demo title="Text measure">
        <div className="dsv-stack" style={{ gap: "var(--space-2)" }}>
          {[["xs", "--text-measure-xs", "Extra-small measure — xs. Lorem ipsum dolor sit amet, consectetur."], ["sm", "--text-measure-sm", "Small measure — sm. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor."], ["lg", null, "Large measure — lg (default). Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."], ["xl", "--text-measure-xl", "Extra-large measure — xl. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud."], ["wide", "--text-measure-wide", "Wide measure — wide. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim."]].map(([label, token, text]) => (
            <div key={label} className="dsv-stack" style={{ gap: "var(--space-1)" }}>
              <p className="dsv-prose" style={{ margin: 0, maxWidth: token ? `var(${token})` : undefined }}>{text}</p>
              <span>{token ? <VarVal name={token} /> : <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>default (no cap)</span>}</span>
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="Inverse surface + secondary accent">
        <div className="dsv-inline" style={{ alignItems: "stretch", flexWrap: "wrap" }}>
          <div style={{ background: "var(--color-surface-inverse)", color: "var(--color-text-on-accent)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", minWidth: 200 }}>
            <div style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-sm)" }}>Inverse panel</div>
            <div style={{ fontSize: "var(--font-size-xs)", opacity: 0.8 }}>surface-inverse · text-on-accent</div>
          </div>
          <div style={{ background: "var(--color-accent-secondary-subtle)", border: "var(--border-width-thin) solid var(--color-accent-secondary)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", minWidth: 200 }}>
            <div style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-sm)", color: "var(--color-accent-secondary)" }}>Secondary accent</div>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>accent-secondary · secondary-subtle</div>
          </div>
        </div>
      </Demo>

      <Demo title="Spacing scale">
        {/* tokenUsage: var(--space-0) var(--space-px) var(--space-0-5) var(--space-1) var(--space-1-5) var(--space-2) var(--space-2-5) var(--space-3) var(--space-3-5) var(--space-4) var(--space-5) var(--space-6) var(--space-7) var(--space-8) var(--space-10) var(--space-12) var(--space-14) var(--space-16) var(--space-20) var(--space-24) var(--space-28) var(--space-32) var(--space-40) var(--space-48) var(--space-56) var(--space-64) var(--space-72) var(--space-80) var(--space-96) */}
        <div className="dsv-stack" style={{ gap: "var(--space-1)", width: "100%" }}>
          {["0", "px", "0-5", "1", "1-5", "2", "2-5", "3", "3-5", "4", "5", "6", "7", "8", "10", "12", "14", "16", "20", "24", "28", "32", "40", "48", "56", "64", "72", "80", "96"].map((s) => (
            <div key={s} className="dsv-inline" style={{ gap: "var(--space-2)" }}>
              <code className="dsv-code-inline" style={{ minWidth: 64 }}>{s}</code>
              <div style={{ width: `var(--space-${s})`, maxWidth: "100%", height: "var(--space-2)", minWidth: 2, background: "var(--color-accent)", borderRadius: "var(--radius-sm)" }} />
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="Shape — radius ends + medium border">
        <div className="dsv-inline" style={{ gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div style={{ width: 96, height: 64, background: "var(--color-accent-subtle)", borderRadius: "var(--radius-xs)", border: "var(--border-width-medium) solid var(--color-accent-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--font-size-xs)", fontFamily: "var(--font-mono)" }}>xs</div>
          <div style={{ width: 96, height: 64, background: "var(--color-accent-subtle)", borderRadius: "var(--radius-3xl)", border: "var(--border-width-medium) solid var(--color-accent-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--font-size-xs)", fontFamily: "var(--font-mono)" }}>3xl</div>
        </div>
      </Demo>

      <Demo title="Control density">
        <div className="dsv-stack" style={{ gap: "var(--space-2)", width: "100%" }}>
          {[["xs", "var(--control-padding-y-xs) var(--control-padding-x-xs)"], ["sm", "var(--control-padding-y-sm) var(--control-padding-x-sm)"], ["md", "var(--control-padding-y-md) var(--control-padding-x-md)"], ["lg", "var(--control-padding-y-lg) var(--control-padding-x-lg)"], ["xl", "var(--control-padding-y-xl) var(--control-padding-x-xl)"]].map(([s, pad]) => (
            <div key={s} className="dsv-inline" style={{ gap: "var(--icon-gap-sm)", background: "var(--color-surface)", border: "var(--control-border-width) solid var(--color-border)", borderRadius: "var(--control-radius)", padding: pad }}>
              <Icon name="search" size={14} /><span style={{ fontSize: "var(--font-size-sm)" }}>Density {s}</span>
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="Modal widths + input heights">
        <div className="dsv-stack" style={{ gap: "var(--space-2)", width: "100%" }}>
          {[["sm", "var(--modal-width-sm)"], ["md", "var(--modal-width-md)"], ["lg", "var(--modal-width-lg)"], ["xl", "var(--modal-width-xl)"]].map(([s, w]) => (
            <div key={s} style={{ maxWidth: w, width: "100%", background: "var(--color-surface-raised)", border: "var(--border-width-thin) solid var(--color-border-subtle)", borderRadius: "var(--radius-md)", padding: "var(--space-2) var(--space-3)", fontSize: "var(--font-size-xs)", fontFamily: "var(--font-mono)" }}>modal-{s}</div>
          ))}
          <div className="dsv-inline" style={{ gap: "var(--space-2)", alignItems: "flex-end" }}>
            <input className="dsv-input" style={{ height: "var(--input-height-sm)", width: 120 }} placeholder="sm" aria-label="small input" />
            <input className="dsv-input" style={{ width: 120 }} placeholder="md" aria-label="medium input" />
            <input className="dsv-input" style={{ height: "var(--input-height-lg)", width: 120 }} placeholder="lg" aria-label="large input" />
          </div>
        </div>
      </Demo>

      <Demo title="Responsive tokens">
        <div className="dsv-stack" style={{ gap: "var(--space-3)", width: "100%" }}>
          <div style={{ background: "var(--color-surface)", border: "var(--border-width-thin) solid var(--color-border-subtle)", borderRadius: "var(--radius-md)", padding: "var(--mobile-page-padding)" }}>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", marginBottom: "var(--mobile-content-gap)" }}>mobile — page-padding · content-gap · grid-gap</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--mobile-grid-gap)" }}>
              <div style={{ height: "var(--space-8)", background: "var(--color-accent-subtle)", borderRadius: "var(--radius-sm)" }} />
              <div style={{ height: "var(--space-8)", background: "var(--color-accent-muted)", borderRadius: "var(--radius-sm)" }} />
            </div>
          </div>
          <div style={{ background: "var(--color-surface)", border: "var(--border-width-thin) solid var(--color-border-subtle)", borderRadius: "var(--radius-md)", padding: "var(--desktop-page-padding)" }}>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", marginBottom: "var(--desktop-content-gap)" }}>desktop — page-padding · content-gap · grid-gap</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--desktop-grid-gap)" }}>
              <div style={{ height: "var(--space-8)", background: "var(--color-accent-subtle)", borderRadius: "var(--radius-sm)" }} />
              <div style={{ height: "var(--space-8)", background: "var(--color-accent-muted)", borderRadius: "var(--radius-sm)" }} />
              <div style={{ height: "var(--space-8)", background: "var(--color-accent-subtle)", borderRadius: "var(--radius-sm)" }} />
            </div>
          </div>
          <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>section rhythm — mobile <span style={{ padding: "var(--mobile-section-spacing) 0", background: "var(--color-accent-subtle)" }}>pad</span> · desktop <span style={{ padding: "var(--desktop-section-spacing) 0", background: "var(--color-accent-muted)" }}>pad</span></div>
        </div>
      </Demo>

      <Demo title="Control + icon sizes">
        <div className="dsv-stack" style={{ gap: "var(--space-4)", width: "100%" }}>
          <div className="dsv-inline" style={{ gap: "var(--space-2)", alignItems: "flex-end", flexWrap: "wrap" }}>
            {[["xs", "var(--size-control-xs)"], ["sm", "var(--size-control-sm)"], ["md", "var(--size-control-md)"], ["lg", "var(--size-control-lg)"], ["xl", "var(--size-control-xl)"]].map(([s, h]) => (
              <span key={s} className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
                <span style={{ width: h, height: h, background: "var(--color-surface-sunken)", borderRadius: "var(--radius-sm)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "var(--font-size-xs)", fontFamily: "var(--font-mono)" }}>{s}</span>
                <VarVal name={`--size-control-${s}`} />
              </span>
            ))}
          </div>
          <div className="dsv-inline" style={{ gap: "var(--space-3)", alignItems: "flex-end", flexWrap: "wrap" }}>
            {[["xs", "var(--size-icon-xs)", 12], ["sm", "var(--size-icon-sm)", 16], ["md", "var(--size-icon-md)", 20], ["lg", "var(--size-icon-lg)", 24], ["xl", "var(--size-icon-xl)", 32]].map(([s, token, px]) => (
              <span key={s} className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
                <span className="dsv-stroke-sample dsv-stroke-sample--base" style={{ color: "var(--color-text)" }}>
                  <Icon name="bell" size={px} />
                  icon-{s}
                </span>
                <VarVal name={token} />
              </span>
            ))}
          </div>
        </div>
      </Demo>

      <Demo title="Composition — widths, offsets, aspects">
        <div className="dsv-stack" style={{ gap: "var(--space-2)", width: "100%" }}>
          <div style={{ maxWidth: "var(--composition-max-width)", background: "var(--color-tint-subtle)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-size-xs)", padding: "var(--space-1) var(--space-2)" }}>composition-max-width</div>
          <div style={{ maxWidth: "var(--composition-max-width-wide)", background: "var(--color-tint-subtle)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-size-xs)", padding: "var(--space-1) var(--space-2)" }}>composition-max-width-wide</div>
          <div className="dsv-inline" style={{ gap: "var(--space-2)", flexWrap: "wrap" }}>
            {[["sm", "--composition-offset-sm", "dsv-offset-sm"], ["md", "--composition-offset-md", "dsv-offset-md"], ["lg", "--composition-offset-lg", "dsv-offset-lg"]].map(([label, token, cls]) => (
              <span key={label} className="dsv-stack" style={{ gap: "var(--space-1)" }}>
                <span className={cls} style={{ background: "var(--color-accent-subtle)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-size-xs)", padding: "var(--space-1) var(--space-2)", alignSelf: "flex-start" }}>offset-{label}</span>
                <VarVal name={token} />
              </span>
            ))}
          </div>
          <div className="dsv-inline" style={{ gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
            {[[120, "var(--composition-aspect-wide)", "wide"], [96, "var(--composition-aspect-standard)", "standard"], [72, "var(--composition-aspect-square)", "square"], [56, "var(--composition-aspect-portrait)", "portrait"]].map(([w, ar, label]) => (
              <span key={label} className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
                <span style={{ width: w, aspectRatio: ar, background: "var(--color-accent-muted)", borderRadius: "var(--radius-sm)" }} />
                <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", fontFamily: "var(--font-mono)" }}>{label}</span>
              </span>
            ))}
          </div>
        </div>
      </Demo>
    </Section>
  );
}

export const EXTRA_SECTIONS = [
  { id: "foundation", label: "Foundation tokens", Comp: FoundationSection },
  { id: "patterns", label: "Product patterns", Comp: PatternsSection },
  { id: "data-display", label: "Data display", Comp: DataDisplaySection },
  { id: "status", label: "Status & loading", Comp: StatusSection },
  { id: "nav-extras", label: "Navigation extras", Comp: NavExtrasSection },
];
