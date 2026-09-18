// Shared gallery chrome — ported from preview/src/ui.jsx. Each <Demo> header
// carries a token-count badge (see tokenInspector.tsx) that docks the demo's
// statically-detected token usage into the Preview tab's props panel; the
// badge's swap state is applied as an inline custom-property style on the
// demo's own node, so scoped swaps never leak into other demos. Gallery
// sections carry the same badge in their own header (keyed by entry id,
// tokens from the Body source scan) — screen entries render a whole Body
// with no <Demo> blocks, so the section badge is their only inspector
// entry point.
import { createContext, forwardRef, useContext } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { GalleryEntry } from "./registry.ts";
import { slugify } from "../lib/slug.ts";
import { tokensForEntry } from "../lib/tokenUsage.ts";
import { SectionScopeTrigger, TokenScopeTrigger, useScopeStyle, useSectionScopeStyle } from "./tokenInspector.tsx";

/** DOM node Radix `*.Portal` content should mount into instead of
   `document.body` — restored from preview/src/ui.jsx's PortalContainerContext
   for the Compare tab, which needs every column's portalled content (Select,
   Dialog, Popover…) to land inside that column's own token scope. Elsewhere
   (Preview, Tokens) no provider is set, so this resolves to `undefined` and
   Radix falls back to its own document.body default — unchanged behavior.
   This is DOM plumbing for where a portal renders, not app state, so it sits
   outside the "no Context for state" rule in app/CLAUDE.md. */
export const PortalContainerContext = createContext<HTMLElement | undefined>(undefined);
export function usePortalContainer() {
  return useContext(PortalContainerContext);
}

/** True inside a Compare column. The token inspector (badges, scoped swaps)
   is Preview-only — an edit there would be ambiguous about which column it
   targets — and Compare renders the same Bodies once per column, so Demo
   ids would collide too. Legacy got this for free from its missing context
   provider; this is the explicit equivalent. Rendering mode, not state. */
export const InCompareContext = createContext(false);

/** Per-column id prefix for Compare. Preview mounts one of each renderer, so
   fixed ids like the Basics `c-e`/`lc-e` are unique there; Compare mounts the
   same renderer once per system, so those ids would repeat and every
   `<label htmlFor>` would resolve to the first column's input. CompareColumn
   provides `${slug}-` here and renderers prefix their ids with it, keeping
   each column's label/input pair self-consistent. Empty outside Compare. */
export const CompareIdPrefixContext = createContext("");

export function useCompareIdPrefix() {
  return useContext(CompareIdPrefixContext);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "soft" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "xl";
}

/** Stays forwardRef — Radix's `asChild` (Dialog.Trigger, Popover.Trigger,
   Collapsible.Trigger, Toolbar.Button, Form.Submit, …) passes this a ref. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "solid", size = "md", className = "", ...rest },
  ref,
) {
  const cls = ["dsv-btn", `dsv-btn--${variant}`, size !== "md" && `dsv-btn--${size}`, className]
    .filter(Boolean)
    .join(" ");
  return <button ref={ref} className={cls} {...rest} />;
});

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  id?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, id, children }: FieldProps) {
  return (
    <div className="dsv-field">
      {label && (
        <label className="dsv-label" htmlFor={id}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <span className="dsv-hint dsv-hint--err">{error}</span>
      ) : hint ? (
        <span className="dsv-hint">{hint}</span>
      ) : null}
    </div>
  );
}

/** Nearest enclosing GallerySection's id — lets <Demo> scope its own id
   without every caller having to pass one by hand. */
const SectionIdContext = createContext("");

export function Demo({ title, children }: { title: string; children: ReactNode }) {
  const sectionId = useContext(SectionIdContext);
  const inCompare = useContext(InCompareContext);
  const id = `${sectionId}-${slugify(title)}`;
  // Per-demo token swaps resolve through this node's own custom properties
  // (see tokenInspector.tsx) — descendants inherit them, siblings don't.
  const swapStyle = useScopeStyle(title);
  return (
    <div
      className="dsv-block"
      id={inCompare ? undefined : id}
      data-demo-title={inCompare ? undefined : title}
      style={inCompare ? undefined : swapStyle}
    >
      <div className="dsv-block-head">
        <h3>{title}</h3>
        {!inCompare && <TokenScopeTrigger title={title} />}
      </div>
      <div className="dsv-row">{children}</div>
    </div>
  );
}

export function GallerySection({ id, label, desc, Body, hidden = false }: GalleryEntry & { hidden?: boolean }) {
  // Keyed by entry id, not Body.name (minified in production builds). The
  // scope id is the same stable id, matching the legacy tokensForScreen
  // keying; swaps land on this node so they inherit across the whole Body
  // without leaking into sibling sections.
  const tokens = tokensForEntry(id);
  const swapStyle = useSectionScopeStyle(id);
  return (
    // Search hides (not unmounts) non-matching sections: the rail outline is
    // read from this DOM once, and demo state survives a query change.
    <section className="dsv-section" id={id} style={swapStyle} hidden={hidden}>
      <div className="dsv-section-head">
        <h2>{label}</h2>
        <SectionScopeTrigger id={id} title={label} tokens={tokens} />
      </div>
      <p>{desc}</p>
      <SectionIdContext.Provider value={id}>
        <Body />
      </SectionIdContext.Provider>
    </section>
  );
}
