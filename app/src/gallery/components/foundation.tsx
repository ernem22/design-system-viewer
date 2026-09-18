import { Demo } from "../ui.tsx";
import { Icon } from "../../lib/icons.tsx";
import { VarVal } from "./varVal.tsx";
import "./foundation.css";

const GRADIENTS: [string, string][] = [
  ["brand", "--gradient-brand"],
  ["brand-subtle", "--gradient-brand-subtle"],
  ["surface", "--gradient-surface"],
  ["surface-subtle", "--gradient-surface-subtle"],
  ["glow", "--gradient-glow"],
  ["fade", "--gradient-fade"],
  ["hero", "--gradient-hero"],
];

const GLOWS: [string, string][] = [
  ["sm", "--glow-sm"],
  ["md", "--glow-md"],
  ["lg", "--glow-lg"],
  ["xl", "--glow-xl"],
];

const MOTIONS: [string, string][] = [
  ["hover", "--motion-hover"],
  ["press", "--motion-press"],
  ["reveal", "--motion-reveal"],
  ["layout", "--motion-layout"],
  ["smooth", "--duration-normal + --ease-smooth"],
  ["emphasized", "--duration-normal + --ease-emphasized"],
  ["exit", "--motion-exit"],
];

const MEDIA: [string, string, string | false][] = [
  ["wide", "--media-aspect-wide", false],
  ["standard", "--media-aspect-standard", "subtle"],
  ["square", "--media-aspect-square", false],
  ["portrait", "--media-aspect-portrait", "strong"],
  ["video", "--media-aspect-video", false],
];

const BREAKPOINTS: [string, string][] = [
  ["xs", "--breakpoint-xs"],
  ["sm", "--breakpoint-sm"],
  ["md", "--breakpoint-md"],
  ["lg", "--breakpoint-lg"],
  ["xl", "--breakpoint-xl"],
  ["2xl", "--breakpoint-2xl"],
];

const MEASURES: [string, string | null, string][] = [
  ["xs", "--text-measure-xs", "Extra-small measure — xs. Lorem ipsum dolor sit amet, consectetur."],
  ["sm", "--text-measure-sm", "Small measure — sm. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor."],
  ["lg", null, "Large measure — lg (default). Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."],
  ["xl", "--text-measure-xl", "Extra-large measure — xl. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud."],
  ["wide", "--text-measure-wide", "Wide measure — wide. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim."],
];

const SPACING = ["0", "px", "0-5", "1", "1-5", "2", "2-5", "3", "3-5", "4", "5", "6", "7", "8", "10", "12", "14", "16", "20", "24", "28", "32", "40", "48", "56", "64", "72", "80", "96"];

const DENSITY: [string, string][] = [
  ["xs", "var(--control-padding-y-xs) var(--control-padding-x-xs)"],
  ["sm", "var(--control-padding-y-sm) var(--control-padding-x-sm)"],
  ["md", "var(--control-padding-y-md) var(--control-padding-x-md)"],
  ["lg", "var(--control-padding-y-lg) var(--control-padding-x-lg)"],
  ["xl", "var(--control-padding-y-xl) var(--control-padding-x-xl)"],
];

const MODAL_WIDTHS: [string, string][] = [
  ["sm", "var(--modal-width-sm)"],
  ["md", "var(--modal-width-md)"],
  ["lg", "var(--modal-width-lg)"],
  ["xl", "var(--modal-width-xl)"],
];

const CONTROL_SIZES: [string, string][] = [
  ["xs", "var(--size-control-xs)"],
  ["sm", "var(--size-control-sm)"],
  ["md", "var(--size-control-md)"],
  ["lg", "var(--size-control-lg)"],
  ["xl", "var(--size-control-xl)"],
];

const ICON_SIZES: [string, string, number][] = [
  ["xs", "var(--size-icon-xs)", 12],
  ["sm", "var(--size-icon-sm)", 16],
  ["md", "var(--size-icon-md)", 20],
  ["lg", "var(--size-icon-lg)", 24],
  ["xl", "var(--size-icon-xl)", 32],
];

const OFFSETS: [string, string, string][] = [
  ["sm", "--composition-offset-sm", "dsv-offset-sm"],
  ["md", "--composition-offset-md", "dsv-offset-md"],
  ["lg", "--composition-offset-lg", "dsv-offset-lg"],
];

const ASPECTS: [number, string, string][] = [
  [120, "var(--composition-aspect-wide)", "wide"],
  [96, "var(--composition-aspect-standard)", "standard"],
  [72, "var(--composition-aspect-square)", "square"],
  [56, "var(--composition-aspect-portrait)", "portrait"],
];

export default function FoundationBody() {
  return (
    <>
      <Demo title="Gradient">
        <div className="dsv-gradient-row">
          {GRADIENTS.map(([label, token]) => (
            <span key={label} className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
              <span className={`dsv-gradient-tile dsv-gradient-tile--${label}`}>{label}</span>
              <code className="dsv-code-inline">{token}</code>
            </span>
          ))}
        </div>
      </Demo>

      <Demo title="Glow">
        <div className="dsv-glow-row">
          {GLOWS.map(([label, token]) => (
            <span key={label} className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
              <span className={`dsv-glow-tile dsv-glow-tile--${label}`}>{label}</span>
              <code className="dsv-code-inline">{token}</code>
            </span>
          ))}
        </div>
      </Demo>

      <Demo title="Semantic motion (hover to play)">
        <div className="dsv-motion-row">
          {MOTIONS.map(([label, token]) => (
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
          <div className="dsv-rhythm-slab" style={{ height: "var(--section-space-lg)" }}>
            section-space-lg
          </div>
          <div className="dsv-rhythm-slab" style={{ height: "var(--section-space-xl)" }}>
            section-space-xl
          </div>
          <div className="dsv-rhythm-slab" style={{ height: "var(--section-space-2xl)" }}>
            section-space-2xl
          </div>
          <div className="dsv-rhythm-slab" style={{ height: "var(--section-space-3xl)" }}>
            section-space-3xl
          </div>
        </div>
        <div className="dsv-composition-row" style={{ marginTop: "var(--space-4)" }}>
          <div className="dsv-card" style={{ maxWidth: "var(--composition-max-width-narrow)" }}>
            <div style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-sm)" }}>
              Narrow measure
            </div>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
              max-width-narrow · composition-gutter
            </div>
          </div>
          <div className="dsv-stack" style={{ gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            {(
              [
                ["", "--composition-overlap-md", "md"],
                ["dsv-overlap-row--sm", "--composition-overlap-sm", "sm"],
                ["dsv-overlap-row--lg", "--composition-overlap-lg", "lg"],
              ] as [string, string, string][]
            ).map(([cls, token, label]) => (
              <span key={label} className="dsv-inline" style={{ gap: "var(--space-2)", flexWrap: "wrap" }}>
                <span className={`dsv-overlap-row ${cls}`}>
                  <div>A</div>
                  <div>B</div>
                  <div>C</div>
                </span>
                <VarVal name={token} />
              </span>
            ))}
          </div>
        </div>
      </Demo>

      <Demo title="Media">
        <div className="dsv-media-row">
          {MEDIA.map(([label, token, shade]) => (
            <span key={label} className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
              <span className={`dsv-media-tile dsv-media-tile--${label}`}>
                {/* preview compared against `true` here, which never matched — shade is false | string */}
                {shade && <span className={`shade shade--${shade}`} />}
                <span>{label}</span>
              </span>
              <VarVal name={token} />
            </span>
          ))}
        </div>
      </Demo>

      <Demo title="Breakpoint scale">
        <div className="dsv-bp-stack">
          {BREAKPOINTS.map(([label, token]) => (
            <div key={label} className="dsv-inline" style={{ gap: "var(--space-2)", flexWrap: "wrap" }}>
              <div className={`dsv-bp-bar dsv-bp-${label}`} style={{ flex: "none", minWidth: 120 }}>
                <span>{label}</span>
              </div>
              <VarVal name={token} />
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="Overlay tokens">
        <div className="dsv-stack" style={{ gap: "var(--space-2)", alignItems: "flex-start" }}>
          <div className="dsv-overlay-tile">
            <span>scrim · opacity · blur · radius</span>
          </div>
          <div className="dsv-inline" style={{ gap: "var(--space-1)", flexWrap: "wrap" }}>
            {["--color-scrim", "--overlay-opacity", "--overlay-blur", "--overlay-radius"].map((t) => (
              <VarVal key={t} name={t} />
            ))}
          </div>
        </div>
      </Demo>

      <Demo title="Accessibility — touch target minimum">
        <div className="dsv-stack" style={{ gap: "var(--space-2)" }}>
          <div className="dsv-touch-demo">
            <button
              className="dsv-btn dsv-btn--outline dsv-btn--sm dsv-touch-demo-btn"
              aria-label="Small button stretched to touch minimum"
            >
              sm control
            </button>
          </div>
          <div className="dsv-inline" style={{ gap: "var(--space-1)", flexWrap: "wrap" }}>
            <VarVal name="--touch-target-min" />
            <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
              hit area ≥ token · icon-only controls keep visual size
            </span>
          </div>
        </div>
      </Demo>

      <Demo title="Iconography">
        <div className="dsv-stroke-row">
          <span className="dsv-stroke-sample dsv-stroke-sample--thin">
            <Icon name="star" size={20} />
            thin
          </span>
          <span className="dsv-stroke-sample dsv-stroke-sample--base">
            <Icon name="star" size={20} />
            base
          </span>
          <span className="dsv-stroke-sample dsv-stroke-sample--medium">
            <Icon name="star" size={20} />
            medium
          </span>
          <span className="dsv-stroke-sample dsv-stroke-sample--bold">
            <Icon name="star" size={20} />
            bold
          </span>
        </div>
      </Demo>

      <Demo title="Responsive grid + containers">
        <div style={{ width: "100%" }}>
          <div className="dsv-grid-sm" style={{ marginBottom: "var(--space-2)" }}>
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                style={{
                  height: "var(--space-4)",
                  background: "var(--color-accent-subtle)",
                  borderRadius: "var(--radius-sm)",
                }}
              />
            ))}
          </div>
          <div className="dsv-grid-md" style={{ marginBottom: "var(--space-2)" }}>
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                style={{
                  height: "var(--space-4)",
                  background: "var(--color-accent-muted)",
                  borderRadius: "var(--radius-sm)",
                }}
              />
            ))}
          </div>
          <div className="dsv-stack" style={{ gap: "var(--space-1)" }}>
            <div
              className="dsv-container-xs"
              style={{
                background: "var(--color-tint-subtle)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--font-size-xs)",
                padding: "var(--space-1) var(--space-2)",
              }}
            >
              container xs
            </div>
            <div
              className="dsv-container-xl"
              style={{
                background: "var(--color-tint-subtle)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--font-size-xs)",
                padding: "var(--space-1) var(--space-2)",
              }}
            >
              container xl
            </div>
            <div
              className="dsv-container-2xl"
              style={{
                background: "var(--color-tint-subtle)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--font-size-xs)",
                padding: "var(--space-1) var(--space-2)",
              }}
            >
              container 2xl
            </div>
          </div>
        </div>
      </Demo>

      <Demo title="Text measure">
        <div className="dsv-stack" style={{ gap: "var(--space-2)" }}>
          {MEASURES.map(([label, token, text]) => (
            <div key={label} className="dsv-stack" style={{ gap: "var(--space-1)" }}>
              <p className="dsv-prose" style={{ margin: 0, maxWidth: token ? `var(${token})` : undefined }}>
                {text}
              </p>
              <span>
                {token ? (
                  <VarVal name={token} />
                ) : (
                  <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
                    default (no cap)
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="Inverse surface + secondary accent">
        <div className="dsv-inline" style={{ alignItems: "stretch", flexWrap: "wrap" }}>
          <div
            style={{
              background: "var(--color-surface-inverse)",
              color: "var(--color-text-inverse)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-4)",
              minWidth: 200,
            }}
          >
            <div style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-sm)" }}>
              Inverse panel
            </div>
            <div style={{ fontSize: "var(--font-size-xs)", opacity: 0.8 }}>
              surface-inverse · text-on-accent
            </div>
          </div>
          <div
            style={{
              background: "var(--color-accent-secondary-subtle)",
              border: "var(--border-width-thin) solid var(--color-accent-secondary)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-4)",
              minWidth: 200,
            }}
          >
            <div
              style={{
                fontWeight: "var(--font-weight-semibold)",
                fontSize: "var(--font-size-sm)",
                color: "var(--color-accent-secondary)",
              }}
            >
              Secondary accent
            </div>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
              accent-secondary · secondary-subtle
            </div>
          </div>
        </div>
      </Demo>

      <Demo title="Spacing scale">
        <div className="dsv-stack" style={{ gap: "var(--space-1)", width: "100%" }}>
          {SPACING.map((s) => (
            <div key={s} className="dsv-inline" style={{ gap: "var(--space-2)" }}>
              <code className="dsv-code-inline" style={{ minWidth: 64 }}>
                {s}
              </code>
              <div
                style={{
                  width: `var(--space-${s})`,
                  maxWidth: "100%",
                  height: "var(--space-2)",
                  minWidth: 2,
                  background: "var(--color-accent)",
                  borderRadius: "var(--radius-sm)",
                }}
              />
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="Shape — radius ends + medium border">
        <div className="dsv-inline" style={{ gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div
            style={{
              width: 96,
              height: 64,
              background: "var(--color-accent-subtle)",
              borderRadius: "var(--radius-xs)",
              border: "var(--border-width-medium) solid var(--color-accent-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "var(--font-size-xs)",
              fontFamily: "var(--font-mono)",
            }}
          >
            xs
          </div>
          <div
            style={{
              width: 96,
              height: 64,
              background: "var(--color-accent-subtle)",
              borderRadius: "var(--radius-3xl)",
              border: "var(--border-width-medium) solid var(--color-accent-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "var(--font-size-xs)",
              fontFamily: "var(--font-mono)",
            }}
          >
            3xl
          </div>
        </div>
      </Demo>

      <Demo title="Control density">
        <div className="dsv-stack" style={{ gap: "var(--space-2)", width: "100%" }}>
          {DENSITY.map(([s, pad]) => (
            <div
              key={s}
              className="dsv-inline"
              style={{
                gap: "var(--icon-gap-sm)",
                background: "var(--color-surface)",
                border: "var(--control-border-width) solid var(--color-border)",
                borderRadius: "var(--control-radius)",
                padding: pad,
              }}
            >
              <Icon name="search" size={14} />
              <span style={{ fontSize: "var(--font-size-sm)" }}>Density {s}</span>
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="Modal widths + input heights">
        <div className="dsv-stack" style={{ gap: "var(--space-2)", width: "100%" }}>
          {MODAL_WIDTHS.map(([s, w]) => (
            <div
              key={s}
              style={{
                maxWidth: w,
                width: "100%",
                background: "var(--color-surface-raised)",
                border: "var(--border-width-thin) solid var(--color-border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-2) var(--space-3)",
                fontSize: "var(--font-size-xs)",
                fontFamily: "var(--font-mono)",
              }}
            >
              modal-{s}
            </div>
          ))}
          <div className="dsv-inline" style={{ gap: "var(--space-2)", alignItems: "flex-end" }}>
            <input
              className="dsv-input"
              style={{ height: "var(--input-height-sm)", width: 120 }}
              placeholder="sm"
              aria-label="small input"
            />
            <input className="dsv-input" style={{ width: 120 }} placeholder="md" aria-label="medium input" />
            <input
              className="dsv-input"
              style={{ height: "var(--input-height-lg)", width: 120 }}
              placeholder="lg"
              aria-label="large input"
            />
          </div>
        </div>
      </Demo>

      <Demo title="Responsive tokens">
        <div className="dsv-stack" style={{ gap: "var(--space-3)", width: "100%" }}>
          <div
            style={{
              background: "var(--color-surface)",
              border: "var(--border-width-thin) solid var(--color-border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "var(--mobile-page-padding)",
            }}
          >
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", marginBottom: "var(--mobile-content-gap)" }}>
              mobile — page-padding · content-gap · grid-gap
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--mobile-grid-gap)" }}>
              <div style={{ height: "var(--space-8)", background: "var(--color-accent-subtle)", borderRadius: "var(--radius-sm)" }} />
              <div style={{ height: "var(--space-8)", background: "var(--color-accent-muted)", borderRadius: "var(--radius-sm)" }} />
            </div>
          </div>
          <div
            style={{
              background: "var(--color-surface)",
              border: "var(--border-width-thin) solid var(--color-border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "var(--desktop-page-padding)",
            }}
          >
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", marginBottom: "var(--desktop-content-gap)" }}>
              desktop — page-padding · content-gap · grid-gap
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--desktop-grid-gap)" }}>
              <div style={{ height: "var(--space-8)", background: "var(--color-accent-subtle)", borderRadius: "var(--radius-sm)" }} />
              <div style={{ height: "var(--space-8)", background: "var(--color-accent-muted)", borderRadius: "var(--radius-sm)" }} />
              <div style={{ height: "var(--space-8)", background: "var(--color-accent-subtle)", borderRadius: "var(--radius-sm)" }} />
            </div>
          </div>
          <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
            section rhythm — mobile{" "}
            <span
              style={{
                padding: "var(--mobile-section-spacing) 0",
                background: "var(--color-accent-subtle)",
                color: "var(--color-text)",
              }}
            >
              pad
            </span>{" "}
            - desktop{" "}
            <span
              style={{
                padding: "var(--desktop-section-spacing) 0",
                background: "var(--color-accent-muted)",
                color: "var(--color-text)",
              }}
            >
              pad
            </span>
          </div>
        </div>
      </Demo>

      <Demo title="Control + icon sizes">
        <div className="dsv-stack" style={{ gap: "var(--space-4)", width: "100%" }}>
          <div className="dsv-inline" style={{ gap: "var(--space-2)", alignItems: "flex-end", flexWrap: "wrap" }}>
            {CONTROL_SIZES.map(([s, h]) => (
              <span key={s} className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
                <span
                  style={{
                    width: h,
                    height: h,
                    background: "var(--color-surface-sunken)",
                    borderRadius: "var(--radius-sm)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "var(--font-size-xs)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {s}
                </span>
                <VarVal name={`--size-control-${s}`} />
              </span>
            ))}
          </div>
          <div className="dsv-inline" style={{ gap: "var(--space-3)", alignItems: "flex-end", flexWrap: "wrap" }}>
            {ICON_SIZES.map(([s, token, px]) => (
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
          <div
            style={{
              maxWidth: "var(--composition-max-width)",
              background: "var(--color-tint-subtle)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--font-size-xs)",
              padding: "var(--space-1) var(--space-2)",
            }}
          >
            composition-max-width
          </div>
          <div
            style={{
              maxWidth: "var(--composition-max-width-wide)",
              background: "var(--color-tint-subtle)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--font-size-xs)",
              padding: "var(--space-1) var(--space-2)",
            }}
          >
            composition-max-width-wide
          </div>
          <div className="dsv-inline" style={{ gap: "var(--space-2)", flexWrap: "wrap" }}>
            {OFFSETS.map(([label, token, cls]) => (
              <span key={label} className="dsv-stack" style={{ gap: "var(--space-1)" }}>
                <span
                  className={cls}
                  style={{
                    background: "var(--color-accent-subtle)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "var(--font-size-xs)",
                    padding: "var(--space-1) var(--space-2)",
                    alignSelf: "flex-start",
                  }}
                >
                  offset-{label}
                </span>
                <VarVal name={token} />
              </span>
            ))}
          </div>
          <div className="dsv-inline" style={{ gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
            {ASPECTS.map(([w, ar, label]) => (
              <span key={label} className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
                <span
                  style={{
                    width: w,
                    aspectRatio: ar,
                    background: "var(--color-accent-muted)",
                    borderRadius: "var(--radius-sm)",
                  }}
                />
                <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", fontFamily: "var(--font-mono)" }}>
                  {label}
                </span>
              </span>
            ))}
          </div>
        </div>
      </Demo>
    </>
  );
}
