// Shared, read-only gallery chrome — ported from preview/src/ui.jsx, stripped
// of the live token-editing machinery (SwapPicker/ValueEditor/TokenDrawer/
// TokenScopeTrigger): this pass renders demos styled by whatever the active
// system's tokens currently resolve to, nothing more.
import { createContext, forwardRef, useContext } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { GalleryEntry } from "./registry.ts";
import { slugify } from "../lib/slug.ts";

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
  const id = `${sectionId}-${slugify(title)}`;
  return (
    <div className="dsv-block" id={id} data-demo-title={title}>
      <div className="dsv-block-head">
        <h3>{title}</h3>
      </div>
      <div className="dsv-row">{children}</div>
    </div>
  );
}

export function GallerySection({ id, label, desc, Body }: GalleryEntry) {
  return (
    <section className="dsv-section" id={id}>
      <h2>{label}</h2>
      <p>{desc}</p>
      <SectionIdContext.Provider value={id}>
        <Body />
      </SectionIdContext.Provider>
    </section>
  );
}
