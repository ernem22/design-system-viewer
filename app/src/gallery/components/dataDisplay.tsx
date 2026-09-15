import { useMemo, useState } from "react";
import { Demo } from "../ui.tsx";
import { Icon } from "../../lib/icons.tsx";
import "./dataDisplay.css";

function ListItem({ label, initial }: { label: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <div
      className={`dsv-list-item ${on ? "is-selected" : ""}`}
      onClick={() => setOn((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOn((v) => !v);
        }
      }}
      role="option"
      aria-selected={on}
      tabIndex={0}
    >
      <span className="dsv-check dsv-check--static" data-state={on ? "checked" : "unchecked"}>
        <Icon name="check" size={12} />
      </span>
      {label}
    </div>
  );
}

function InteractiveTableDemo() {
  const base: string[][] = [
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
    // base is a static literal — sorting depends only on sort state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);
  const toggleSort = (col: number) =>
    setSort((s) => (s.col === col ? { col, dir: -s.dir } : { col, dir: 1 }));
  const toggleRow = (name: string) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));
  const allNames = rows.map((r) => r[0]);
  const allOn = selected.length === rows.length;
  return (
    <div style={{ width: "100%", maxWidth: 520 }}>
      <label
        className="dsv-control-label"
        style={{ fontSize: "var(--font-size-xs)", marginBottom: "var(--space-2)" }}
      >
        <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} />{" "}
        compact density
      </label>
      <div className="dsv-table-wrap" style={{ maxHeight: 240, overflowY: "auto" }}>
        <table
          className="dsv-table dsv-table--zebra"
          style={compact ? { fontSize: "var(--font-size-xs)" } : undefined}
        >
          <thead>
            <tr>
              {["Package", "Version", "Size"].map((h, i) => (
                <th key={h} onClick={() => toggleSort(i)} style={{ cursor: "pointer" }}>
                  {h}
                  {sort.col === i ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                </th>
              ))}
              <th>
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={() => setSelected(allOn ? [] : allNames)}
                  aria-label="Select all"
                  ref={(el) => {
                    if (el) el.indeterminate = selected.length > 0 && !allOn;
                  }}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className={selected.includes(r[0]) ? "is-selected" : ""}>
                <td className="dsv-mono">{r[0]}</td>
                <td>{r[1]}</td>
                <td
                  style={
                    compact
                      ? { paddingTop: "var(--space-1)", paddingBottom: "var(--space-1)" }
                      : undefined
                  }
                >
                  {r[2]}
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(r[0])}
                    onChange={() => toggleRow(r[0])}
                    aria-label={`Select ${r[0]}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="dsv-inline"
        style={{ justifyContent: "space-between", marginTop: "var(--space-2)" }}
      >
        <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
          {selected.length} of {rows.length} selected
        </span>
        {selected.length > 0 && (
          <button
            className="dsv-btn dsv-btn--ghost dsv-btn--sm"
            style={{ minHeight: 28 }}
            onClick={() => setSelected([])}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

const CARD_TINTS: [string, string, string, string | null][] = [
  ["dsv-card--tint", "Tint wash", "--color-tint-subtle", null],
  ["dsv-card--lift", "Hover to lift", "--color-shadow", "shadow-lg"],
  ["is-picked", "Selected", "--color-selected", "--color-accent-border"],
];

const STATS: [string, string, string, string, string][] = [
  ["MRR", "$124k", "▲ 8.2%", "up", "M0,26 L12,22 L24,23 L36,14 L48,16 L60,6"],
  ["Churn", "1.9%", "▼ 0.4%", "down", "M0,8 L12,10 L24,9 L36,16 L48,15 L60,22"],
  ["NPS", "62", "▲ 5", "up", "M0,24 L12,20 L24,21 L36,14 L48,15 L60,8"],
  ["Active", "8.412", "▲ 2.1%", "up", "M0,22 L12,18 L24,19 L36,12 L48,13 L60,5"],
];

export default function DataDisplayBody() {
  const [tags, setTags] = useState(["design", "tokens", "radix", "preview"]);
  return (
    <>
      <Demo title="Table — interactive (sort, select, sticky)">
        <InteractiveTableDemo />
      </Demo>

      <Demo title="Multi-select list (selected)">
        <div style={{ minWidth: 220 }}>
          {(
            [
              ["Design tokens", true],
              ["Component preview", true],
              ["Compare mode", false],
              ["Dark variant", false],
            ] as [string, boolean][]
          ).map(([label, init]) => (
            <ListItem key={label} label={label} initial={init} />
          ))}
        </div>
      </Demo>

      <Demo title="Card — tint wash & colored shadow">
        {CARD_TINTS.map(([cls, title, token, extra]) => (
          <div key={title} className="dsv-stack" style={{ gap: "var(--space-1)", maxWidth: 300 }}>
            <div
              className={`dsv-card ${cls === "is-picked" ? "" : cls}`}
              style={
                cls === "is-picked"
                  ? {
                      borderColor: "var(--color-accent-border)",
                      background: "var(--color-selected)",
                    }
                  : undefined
              }
            >
              <div style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-sm)" }}>
                {title}
                {extra === "shadow-lg" ? " — hover me" : ""}
              </div>
              <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
                {token}
                {extra && extra !== "shadow-lg" ? ` · ${extra}` : ""}
              </div>
            </div>
            <code className="dsv-code-inline" style={{ alignSelf: "flex-start" }}>
              {cls === "is-picked" ? "accent-border + selected" : `.${cls}`}
            </code>
          </div>
        ))}
      </Demo>

      <Demo title="Data list">
        <dl className="dsv-datalist">
          <dt>Status</dt>
          <dd>
            <span className="dsv-badge dsv-badge--success">Active</span>
          </dd>
          <dt>Plan</dt>
          <dd>Pro (yearly)</dd>
          <dt>Renewal</dt>
          <dd>Jan 12, 2027</dd>
          <dt>Seats</dt>
          <dd>8 / 10</dd>
        </dl>
      </Demo>

      <Demo title="Stat cards">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "var(--space-3)",
            width: "100%",
          }}
        >
          {STATS.map(([k, v, d, dir, line]) => (
            <div key={k} className="dsv-stat">
              <div className="k">{k}</div>
              <div className="v">{v}</div>
              <div className={`d ${dir}`}>{d}</div>
              <svg
                width="100%"
                height="28"
                viewBox="0 0 60 30"
                preserveAspectRatio="none"
                role="img"
                aria-label={`${k} trend`}
                style={{ marginTop: "var(--space-2)", display: "block" }}
              >
                <path
                  d={line}
                  fill="none"
                  stroke={dir === "up" ? "var(--color-success)" : "var(--color-danger)"}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="Stat — hero numbers">
        <div
          className="dsv-inline"
          style={{ gap: "var(--space-8)", alignItems: "baseline", flexWrap: "wrap" }}
        >
          <div>
            <div className="dsv-display dsv-display--4xl">$124k</div>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>
              MRR · bold / tight / tight tracking
            </div>
          </div>
          <div>
            <div className="dsv-display dsv-display--3xl">84%</div>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>
              adoption
            </div>
          </div>
          <p className="dsv-lede" style={{ margin: 0, flexBasis: "100%" }}>
            Lede line — snug leading, secondary text.
          </p>
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
          <div
            className="dsv-light"
            style={{ fontSize: "var(--font-size-lg)", marginTop: "var(--space-2)" }}
          >
            Light weight sample (--font-weight-light)
          </div>
          <div
            className="dsv-tracking-wider"
            style={{ fontSize: "var(--font-size-sm)", marginTop: "var(--space-1)" }}
          >
            WIDER TRACKING SAMPLE (--letter-spacing-wider)
          </div>
          <div
            className="dsv-tracking-tighter"
            style={{ fontSize: "var(--font-size-sm)", marginTop: "var(--space-1)" }}
          >
            Tighter tracking sample (--letter-spacing-tighter)
          </div>
          <div
            className="dsv-leading-loose"
            style={{ fontSize: "var(--font-size-sm)", marginTop: "var(--space-1)" }}
          >
            Loose leading
            <br />
            second line (--line-height-loose)
          </div>
          <div
            className="dsv-leading-none"
            style={{ fontSize: "var(--font-size-sm)", marginTop: "var(--space-1)" }}
          >
            None leading
            <br />
            second line (--line-height-none)
          </div>
        </div>
      </Demo>

      <Demo title="Neutral ramp">
        <div className="dsv-inline" style={{ flexWrap: "wrap", gap: "var(--space-2)" }}>
          {["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950", "1000"].map(
            (s) => (
              <span key={s} className="dsv-neutral-chip">
                <span
                  style={{
                    width: "var(--space-6)",
                    height: "var(--space-6)",
                    borderRadius: "var(--radius-md)",
                    background: `var(--color-neutral-${s})`,
                    border: "var(--border-width-thin) solid var(--color-border)",
                  }}
                />
                {s}
              </span>
            ),
          )}
          <span className="dsv-neutral-chip">
            <span
              style={{
                width: "var(--space-6)",
                height: "var(--space-6)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-accent-secondary)",
              }}
            />
            secondary
          </span>
        </div>
        <div
          className="dsv-inline"
          style={{ flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-3)" }}
        >
          {["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"].map((s) => (
            <span key={s} className="dsv-neutral-chip">
              <span
                style={{
                  width: "var(--space-6)",
                  height: "var(--space-6)",
                  borderRadius: "var(--radius-md)",
                  background: `var(--color-brand-${s})`,
                  border: "var(--border-width-thin) solid var(--color-border)",
                }}
              />
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
            <button
              aria-label={`${t} remove`}
              onClick={() => setTags((xs) => xs.filter((x) => x !== t))}
            >
              <Icon name="x" size={12} />
            </button>
          </span>
        ))}
        {!tags.length && (
          <span className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>
            all removed
          </span>
        )}
      </Demo>

      <Demo title="Timeline">
        <ul className="dsv-timeline" style={{ maxWidth: 360 }}>
          {(
            [
              ["Repo created", "3 days ago"],
              ["First commit", "3 days ago"],
              ["CI configured", "2 days ago"],
              ["v0.1.0 released", "today"],
            ] as [string, string][]
          ).map(([b, w]) => (
            <li key={b}>
              <span className="node" />
              <div>
                <div className="body">{b}</div>
                <div className="when">{w}</div>
              </div>
            </li>
          ))}
        </ul>
      </Demo>
    </>
  );
}
