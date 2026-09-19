import { useState } from "react";
import { Button, Demo } from "../ui.tsx";
import { Icon } from "../../lib/icons.tsx";
import { VarVal } from "./varVal.tsx";
import "./status.css";

const DURATION_SCALE: { label: string; name: string; token: string }[] = [
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
      <span
        className="dsv-spinner"
        style={instant ? { animationDuration: "var(--duration-instant)" } : undefined}
      />
      <label className="dsv-control-label" style={{ fontSize: "var(--font-size-xs)" }}>
        <input type="checkbox" checked={instant} onChange={(e) => setInstant(e.target.checked)} />{" "}
        --duration-instant
      </label>
      <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
        easing: var(--ease-linear) → var(--ease-spring)
      </span>
      <span
        className="dsv-inline"
        style={{
          transition:
            "opacity var(--duration-fast) var(--ease-linear), transform var(--duration-normal) var(--ease-spring)",
        }}
      >
        preview
      </span>
    </div>
  );
}

const FILE_ROWS: [string, string, string][] = [
  ["report.pdf", "2.4 MB", "done"],
  ["data.csv", "812 KB", "done"],
  ["video.mp4", "48%", "busy"],
];

const BLUR_TILES: [string, string][] = [
  ["sm", "--blur-sm"],
  ["md", "--blur-md"],
  ["lg", "--blur-lg"],
  ["xl", "--blur-xl"],
];

export default function StatusBody() {
  const [banner, setBanner] = useState(true);
  return (
    <>
      <Demo title="Callout">
        <div className="dsv-stack" style={{ maxWidth: 460, width: "100%" }}>
          <div className="dsv-callout dsv-callout--info">
            <span className="ico">
              <Icon name="bell" size={16} />
            </span>
            <div>
              New version available.{" "}
              <a className="dsv-link" href="#status">
                Update from Settings.
              </a>
            </div>
          </div>
          <div className="dsv-callout dsv-callout--success">
            <span className="ico">
              <Icon name="check" size={16} />
            </span>
            <div>Payment received. Invoice sent via email.</div>
          </div>
          <div className="dsv-callout dsv-callout--warning">
            <span className="ico">
              <Icon name="bell" size={16} />
            </span>
            <div>Your API key expires in 7 days.</div>
          </div>
          <div className="dsv-callout dsv-callout--danger">
            <span className="ico">
              <Icon name="x" size={16} />
            </span>
            <div>3 services not responding. Check status page.</div>
          </div>
        </div>
      </Demo>

      <Demo title="Banner (dismissible)">
        {banner ? (
          <div className="dsv-banner" style={{ maxWidth: 460, width: "100%" }}>
            <Icon name="bell" size={14} /> Friday 02:00–04:00 maintenance window.
            <button className="close" aria-label="Close" onClick={() => setBanner(false)}>
              <Icon name="x" size={14} />
            </button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setBanner(true)}>
            Restore banner
          </Button>
        )}
      </Demo>

      <Demo title="Empty state">
        <div className="dsv-card" style={{ maxWidth: 460, width: "100%" }}>
          <div className="dsv-empty">
            <span className="glyph">
              <Icon name="search" size={24} />
            </span>
            <h4>No results</h4>
            <p>No matching records found for "lorem ipsum".</p>
            <Button variant="soft" size="sm">
              Clear filters
            </Button>
          </div>
        </div>
      </Demo>

      <Demo title="Skeleton">
        <div className="dsv-card" style={{ width: 300 }}>
          <div className="dsv-inline" style={{ marginBottom: "var(--space-3)" }}>
            <div
              className="dsv-skeleton"
              style={{ width: 40, height: 40, borderRadius: "var(--radius-full)" }}
            />
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
        <Button disabled>
          <span className="dsv-spinner dsv-spinner--sm" /> Loading
        </Button>
      </Demo>

      <Demo title="Motion — instant toggle">
        <MotionInstantDemo />
      </Demo>

      <Demo title="Motion — duration scale">
        <div className="dsv-dur-list">
          {DURATION_SCALE.map((d) => (
            <div key={d.label} className="dsv-dur-row" title={`${d.label} — ${d.token}`}>
              <span
                className="dsv-dur-dot"
                style={{ animationDuration: d.token }}
                aria-hidden="true"
              />
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
        <p
          className="dsv-muted"
          style={{ fontSize: "var(--font-size-xs)", margin: "var(--space-2) 0 0" }}
        >
          Dot blinks and bar slides on the real token — instant jumps, slowest glides.
        </p>
      </Demo>

      <Demo title="File list">
        <div style={{ minWidth: 260 }}>
          {FILE_ROWS.map(([name, meta, st]) => (
            <div key={name} className="dsv-list-item" style={{ cursor: "default" }}>
              <Icon name="file" size={16} />
              <span style={{ flex: 1 }}>{name}</span>
              {st === "busy" ? (
                <span className="dsv-inline">
                  <span className="dsv-spinner dsv-spinner--xs" />
                  <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
                    {meta}
                  </span>
                </span>
              ) : (
                <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
                  {meta}
                </span>
              )}
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="Blur / outline / bounce">
        <div className="dsv-blur-grid">
          <div className="dsv-blur-card">
            <div className="dsv-blur-card-title">Blur scale</div>
            <div className="dsv-inline" style={{ gap: "var(--space-3)", flexWrap: "wrap" }}>
              {BLUR_TILES.map(([s, token]) => (
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
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
              backdrop &amp; filter blur ramp
            </div>
          </div>
          <div className="dsv-blur-card dsv-outline-card">
            <div className="dsv-blur-card-title">Outline &amp; focus</div>
            <div className="dsv-inline" style={{ gap: "var(--space-3)", flexWrap: "wrap" }}>
              <span className="dsv-outline-chip">--shadow-outline</span>
              <button className="dsv-btn dsv-btn--outline dsv-btn--sm dsv-focus-demo">
                Tab to focus
              </button>
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
                <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
                  --opacity-hover
                </span>
              </span>
              <span className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
                <button className="dsv-btn dsv-btn--soft dsv-btn--sm dsv-pressable">press me</button>
                <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
                  --motion-scale-active
                </span>
              </span>
            </div>
          </div>
        </div>
      </Demo>
    </>
  );
}
