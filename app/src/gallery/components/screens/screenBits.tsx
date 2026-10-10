import type { ReactNode } from "react";
import * as Separator from "@radix-ui/react-separator";

// Shared bits for the full-page screen demos — ported from preview/src/screens.jsx.
// size: token scale name (xs/sm/md/lg/xl) — resolves to --size-avatar-*.
export function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
  return initials || "?";
}

export function avatarChartIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return (hash % 8) + 1;
}

export function Avat({ name, size = "md" }: { name: string; size?: string }) {
  const chartIndex = avatarChartIndex(name);
  return (
    <span
      className={`dsv-avatar dsv-avatar--${size}`}
      style={{ background: `var(--color-chart-${chartIndex})` }}
      title={name}
    >
      <span className="dsv-avatar-fallback" style={{ color: "var(--color-text-on-accent)" }}>
        {initialsForName(name)}
      </span>
    </span>
  );
}

export function ScreenSep({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
      <Separator.Root className="dsv-sep" style={{ flex: 1, margin: 0 }} />
      <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
        {children}
      </span>
      <Separator.Root className="dsv-sep" style={{ flex: 1, margin: 0 }} />
    </div>
  );
}

export function ScreenLink({ children, to = "#screen-login" }: { children: ReactNode; to?: string }) {
  return (
    <a href={to} className="dsv-link" style={{ display: "inline", padding: 0 }}>
      {children}
    </a>
  );
}
