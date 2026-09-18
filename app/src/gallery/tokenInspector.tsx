// Preview-tab token inspector chrome — ported from preview/src/ui.jsx's
// TokenChip/TokenDrawer/SwapPicker/ValueEditor/TokenScopeTrigger assembly,
// adapted to this repo's Radix namespace-import style and shared Icon set.
// The drawer/dialog shell itself lives in preview/PreviewProps.tsx (it needs
// App-owned patchToken plumbing); everything content-level lives here next
// to the <Demo> header that hosts the trigger.
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { tokensForDemo } from "../lib/tokenUsage.ts";
import {
  ALL_TOKENS,
  clearAll,
  clearSwap,
  clearSwapsIn,
  clearValueEdit,
  demoId,
  kindOf,
  openScope,
  selectScope,
  setSwap,
  setValueEdit,
  useInspector,
} from "../lib/tokenOverrides.ts";
import type { TokenKind } from "../lib/tokenOverrides.ts";
import { Icon } from "../lib/icons.tsx";
import "./tokenInspector.css";

const isColorValue = (v: string) => /^(#|rgb|hsl|oklch|color\(|color-mix)/i.test(v.trim());
// Long shadow/gradient/composite values would blow out a row — keep just
// enough to recognize the value at a glance.
const shortValue = (v: string, max = 30) => (v.length > max ? v.slice(0, max - 1) + "…" : v);
const hexOf = (v: string) => (/^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : "#888888");

function TokenSwatch({ value }: { value: string }) {
  if (!value || !isColorValue(value)) return null;
  return <span className="dsv-token-swatch" style={{ background: value }} aria-hidden="true" />;
}

const KIND_ORDER: TokenKind[] = ["color", "length", "shadow", "motion", "type", "number", "raw"];
const KIND_LABEL: Record<TokenKind, string> = {
  color: "Colors",
  length: "Lengths & sizes",
  shadow: "Shadows",
  motion: "Motion",
  type: "Type",
  number: "Numbers",
  raw: "Other",
};

/** Inline "use a different token here" search — same kind only, scoped to one demo. */
function SwapPicker({
  name,
  valueOf,
  onPick,
}: {
  name: string;
  valueOf: (name: string) => string;
  onPick: (picked: string) => void;
}) {
  const [q, setQ] = useState("");
  const bareKind = kindOf(name);
  const candidates = useMemo(() => {
    const query = q.trim().toLowerCase();
    return ALL_TOKENS.filter((t) => t.name !== name && kindOf(t.name) === bareKind).filter(
      (t) => !query || t.name.toLowerCase().includes(query) || t.group.toLowerCase().includes(query),
    );
  }, [q, name, bareKind]);
  const shown = candidates.slice(0, 40);

  return (
    <div className="dsv-token-editor">
      <div className="dsv-token-picker-search">
        <Icon name="search" size={14} />
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${bareKind} tokens…`}
          aria-label="Search tokens"
        />
      </div>
      <div className="dsv-token-picker-list" role="listbox">
        {shown.length === 0 && <div className="dsv-token-picker-empty dsv-muted">No matches</div>}
        {shown.map((t) => (
          <button key={t.name} type="button" className="dsv-token-picker-item" onClick={() => onPick(t.name)}>
            <TokenSwatch value={valueOf(t.name)} />
            <span className="dsv-token-picker-name">{t.name}</span>
            <span className="dsv-token-picker-group dsv-muted">{t.group}</span>
          </button>
        ))}
        {candidates.length > shown.length && (
          <div className="dsv-token-picker-more dsv-muted">
            +{candidates.length - shown.length} more — keep typing to narrow
          </div>
        )}
      </div>
    </div>
  );
}

/** Inline "change what this token equals" editor — global, but a Preview
    what-if: draft commits to the ephemeral override layer (Esc cancels),
    never through patchToken into the stored system (#27). The color input
    commits each pick. A saved override is what makes the row's "edited"
    badge appear; Reset (both layers) reverts it. */
function ValueEditor({
  name,
  value,
  onSetValueEdit,
}: {
  name: string;
  value: string;
  onSetValueEdit: (name: string, value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // A change from anywhere (this editor's own commit included) refreshes the
  // draft, so a reopened or externally-changed value never shows stale text.
  useEffect(() => {
    setDraft(value);
  }, [name, value]);

  const commit = (v: string) => {
    const trimmed = v.trim();
    if (trimmed && trimmed !== value) onSetValueEdit(name, trimmed);
  };

  return (
    <div className="dsv-token-editor dsv-token-value-editor">
      {kindOf(name) === "color" && (
        <input
          type="color"
          className="dsv-token-color-input"
          value={hexOf(value)}
          onChange={(e) => onSetValueEdit(name, e.target.value)}
          aria-label={`${name} color picker`}
        />
      )}
      <input
        type="text"
        className="dsv-input dsv-token-value-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        placeholder="CSS value…"
        aria-label={`${name} value`}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(value);
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

function TokenRow({
  scopeId,
  name,
  valueOf,
}: {
  scopeId: string;
  name: string;
  valueOf: (token: string) => string;
}) {
  const { swaps, valueEdits } = useInspector();
  const [mode, setMode] = useState<"swap" | "edit" | null>(null); // null | "swap" | "edit"
  const swappedTo = swaps[scopeId]?.[name];
  const isValueEdited = name in valueEdits;
  const value = swappedTo ? valueOf(swappedTo) : valueOf(name);

  return (
    <div className="dsv-token-row">
      <div className="dsv-token-row-main">
        <TokenSwatch value={value} />
        <code className="dsv-token-row-name">{name}</code>
        {swappedTo ? (
          <span className="dsv-token-row-swap">
            <Icon name="chevronRight" size={11} />
            <code>{swappedTo}</code>
            <button
              type="button"
              className="dsv-token-row-undo"
              title={`Stop using ${swappedTo} here`}
              onClick={() => clearSwap(scopeId, name)}
            >
              <Icon name="x" size={10} />
            </button>
          </span>
        ) : (
          <span className="dsv-token-row-value" title={value}>
            {shortValue(value)}
          </span>
        )}
        {isValueEdited && (
          <span className="dsv-token-row-edited" title={`${name} value overridden — affects every use of this token`}>
            edited
            <button
              type="button"
              className="dsv-token-row-undo"
              title={`Revert ${name}'s value`}
              onClick={() => clearValueEdit(name)}
            >
              <Icon name="x" size={10} />
            </button>
          </span>
        )}
        <span className="dsv-token-row-actions">
          <button
            type="button"
            className={mode === "swap" ? "is-active" : ""}
            onClick={() => setMode(mode === "swap" ? null : "swap")}
          >
            Use another token here
          </button>
          <button
            type="button"
            className={mode === "edit" ? "is-active" : ""}
            onClick={() => setMode(mode === "edit" ? null : "edit")}
          >
            Edit value
          </button>
        </span>
      </div>
      {mode === "swap" && (
        <SwapPicker
          name={name}
          valueOf={valueOf}
          onPick={(picked) => {
            setSwap(scopeId, name, picked);
            setMode(null);
          }}
        />
      )}
      {mode === "edit" && <ValueEditor name={name} value={valueOf(name)} onSetValueEdit={setValueEdit} />}
    </div>
  );
}

/** Shared head so the mobile overlay dialog and the docked desktop
    properties panel render the exact same content. Radix Title/Description
    need a Dialog ancestor — the docked panel isn't one, so it renders plain
    elements there. */
function ScopePanelHead({
  title,
  tokens,
  inDialog,
  onClose,
}: {
  title: string;
  tokens: string[];
  inDialog: boolean;
  onClose: () => void;
}) {
  const heading = inDialog ? (
    <div>
      <Dialog.Title asChild>
        <h3>{title}</h3>
      </Dialog.Title>
      <Dialog.Description asChild>
        <p className="dsv-muted">
          {tokens.length} token{tokens.length === 1 ? "" : "s"} used here
        </p>
      </Dialog.Description>
    </div>
  ) : (
    <div>
      <h3>{title}</h3>
      <p className="dsv-muted">
        {tokens.length} token{tokens.length === 1 ? "" : "s"} used here
      </p>
    </div>
  );
  return (
    <div className="dsv-drawer-head">
      {heading}
      {inDialog ? (
        <Dialog.Close asChild>
          <button type="button" className="dsv-btn dsv-btn--ghost dsv-icon-btn" aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </Dialog.Close>
      ) : (
        <button
          type="button"
          className="dsv-btn dsv-btn--ghost dsv-icon-btn"
          aria-label="Close panel"
          onClick={onClose}
        >
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

function ScopePanelBody({
  scopeId,
  tokens,
  valueOf,
}: {
  scopeId: string;
  tokens: string[];
  valueOf: (token: string) => string;
}) {
  const { swaps } = useInspector();
  const groups = useMemo(() => {
    const byKind = new Map<TokenKind, string[]>();
    for (const t of tokens) {
      const k = kindOf(t);
      const list = byKind.get(k) ?? [];
      list.push(t);
      byKind.set(k, list);
    }
    return KIND_ORDER.filter((k) => byKind.has(k)).map(
      (k) => [k, byKind.get(k) ?? []] as const,
    );
  }, [tokens]);
  const swapCount = Object.keys(swaps[scopeId] ?? {}).length;

  return (
    <>
      {swapCount > 0 && (
        <button type="button" className="dsv-drawer-reset" onClick={() => clearSwapsIn(scopeId)}>
          Reset {swapCount} swap{swapCount === 1 ? "" : "s"} in this component
        </button>
      )}
      <div className="dsv-drawer-body">
        {groups.map(([kind, names]) => (
          <div key={kind} className="dsv-drawer-group">
            <div className="dsv-drawer-group-label">{KIND_LABEL[kind]}</div>
            {names.map((name) => (
              <TokenRow key={name} scopeId={scopeId} name={name} valueOf={valueOf} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/** Docked right-panel content and mobile dialog body: the selected scope's
    tokens, or the empty state when nothing is selected. Both edits are
    EPHEMERAL here (value overrides + scoped swaps) — nothing reaches the
    stored system; the Tokens tab's inline editor is the persistent path. */
export function ScopePanel({
  valueOf,
  inDialog = false,
}: {
  valueOf: (token: string) => string;
  inDialog?: boolean;
}) {
  const { selected, swaps, valueEdits } = useInspector();
  const valueEditCount = Object.keys(valueEdits).length;
  if (!selected) {
    const totalSwaps = Object.values(swaps).reduce((n, demo) => n + Object.keys(demo).length, 0);
    return (
      <>
        <div className="dsv-drawer-head">
          <div>
            <h3>Properties</h3>
            <p className="dsv-muted">No component selected</p>
          </div>
        </div>
        <div className="dsv-drawer-body">
          <div className="dsv-props-empty">
            <Icon name="sliders" size={20} />
            <p>
              Click a component&apos;s <b>token count badge</b> to inspect its tokens here.
            </p>
          </div>
          {valueEditCount > 0 && (
            <div className="dsv-drawer-group">
              <div className="dsv-drawer-group-label">
                Value overrides ({valueEditCount})
              </div>
              <button
                type="button"
                className="dsv-drawer-reset dsv-drawer-reset--inline"
                onClick={() => Object.keys(valueEdits).forEach(clearValueEdit)}
              >
                Revert all value overrides
              </button>
            </div>
          )}
          {totalSwaps > 0 && (
            <div className="dsv-drawer-group">
              <div className="dsv-drawer-group-label">
                Scoped swaps ({totalSwaps})
              </div>
              <button
                type="button"
                className="dsv-drawer-reset dsv-drawer-reset--inline"
                onClick={clearAll}
              >
                Reset all swaps
              </button>
            </div>
          )}
        </div>
      </>
    );
  }
  return (
    <>
      <ScopePanelHead
        title={selected.title}
        tokens={selected.tokens}
        inDialog={inDialog}
        onClose={() => selectScope(null)}
      />
      <ScopePanelBody scopeId={selected.id} tokens={selected.tokens} valueOf={valueOf} />
    </>
  );
}

/** The small "N tokens" badge that opens a scope's inspector — one per Demo,
 * plus one per gallery section (screens have no Demos, so the section badge
 * is their only entry point). Renders nothing for untracked output (and
 * never in Compare, whose renderers don't mount Demo at all). */
export function TokenScopeTrigger({ title }: { title: string }) {
  const tokens = tokensForDemo(title);
  if (tokens.length === 0) return null;
  return <SectionScopeTrigger id={demoId(title)} title={title} tokens={tokens} />;
}

/** Section-level twin of the Demo badge above, keyed by the gallery entry id
 * instead of a Demo title — this is what gives screen entries (whole-Body,
 * zero <Demo> blocks) the same badge / drawer / swap / value-edit flow.
 * Tokens come from the caller (GallerySection resolves them via
 * tokensForEntry); scoping + panel plumbing is identical because ScopePanel
 * and the swap store are already id-agnostic. */
export function SectionScopeTrigger({
  id,
  title,
  tokens,
}: {
  id: string;
  title: string;
  tokens: string[];
}) {
  const { selected, swaps } = useInspector();
  if (tokens.length === 0) return null;
  const hasEdits = Object.keys(swaps[id] ?? {}).length > 0;
  const isActive = selected?.id === id;

  return (
    <button
      type="button"
      className={`dsv-token-drawer-trigger${hasEdits ? " has-edits" : ""}${isActive ? " is-active" : ""}`}
      title={`${tokens.length} tokens used here — click to inspect or edit`}
      aria-pressed={isActive}
      onClick={() => openScope({ id, title, tokens })}
    >
      <Icon name="sliders" size={13} />
      {tokens.length}
    </button>
  );
}

/** Inline style scoping a component's token swaps to its own subtree —
    each swap becomes `target: var(source)` on the Demo node, so only that
    node's descendants pick it up via inheritance. */
export function useScopeStyle(title: string): CSSProperties | undefined {
  return useSectionScopeStyle(demoId(title));
}

/** Section-level twin, keyed by gallery entry id — applied on the
    GallerySection node so screen swaps inherit across the whole Body
    without leaking into sibling sections. */
export function useSectionScopeStyle(id: string): CSSProperties | undefined {
  const { swaps } = useInspector();
  return useMemo(() => {
    const scope = swaps[id];
    if (!scope || Object.keys(scope).length === 0) return undefined;
    return Object.fromEntries(
      Object.entries(scope).map(([target, source]) => [target, `var(${source})`]),
    ) as CSSProperties;
  }, [swaps, id]);
}
