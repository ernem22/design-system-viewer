// Shared bits used across component demos and screens.
import { createContext, forwardRef, useContext, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { tokensForDemo } from "./tokenUsage.js";
import { ALL_TOKENS, baseValue, demoId, kindOf, useTokenOverrides } from "./tokenOverrides.js";

// Radix *.Portal components default to document.body, which sits outside
// Compare's per-column inline token scope (each cmp-col carries its own
// system's tokens as an inline style, not :root) — so a Dialog/Popover/
// Select/etc opened from one column would render with another column's (or
// the fallback) tokens instead of its own. Compare provides its column's DOM
// node here; every *.Portal below reads it and falls back to Radix's own
// default (document.body) when no Provider is present, i.e. the single-
// system Preview page.
export const PortalContainerContext = createContext(undefined);
export function usePortalContainer() {
  return useContext(PortalContainerContext);
}

export function Icon({ name, size = 16, className = "", ...rest }) {
  const p = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
    className: ["dsv-ico", className].filter(Boolean).join(" "),
    ...rest,
  };
  const paths = {
    check: <polyline points="20 6 9 17 4 12" />,
    minus: <line x1="5" y1="12" x2="19" y2="12" />,
    chevronDown: <polyline points="6 9 12 15 18 9" />,
    chevronRight: <polyline points="9 18 15 12 9 6" />,
    chevronLeft: <polyline points="15 18 9 12 15 6" />,
    x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    eye: <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    dots: <><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>,
    bold: <><path d="M6 4h8a4 4 0 0 1 0 8H6z" /><path d="M6 12h9a4 4 0 0 1 0 8H6z" /></>,
    italic: <><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></>,
    underline: <><path d="M6 3v7a6 6 0 0 0 12 0V3" /><line x1="4" y1="21" x2="20" y2="21" /></>,
    alignLeft: <><line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" /></>,
    alignCenter: <><line x1="18" y1="10" x2="6" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="18" y1="18" x2="6" y2="18" /></>,
    alignRight: <><line x1="21" y1="10" x2="7" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="7" y2="18" /></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
    trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
    star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
    sliders: <><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    inbox: <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.2.61.79 1.05 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  };
  return <svg {...p} aria-hidden="true">{paths[name] || null}</svg>;
}

export const Button = forwardRef(function Button(
  { variant = "solid", size = "md", className = "", ...rest }, ref,
) {
  const cls = ["dsv-btn", `dsv-btn--${variant}`, size !== "md" && `dsv-btn--${size}`, className]
    .filter(Boolean)
    .join(" ");
  return <button ref={ref} className={cls} {...rest} />;
});

export function Field({ label, hint, error, id, children }) {
  return (
    <div className="dsv-field">
      {label && <label className="dsv-label" htmlFor={id}>{label}</label>}
      {children}
      {error ? <span className="dsv-hint dsv-hint--err">{error}</span>
        : hint ? <span className="dsv-hint">{hint}</span> : null}
    </div>
  );
}

const isColorValue = (v) => /^(#|rgb|hsl|oklch|color\(|color-mix)/i.test(v);
// Long shadow/gradient/composite values would blow out a row — keep just
// enough to recognize the value at a glance.
const shortValue = (v, max = 30) => (v.length > max ? v.slice(0, max - 1) + "…" : v);
const hexOf = (v) => (/^#[0-9a-f]{6}$/i.test(v) ? v : "#888888");

function TokenSwatch({ value }) {
  if (!value || !isColorValue(value)) return null;
  return <span className="dsv-token-swatch" style={{ background: value }} aria-hidden="true" />;
}

const KIND_ORDER = ["color", "length", "shadow", "motion", "type", "number", "raw"];
const KIND_LABEL = { color: "Colors", length: "Lengths & sizes", shadow: "Shadows", motion: "Motion", type: "Type", number: "Numbers", raw: "Other" };

/** Inline "use a different token here" search — same kind only, scoped to one demo. */
function SwapPicker({ name, onPick }) {
  const [q, setQ] = useState("");
  const bareKind = kindOf(name);
  const candidates = useMemo(() => {
    const query = q.trim().toLowerCase();
    return ALL_TOKENS
      .filter((t) => t.name !== name && kindOf(t.name) === bareKind)
      .filter((t) => !query || t.name.toLowerCase().includes(query) || t.group.toLowerCase().includes(query));
  }, [q, name, bareKind]);
  const shown = candidates.slice(0, 40);

  return (
    <div className="dsv-token-editor">
      <div className="dsv-rail-filter dsv-token-picker-search">
        <Icon name="search" size={14} />
        <input
          autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${bareKind} tokens…`} aria-label="Search tokens"
        />
      </div>
      <div className="dsv-token-picker-list" role="listbox">
        {shown.length === 0 && <div className="dsv-token-picker-empty dsv-muted">No matches</div>}
        {shown.map((t) => (
          <button key={t.name} type="button" className="dsv-token-picker-item" onClick={() => onPick(t.name)}>
            <TokenSwatch value={baseValue(t.name)} />
            <span className="dsv-token-picker-name">{t.name}</span>
            <span className="dsv-token-picker-group dsv-muted">{t.group}</span>
          </button>
        ))}
        {candidates.length > shown.length && (
          <div className="dsv-token-picker-more dsv-muted">+{candidates.length - shown.length} more — keep typing to narrow</div>
        )}
      </div>
    </div>
  );
}

/** Inline "change what this token equals" editor — global, edits the token itself. */
function ValueEditor({ name, value, onChange }) {
  return (
    <div className="dsv-token-editor dsv-token-value-editor">
      {kindOf(name) === "color" && (
        <input
          type="color" className="dsv-token-color-input" value={hexOf(value)}
          onChange={(e) => onChange(e.target.value)} aria-label={`${name} color picker`}
        />
      )}
      <input
        type="text" className="dsv-input dsv-token-value-input" value={value}
        onChange={(e) => onChange(e.target.value)} spellCheck={false}
        placeholder="CSS value…" aria-label={`${name} value`}
      />
    </div>
  );
}

function TokenRow({ id, name, ctx }) {
  const [mode, setMode] = useState(null); // null | "swap" | "edit"
  const swappedTo = ctx.swaps[id]?.[name];
  const isValueEdited = name in ctx.valueEdits;
  const value = ctx.valueInDemo(id, name);

  return (
    <div className="dsv-token-row">
      <div className="dsv-token-row-main">
        <TokenSwatch value={value} />
        <code className="dsv-token-row-name">{name}</code>
        {swappedTo ? (
          <span className="dsv-token-row-swap">
            <Icon name="chevronRight" size={11} />
            <code>{swappedTo}</code>
            <button type="button" className="dsv-token-row-undo" title={`Stop using ${swappedTo} here`} onClick={() => ctx.clearSwap(id, name)}>
              <Icon name="x" size={10} />
            </button>
          </span>
        ) : (
          <span className="dsv-token-row-value" title={value}>{shortValue(value)}</span>
        )}
        {isValueEdited && (
          <span className="dsv-token-row-edited" title={`${name} value edited — affects every use of this token`}>
            edited
            <button type="button" className="dsv-token-row-undo" title={`Revert ${name}'s value`} onClick={() => ctx.clearValueEdit(name)}>
              <Icon name="x" size={10} />
            </button>
          </span>
        )}
        <span className="dsv-token-row-actions">
          <button type="button" className={mode === "swap" ? "is-active" : ""} onClick={() => setMode(mode === "swap" ? null : "swap")}>
            Use another token here
          </button>
          <button type="button" className={mode === "edit" ? "is-active" : ""} onClick={() => setMode(mode === "edit" ? null : "edit")}>
            Edit value
          </button>
        </span>
      </div>
      {mode === "swap" && (
        <SwapPicker name={name} onPick={(picked) => { ctx.setSwap(id, name, picked); setMode(null); }} />
      )}
      {mode === "edit" && (
        <ValueEditor name={name} value={ctx.globalValue(name)} onChange={(v) => ctx.setValueEdit(name, v)} />
      )}
    </div>
  );
}

/** Drawer listing every token a Demo uses — swap what it reads here only, or edit the token's own value everywhere. */
function TokenDrawer({ title, id, tokens, ctx }) {
  const portalContainer = usePortalContainer();
  const groups = useMemo(() => {
    const byKind = new Map();
    for (const t of tokens) {
      const k = kindOf(t);
      if (!byKind.has(k)) byKind.set(k, []);
      byKind.get(k).push(t);
    }
    return KIND_ORDER.filter((k) => byKind.has(k)).map((k) => [k, byKind.get(k)]);
  }, [tokens]);
  const swapCount = Object.keys(ctx.swaps[id] || {}).length;

  return (
    <Dialog.Portal container={portalContainer}>
      <Dialog.Overlay className="dsv-drawer-overlay" />
      <Dialog.Content className="dsv-drawer">
        <div className="dsv-drawer-head">
          <div>
            <Dialog.Title asChild><h3>{title}</h3></Dialog.Title>
            <Dialog.Description asChild><p className="dsv-muted">{tokens.length} token{tokens.length === 1 ? "" : "s"} used here</p></Dialog.Description>
          </div>
          <Dialog.Close asChild>
            <button type="button" className="dsv-btn dsv-btn--ghost dsv-icon-btn" aria-label="Close"><Icon name="x" size={16} /></button>
          </Dialog.Close>
        </div>
        {swapCount > 0 && (
          <button type="button" className="dsv-drawer-reset" onClick={() => ctx.clearSwapsIn(id)}>
            Reset {swapCount} swap{swapCount === 1 ? "" : "s"} in this component
          </button>
        )}
        <div className="dsv-drawer-body">
          {groups.map(([kind, names]) => (
            <div key={kind} className="dsv-drawer-group">
              <div className="dsv-drawer-group-label">{KIND_LABEL[kind]}</div>
              {names.map((name) => <TokenRow key={name} id={id} name={name} ctx={ctx} />)}
            </div>
          ))}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export function Demo({ title, children }) {
  const tokens = tokensForDemo(title);
  const ctx = useTokenOverrides();
  const id = demoId(title);
  const [open, setOpen] = useState(false);

  const swapStyle = ctx
    ? Object.fromEntries(Object.entries(ctx.swaps[id] || {}).map(([target, source]) => [target, `var(${source})`]))
    : undefined;
  const hasEdits = ctx && (Object.keys(ctx.swaps[id] || {}).length > 0);

  return (
    <div className="dsv-block" style={swapStyle}>
      <div className="dsv-block-head">
        <h3>{title}</h3>
        {ctx && tokens.length > 0 && (
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <button type="button" className={`dsv-token-drawer-trigger${hasEdits ? " has-edits" : ""}`} title={`${tokens.length} tokens used here — click to inspect or edit`}>
                <Icon name="sliders" size={13} />
                {tokens.length}
              </button>
            </Dialog.Trigger>
            {open && <TokenDrawer title={title} id={id} tokens={tokens} ctx={ctx} />}
          </Dialog.Root>
        )}
      </div>
      <div className="dsv-row">{children}</div>
    </div>
  );
}
