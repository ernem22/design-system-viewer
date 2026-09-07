// Shared bits used across component demos and screens.
import { forwardRef } from "react";
import { tokensForDemo } from "./tokenUsage.js";

export function Icon({ name, size = 16, ...rest }) {
  const p = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
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

export function Demo({ title, children }) {
  const tokens = tokensForDemo(title);
  return (
    <div className="dsv-block">
      <h3>{title}</h3>
      <div className="dsv-row">{children}</div>
      {tokens.length > 0 && (
        <details className="dsv-demo-tokens">
          <summary>{tokens.length} token{tokens.length === 1 ? "" : "s"}</summary>
          <div className="dsv-demo-tokens-list">
            {tokens.map((t) => <code key={t} className="dsv-code-inline">{t}</code>)}
          </div>
        </details>
      )}
    </div>
  );
}
