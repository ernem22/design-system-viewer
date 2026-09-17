import type { ReactNode } from "react";
import * as Avatar from "@radix-ui/react-avatar";
import * as Separator from "@radix-ui/react-separator";

// Shared bits for the full-page screen demos — ported from preview/src/screens.jsx.
// size: token scale name (xs/sm/md/lg/xl) — resolves to --size-avatar-*.
export function Avat({ n, size = "md" }: { n: number | string; size?: string }) {
  return (
    <span className={`dsv-avatar dsv-avatar--${size}`}>
      <Avatar.Root style={{ width: "100%", height: "100%", display: "flex" }}>
        <Avatar.Image src={`https://i.pravatar.cc/80?img=${n}`} alt="" />
        <Avatar.Fallback className="dsv-avatar-fallback">{String(n).slice(0, 2)}</Avatar.Fallback>
      </Avatar.Root>
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
