import { Button } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import type { IconName } from "../../../lib/icons.tsx";
import "./screens.css";

const FEATURES: [IconName, string, string][] = [
  ["file", "Tokens", "Full-schema coverage, linted on paste"],
  ["eye", "Preview", "Radix primitives in your tokens"],
  ["copy", "Compare", "Side by side diff, shareable links"],
];

const LOGOS = ["ACME", "GLOBEX", "INITECH", "UMBRELLA"];

export default function MarketingBody() {
  return (
    <div>
      <div className="dsv-hero-panel" style={{ marginBottom: "var(--section-space-md)" }}>
        <span className="dsv-hero-orb dsv-hero-orb--a" aria-hidden="true" />
        <span className="dsv-hero-orb dsv-hero-orb--b" aria-hidden="true" />
        <span className="dsv-hero-grid" aria-hidden="true" />
        <span className="dsv-badge dsv-badge--on-dark">
          <span className="dsv-pulse-dot" aria-hidden="true" />
          New · v2.0 — compare mode
        </span>
        <h3 className="dsv-display dsv-display--dlg" style={{ margin: "var(--space-4) 0 var(--space-3)" }}>
          Design systems,
          <br />
          visualized
        </h3>
        <p className="dsv-lede" style={{ margin: "0 auto var(--space-6)", maxWidth: "var(--text-measure-md)" }}>
          Paste tokens, get a gallery, a live preview and a diff. One link per view — light and dark.
        </p>
        <div className="dsv-inline" style={{ justifyContent: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <Button size="lg" className="dsv-hero-cta">
            Start free <Icon name="chevronRight" size={16} />
          </Button>
          <Button size="lg" variant="outline" className="dsv-hero-ghost">
            Live demo
          </Button>
        </div>
        <div className="dsv-hero-stats">
          <span>
            <strong>192+</strong> tokens covered
          </span>
          <span className="dsv-hero-stats-sep" aria-hidden="true" />
          <span>
            <strong>4.9/5</strong> designer rating
          </span>
          <span className="dsv-hero-stats-sep" aria-hidden="true" />
          <span>
            <strong>60s</strong> to first preview
          </span>
        </div>
      </div>
      <div className="dsv-hero-img" style={{ marginBottom: "var(--space-8)" }}>
        <img
          src="https://images.unsplash.com/photo-1503264116251-35a269479413?w=900&q=60"
          alt="Product preview"
          loading="lazy"
        />
        <span className="dsv-hero-img-cap">
          <span className="dsv-badge dsv-badge--on-dark">Live preview</span>
          <span>Tokens → gallery in one paste</span>
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "var(--space-4)",
          marginBottom: "var(--space-8)",
        }}
      >
        {FEATURES.map(([ic, h, b]) => (
          <div key={h} className="dsv-card dsv-card--lift dsv-feature-card">
            <span className="dsv-feature-ico">
              <Icon name={ic} size={18} />
            </span>
            <div style={{ fontWeight: "var(--font-weight-semibold)", marginTop: "var(--space-3)" }}>
              {h}
            </div>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-sm)", marginTop: "var(--space-1)" }}>
              {b}
            </div>
          </div>
        ))}
      </div>
      <div
        className="dsv-inline"
        style={{
          justifyContent: "center",
          gap: "var(--space-6)",
          flexWrap: "wrap",
          marginBottom: "var(--space-8)",
        }}
        aria-label="Trusted by"
      >
        {LOGOS.map((w) => (
          <span
            key={w}
            className="dsv-muted"
            style={{
              fontSize: "var(--font-size-xs)",
              fontWeight: "var(--font-weight-bold)",
              letterSpacing: "var(--letter-spacing-wider)",
            }}
          >
            {w}
          </span>
        ))}
      </div>
      <blockquote className="dsv-quote" style={{ marginBottom: "var(--space-8)" }}>
        “We finally see every token in context.”
        <cite>
          <span className="dsv-inline" style={{ gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            <span className="dsv-avatar dsv-avatar--sm">
              <span className="dsv-avatar-fallback" style={{ fontSize: "var(--font-size-xs)" }}>
                PL
              </span>
            </span>
            <span>Platform team lead · Acme</span>
          </span>
        </cite>
      </blockquote>
      <div
        className="dsv-banner dsv-banner--on-dark"
        style={{ justifyContent: "center", flexWrap: "wrap", gap: "var(--space-3)" }}
      >
        <span>Ready when you are</span>
        <Button size="sm" className="dsv-btn--on-dark-solid" style={{ marginLeft: "var(--space-3)" }}>
          Get started
        </Button>
        <Button size="sm" variant="ghost" className="dsv-btn--on-dark-ghost">
          Talk to sales
        </Button>
      </div>
    </div>
  );
}
