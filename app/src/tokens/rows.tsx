import { memo, type CSSProperties } from "react";
import type { Token } from "../systems/store.ts";
import { TokenEditControl } from "./InlineEditor.tsx";
import "./InlineEditor.css";
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
  /** Name of the token whose inline editor is open (single-open, lifted so
     double-click and the Update button drive the same Popover). */
  editingName: string | null;
  onEdit: (token: Token | null) => void;
  onSave: (name: string, value: string) => void;
}

export interface RendererProps extends RowCallbacks {
  tokens: Token[];
}

const varOf = (name: string) => `var(${name})`;

/**
 * Shared row shell: label (name + value + ref badge) on the left, the
 * kind-specific demo plus the Update affordance on the right. Click = copy +
 * inspect; Update button or double-click = inline edit (no copy).
 */
export const TokenRow = memo(function TokenRow({
  token,
  demo,
  selectedName,
  onPick,
  editingName,
  onEdit,
  onSave,
}: { token: Token; demo: React.ReactNode } & RowCallbacks) {
  return (
    <div
      className="tok-row"
      data-token={token.name}
      aria-selected={token.name === selectedName || undefined}
      title="click to copy — double-click or Update to edit"
      onClick={() => onPick(token)}
      onDoubleClick={() => onEdit(token)}
    >
      <div className="tok-row-label">
        <b>{token.name}</b>
        <span>{token.value}</span>
        <RefBadge value={token.value} />
      </div>
      <div className="tok-row-demo">
        {demo}
        <TokenEditControl
          token={token}
          open={editingName === token.name}
          onOpenChange={(next) => onEdit(next ? token : null)}
          onSave={onSave}
        />
      </div>
    </div>
  );
});

const Rows = memo(function Rows({
  tokens,
  render,
  selectedName,
  onPick,
  editingName,
  onEdit,
  onSave,
}: RendererProps & { render: (t: Token) => React.ReactNode }) {
  return (
    <div className="tok-rows">
      {tokens.map((t) => (
        <TokenRow
          key={t.name}
          token={t}
          demo={render(t)}
          selectedName={selectedName}
          onPick={onPick}
          editingName={editingName}
          onEdit={onEdit}
          onSave={onSave}
        />
      ))}
    </div>
  );
});

/** Swatch grid for color kinds (old colorGrid). */
export const ColorGrid = memo(function ColorGrid(props: RendererProps) {
  const { tokens, selectedName, onPick, editingName, onEdit, onSave } = props;
  return (
    <div className="tok-swatches">
      {tokens.map((t) => (
        <div
          key={t.name}
          className="tok-swatch"
          data-token={t.name}
          aria-selected={t.name === selectedName || undefined}
          title="click to copy — double-click or Update to edit"
          onClick={() => onPick(t)}
          onDoubleClick={() => onEdit(t)}
        >
          <div className="tok-chip" style={{ "--val": varOf(t.name) } as CSSProperties} />
          <div className="tok-swatch-name">
            {t.name}
            <RefBadge value={t.value} />
          </div>
          <div className="tok-swatch-value">{t.value}</div>
          <TokenEditControl
            token={t}
            open={editingName === t.name}
            onOpenChange={(next) => onEdit(next ? t : null)}
            onSave={onSave}
          />
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
  return (
    <Rows
      {...props}
      render={(t) => (
        <div className="tok-shadowbox" style={{ opacity: varOf(t.name), background: "var(--color-accent)" }} />
      )}
    />
  );
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
export const RawTable = memo(function RawTable({ tokens, selectedName, onPick, editingName, onEdit, onSave }: RendererProps) {
  return (
    <div className="tok-tablewrap">
      <table className="tok-raw">
        <tbody>
          {tokens.map((t) => (
            <tr
              key={t.name}
              data-token={t.name}
              aria-selected={t.name === selectedName || undefined}
              title="click to copy — double-click or Update to edit"
              onClick={() => onPick(t)}
              onDoubleClick={() => onEdit(t)}
            >
              <td>{t.name}</td>
              <td>
                {t.value}
                <RefBadge value={t.value} />
              </td>
              <td>
                <TokenEditControl
                  token={t}
                  open={editingName === t.name}
                  onOpenChange={(next) => onEdit(next ? t : null)}
                  onSave={onSave}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
