import { useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Button, Demo, Icon } from "./ui.jsx";

const Section = ({ id, title, desc, children }) => (
  <section className="dsv-section" id={id}>
    <h2>{title}</h2>
    <p>{desc}</p>
    {children}
  </section>
);

// ───────────────────────────────────────── Data display
export function DataDisplaySection() {
  const [tags, setTags] = useState(["design", "tokens", "radix", "preview"]);
  return (
    <Section id="data-display" title="Data display" desc="Styled with tokens — not in Radix Primitives, built from theme variables.">
      <Demo title="Table (zebra + hover)">
        <div className="dsv-table-wrap" style={{ maxWidth: 460, width: "100%" }}>
        <table className="dsv-table dsv-table--zebra">
          <thead><tr><th>Package</th><th>Version</th><th>Size</th></tr></thead>
          <tbody>
            {[["react", "18.3.1", "6.4 kB"], ["@radix-ui/react-dialog", "1.1.4", "12 kB"], ["vite", "5.4.11", "—"]].map((r) => (
              <tr key={r[0]}><td className="dsv-mono">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>
            ))}
          </tbody>
        </table>
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
          <div className="dsv-callout dsv-callout--info"><span className="ico"><Icon name="bell" size={16} /></span><div>New version available. Update from Settings.</div></div>
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
    </Section>
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
          <a href="#data-display">Home</a><Icon name="chevronRight" size={12} />
          <a href="#data-display">Projects</a><Icon name="chevronRight" size={12} />
          <span aria-current="page">design-system-viewer</span>
        </nav>
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
    </Section>
  );
}

export const EXTRA_SECTIONS = [
  { id: "data-display", label: "Data display", Comp: DataDisplaySection },
  { id: "status", label: "Status & loading", Comp: StatusSection },
  { id: "nav-extras", label: "Navigation extras", Comp: NavExtrasSection },
];
