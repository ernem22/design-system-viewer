import { memo, type CSSProperties } from "react";
import type { Token } from "../systems/store.ts";
import { isRef } from "./tokenUtils.ts";
import "./rows.css";

export function RefBadge({ value }: { value: string }) {
  if (!isRef(value)) return null;
  return (
    <span className="tok-ref" title="references another token" role="img" aria-label="references another token">
      →ref
    </span>
  );
}

export interface RowCallbacks {
  selectedName: string | null;
  onPick: (token: Token) => void;
  /** Name of the token the inspector should focus (double-click sets it via
     onEdit; TokensProps reads it — the gallery itself edits nothing). */
  editingName: string | null;
  onEdit: (token: Token | null) => void;
  onSave: (name: string, value: string) => void;
}

export interface RendererProps extends RowCallbacks {
  tokens: Token[];
}

const varOf = (name: string) => `var(${name})`;

/**
 * Keyboard activator for pickable rows and swatches: Enter or Space picks
 * the token. Events from the inner Update button or form fields keep their
 * native behaviour.
 */
function pickKeyDown(e: React.KeyboardEvent, onPick: () => void): void {
  if (e.key !== "Enter" && e.key !== " ") return;
  const target = e.target as HTMLElement | null;
  if (target && target.closest("button, input, select, textarea, a")) return;
  e.preventDefault();
  onPick();
}

/**
 * The one token row. Name, value and demo sit in fixed grid columns so they
 * line up between every group; the optional `demo` is the only thing that
 * varies by kind — flat groups (no visual preview) pass nothing and keep
 * the same columns, instead of a second table renderer. Click = copy +
 * inspect; double-click = select + focus the inspector's edit form.
 */
export const TokenRow = memo(function TokenRow({
  token,
  demo,
  selectedName,
  onPick,
  onEdit,
}: { token: Token; demo?: React.ReactNode } & Pick<
  RowCallbacks,
  "selectedName" | "onPick" | "onEdit"
>) {
  return (
    <div
      className="tok-row"
      data-token={token.name}
      role="option"
      aria-selected={token.name === selectedName}
      tabIndex={0}
      title="click to copy — double-click to edit"
      onClick={() => onPick(token)}
      onDoubleClick={() => {
        onPick(token);
        onEdit(token);
      }}
      onKeyDown={(e) => pickKeyDown(e, () => onPick(token))}
    >
      <b className="tok-row-name">{token.name}</b>
      <span className="tok-row-value">
        {token.value}
        <RefBadge value={token.value} />
      </span>
      <div className="tok-row-demo">{demo}</div>
    </div>
  );
});

/** Row list for the one row component; `render` supplies the kind's demo. */
const TokenRows = memo(function TokenRows(props: RendererProps & { render?: (t: Token) => React.ReactNode }) {
  const { tokens, render, selectedName, onPick, onEdit } = props;
  return (
    <div className="tok-rows" role="listbox" aria-label="Tokens">
      {tokens.map((t) => (
        <TokenRow
          key={t.name}
          token={t}
          demo={render?.(t)}
          selectedName={selectedName}
          onPick={onPick}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
});

/** Swatch grid for color kinds (old colorGrid). Click = copy + inspect;
    double-click = select + focus the inspector's edit form. */
export const ColorGrid = memo(function ColorGrid(props: RendererProps) {
  const { tokens, selectedName, onPick, onEdit } = props;
  return (
    <div className="tok-swatches" role="listbox" aria-label="Tokens">
      {tokens.map((t) => (
        <div
          key={t.name}
          className="tok-swatch"
          data-token={t.name}
          role="option"
          aria-selected={t.name === selectedName}
          tabIndex={0}
          title="click to copy — double-click to edit"
          onClick={() => onPick(t)}
          onDoubleClick={() => {
            onPick(t);
            onEdit(t);
          }}
          onKeyDown={(e) => pickKeyDown(e, () => onPick(t))}
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
  return <TokenRows {...props} render={(t) => <div className="tok-bar" style={{ width: varOf(t.name) }} />} />;
});

export const RadiusRow = memo(function RadiusRow(props: RendererProps) {
  return <TokenRows {...props} render={(t) => <div className="tok-radiusbox" style={{ borderRadius: varOf(t.name) }} />} />;
});

export const ShadowRow = memo(function ShadowRow(props: RendererProps) {
  return <TokenRows {...props} render={(t) => <div className="tok-shadowbox" style={{ boxShadow: varOf(t.name) }} />} />;
});

export const MotionRow = memo(function MotionRow(props: RendererProps) {
  return (
    <TokenRows {...props} render={(t) => <div className="tok-motionbox" style={{ transitionDuration: varOf(t.name) }} />} />
  );
});

export const EasingRow = memo(function EasingRow(props: RendererProps) {
  return (
    <TokenRows
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
    <TokenRows
      {...props}
      render={(t) => (
        <div className="tok-shadowbox" style={{ opacity: varOf(t.name), background: "var(--color-accent)" }} />
      )}
    />
  );
});

export const TypeRow = memo(function TypeRow(props: RendererProps) {
  return (
    <TokenRows
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
    <TokenRows
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
    <TokenRows
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
    <TokenRows
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
    <TokenRows
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
  return <TokenRows {...props} render={(t) => <span className="tok-num">{t.value}</span>} />;
});

/** Breakpoint values render like NumberRow (old breakpointRow was byte-for-
   byte identical to numberRow) but stay a separate component so the id→
   renderer dispatch table matches the port plan 1:1. */
export const BreakpointRow = memo(function BreakpointRow(props: RendererProps) {
  return <TokenRows {...props} render={(t) => <span className="tok-num">{t.value}</span>} />;
});

/** Flat groups: kinds with no visual demo render through TokenRow with an
    empty demo slot, so name/value/action keep the same columns as every
    other group (old rawTable was a second row design). */
export const RawRows = memo(function RawRows(props: RendererProps) {
  return <TokenRows {...props} />;
});
