import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import * as Separator from "@radix-ui/react-separator";
import { contrastRatio } from "../../../../../src/core/contrast.js";

const INK_WHITE = "var(--color-white)";
const INK_BLACK = "var(--color-neutral-1000)";

// Avatar fills come from the inspected system's chart tokens, so white is not
// safe for every palette (chart-2..4 and chart-8 fail AA against white). The
// ink is measured from the fill the browser actually resolves and cached by
// that resolved string, keeping hundreds of avatars down to one probe per
// distinct colour.
const inkCache = new Map<string, string>();
// fill var -> resolved colour, scoped to one revision of the <html> token layer
const resolvedFillCache = new Map<string, string>();

// The tokens App.tsx applies live on <html>; re-measure when that style layer
// changes so a system switch cannot leave avatars painted with a stale ink.
let revision = 0;
const revisionListeners = new Set<() => void>();
let observer: MutationObserver | null = null;

function getRevision(): number {
  return revision;
}

function subscribeRevision(listener: () => void): () => void {
  revisionListeners.add(listener);
  if (
    !observer &&
    typeof MutationObserver !== "undefined" &&
    typeof document !== "undefined"
  ) {
    observer = new MutationObserver(() => {
      revision += 1;
      // Both caches are only valid for the token layer that produced them.
      resolvedFillCache.clear();
      inkCache.clear();
      for (const notify of revisionListeners) notify();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });
  }
  return () => {
    revisionListeners.delete(listener);
    if (revisionListeners.size === 0 && observer) {
      observer.disconnect();
      observer = null;
    }
  };
}

function measureInk(fillVar: string, rev: number): string {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") {
    return INK_WHITE;
  }
  const fillKey = `${rev}:${fillVar}`;
  let fill = resolvedFillCache.get(fillKey);
  if (fill === undefined) {
    const probe = document.createElement("span");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden";
    document.body.appendChild(probe);
    try {
      probe.style.backgroundColor = fillVar;
      fill = getComputedStyle(probe).backgroundColor;
      // Unresolvable/transparent in happy-dom or before layout: white is the
      // historical default, and caching it would lock in a bad reading.
      if (!fill || fill === "transparent" || fill === "rgba(0, 0, 0, 0)") return INK_WHITE;
      resolvedFillCache.set(fillKey, fill);

      const cached = inkCache.get(fill);
      if (cached) return cached;

      probe.style.color = INK_WHITE;
      const white = getComputedStyle(probe).color;
      probe.style.color = INK_BLACK;
      const black = getComputedStyle(probe).color;
      const onWhite = contrastRatio(white, fill) as number | null;
      const onBlack = contrastRatio(black, fill) as number | null;
      const ink =
        onBlack != null && (onWhite == null || onBlack > onWhite) ? INK_BLACK : INK_WHITE;
      inkCache.set(fill, ink);
      return ink;
    } catch {
      return INK_WHITE;
    } finally {
      probe.remove();
    }
  }
  return inkCache.get(fill) ?? INK_WHITE;
}

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

export function Avat({
  name,
  size = "md",
  decorative = false,
}: {
  name: string;
  size?: string;
  /** Use when the avatar sits next to the same visible name: the name is the
      accessible text, so the initials should not be announced twice. */
  decorative?: boolean;
}) {
  const chartIndex = avatarChartIndex(name);
  const fill = `var(--color-chart-${chartIndex})`;
  const rev = useSyncExternalStore(subscribeRevision, getRevision, getRevision);
  const ink = useMemo(() => measureInk(fill, rev), [fill, rev]);
  return (
    <span
      className={`dsv-avatar dsv-avatar--${size}`}
      style={{ background: fill }}
      role={decorative ? undefined : "img"}
      title={decorative ? undefined : name}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
    >
      <span className="dsv-avatar-fallback" style={{ color: ink }}>
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
