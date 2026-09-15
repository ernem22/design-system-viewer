import { memo, type CSSProperties } from "react";
import type { Token } from "../systems/store.ts";
import { isRef } from "./tokenUtils.ts";
import "./rows.css";

export function RefBadge({ value }: { value: string }) {
  if (!isRef(value)) return null;
  return (
    <span className="tok-ref" title="references another token">
      →ref
    </span>
  );
}

export interface RowCallbacks {
  selectedName: string | null;
  onPick: (token: Token) => void;
}

export interface RendererProps extends RowCallbacks {
  tokens: Token[];
}

const varOf = (name: string) => `var(${name})`;

/**
 * Shared row shell: label (name + value + ref badge) on the left, the
 * kind-specific demo on the right. Click = copy + inspect (old copy-on-click
 * + Update buttons collapse into one gesture until the editor lands).
 */
export const TokenRow = memo(function TokenRow({
  token,
  demo,
  selectedName,
  onPick,
}: { token: Token; demo: React.ReactNode } & RowCallbacks) {
  return (
    <div
      className="tok-row"
      data-token={token.name}
      aria-selected={token.name === selectedName || undefined}
      title="click to copy"
      onClick={() => onPick(token)}
    >
      <div className="tok-row-label">
        <b>{token.name}</b>
        <span>{token.value}</span>
        <RefBadge value={token.value} />
      </div>
      <div className="tok-row-demo">{demo}</div>
    </div>
  );
});

const Rows = memo(function Rows({
  tokens,
  render,
  selectedName,
  onPick,
}: RendererProps & { render: (t: Token) => React.ReactNode }) {
  return (
    <div className="tok-rows">
      {tokens.map((t) => (
        <TokenRow key={t.name} token={t} demo={render(t)} selectedName={selectedName} onPick={onPick} />
      ))}
    </div>
  );
});

/** Swatch grid for color kinds (old colorGrid). */
export const ColorGrid = memo(function ColorGrid(props: RendererProps) {
  const { tokens, selectedName, onPick } = props;
  return (
    <div className="tok-swatches">
      {tokens.map((t) => (
        <div
          key={t.name}
          className="tok-swatch"
          data-token={t.name}
          aria-selected={t.name === selectedName || undefined}
          title="click to copy"
          onClick={() => onPick(t)}
        >
          <div className="tok-chip" style={{ "--val": varOf(t.name) } as CSSProperties} />
          <div className="tok-swatch-name">
            {t.name}
            <RefBadge value={t.value} />
          </div>
          <div className="tok-swatch-value">{t.value}</div>
        </div>
      ))}
    </div>
  );
});

export const BarRow = memo(function BarRow(props: RendererProps) {
  return <Rows {...props} render={(t) => <div className="tok-bar" style={{ width: varOf(t.name) }} />} />;
});

export const RadiusRow = memo(function RadiusRow(props: RendererProps) {
  return <Rows {...props} render={(t) => <div className="tok-radiusbox" style={{ borderRadius: varOf(t.name) }} />} />;
});

export const ShadowRow = memo(function ShadowRow(props: RendererProps) {
  return <Rows {...props} render={(t) => <div className="tok-shadowbox" style={{ boxShadow: varOf(t.name) }} />} />;
});

export const MotionRow = memo(function MotionRow(props: RendererProps) {
  return (
    <Rows {...props} render={(t) => <div className="tok-motionbox" style={{ transitionDuration: varOf(t.name) }} />} />
  );
});

export const EasingRow = memo(function EasingRow(props: RendererProps) {
  return (
    <Rows
      {...props}
      render={(t) => (
        <div
          className="tok-motionbox"
          style={{ transitionTimingFunction: varOf(t.name), transitionDuration: "420ms" }}
        />
      )}
    />
  );
});

export const OpacityRow = memo(function OpacityRow(props: RendererProps) {
  return <Rows {...props} render={(t) => <div className="tok-shadowbox" style={{ opacity: varOf(t.name) }} />} />;
});

export const TypeRow = memo(function TypeRow(props: RendererProps) {
  return (
    <Rows
      {...props}
      render={(t) => (
        <div className="tok-typespec" style={{ fontSize: varOf(t.name) }}>
          Aa Bb Cc — sample text 0123
        </div>
      )}
    />
  );
});

export const FontFamilyRow = memo(function FontFamilyRow(props: RendererProps) {
  return (
    <Rows
      {...props}
      render={(t) => (
        <div className="tok-typespec" style={{ fontFamily: varOf(t.name) }}>
          Aa Bb Cc — {t.value}
        </div>
      )}
    />
  );
});

export const FontWeightRow = memo(function FontWeightRow(props: RendererProps) {
  return (
    <Rows
      {...props}
      render={(t) => (
        <div className="tok-typespec" style={{ fontWeight: `var(${t.name})` } as CSSProperties}>
          Aa Bb Cc — weight {t.value}
        </div>
      )}
    />
  );
});

export const LineHeightRow = memo(function LineHeightRow(props: RendererProps) {
  return (
    <Rows
      {...props}
      render={(t) => (
        <div className="tok-typespec tok-lineheight" style={{ lineHeight: varOf(t.name) }}>
          Line one<br />
          Line two — {t.value}
        </div>
      )}
    />
  );
});

export const LetterSpacingRow = memo(function LetterSpacingRow(props: RendererProps) {
  return (
    <Rows
      {...props}
      render={(t) => (
        <div className="tok-typespec" style={{ letterSpacing: varOf(t.name) }}>
          AV Va — letter spacing {t.value}
        </div>
      )}
    />
  );
});

export const NumberRow = memo(function NumberRow(props: RendererProps) {
  return <Rows {...props} render={(t) => <span className="tok-num">{t.value}</span>} />;
});

/** Breakpoint values render like NumberRow (old breakpointRow was byte-for-
   byte identical to numberRow) but stay a separate component so the id→
   renderer dispatch table matches the port plan 1:1. */
export const BreakpointRow = memo(function BreakpointRow(props: RendererProps) {
  return <Rows {...props} render={(t) => <span className="tok-num">{t.value}</span>} />;
});

/** Fallback table for kinds with no visual demo (old rawTable). */
export const RawTable = memo(function RawTable({ tokens, selectedName, onPick }: RendererProps) {
  return (
    <div className="tok-tablewrap">
      <table className="tok-raw">
        <tbody>
          {tokens.map((t) => (
            <tr
              key={t.name}
              data-token={t.name}
              aria-selected={t.name === selectedName || undefined}
              title="click to copy"
              onClick={() => onPick(t)}
            >
              <td>{t.name}</td>
              <td>
                {t.value}
                <RefBadge value={t.value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
