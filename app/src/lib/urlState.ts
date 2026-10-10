// URL/deep-link state — ported FROM preview/ + src/viewer (never imported):
// legacy mirrored shareable UI state into the URL via history.replaceState
// (preview/src/compare.jsx's compare screen, preview/src/App.jsx's scrollspy,
// src/viewer/app.js's syncUrl) and read it back with URLSearchParams on load.
// app/ had none of this, so "Copy link to this view" only ever copied the
// bare root. This module is the single place that knows the param schema —
// Shell/App/systems/compare call in here instead of hand-rolling querystrings.
//
// Canonical schema (what we write):
//   tab=tokens|preview|compare  (omitted when tokens — the default, so a
//                                default view keeps the bare-root URL)
//   sys=<slug>                   active system (always, like legacy's syncUrl)
//   cmp=<a,b>                    compare picks — compare tab only, like legacy
//   cv=diff                      compare mode — only when diff (the default
//                                "component" is omitted, like legacy)
//   cc=<id>                      compare component — only when non-default
//   q=<text>                     Preview section search — only while the
//                                Preview tab is active (empty omits, so a
//                                default view keeps the bare-root URL)
//   f=<text>                     Tokens filter — only while the Tokens tab is
//                                active (empty omits, like q)
//   tv=schema                    Tokens schema mode — only while the Tokens tab
//                                is active (the default gallery mode omits,
//                                like cv's default)
// A legacy ?dark=1 is ignored on read and dropped on the next write: dark
// mode is retired, every panel shows the base (light) values.
// Section scroll position rides in location.hash (#<element-id>), like
// legacy's gallery scrollspy (`history.replaceState(null, "", `#${best}`)`).
// Rail's links are already plain <a href="#id"> anchors, so clicks deep-link
// with no interception, and copyLinkToView (location.href) captures
// querystring + hash together with no changes.
//
// Read aliases (never written): mode=compare (legacy shell/compare entry),
// tab=system (legacy name for this app's tokens tab) and v=/c= (legacy
// compare-iframe names) fall back for a missing tab=/cv=/cc=, so links
// shared from the old viewer still restore.

export const VIEW_TABS = ["tokens", "preview", "compare"] as const;
export type UrlTab = (typeof VIEW_TABS)[number];

const LEGACY_TABS: Record<string, UrlTab> = {
  system: "tokens",
};

function isUrlTab(value: string | null): value is UrlTab {
  return value !== null && (VIEW_TABS as readonly string[]).includes(value);
}

function readTab(raw: string | null): UrlTab | null {
  if (raw === null) return null;
  return isUrlTab(raw) ? raw : (LEGACY_TABS[raw] ?? null);
}

export interface ViewUrlState {
  tab: UrlTab | null;
  sys: string | null;
  cmp: string[];
  view: string | null;
  component: string | null;
  q: string | null;
  f: string | null;
  tv: string | null;
}

/** Parse shareable state out of a querystring (defaults to the live URL).
 *  Values are returned raw — each caller validates against its own data
 *  (known slugs/option ids), so unknown values fall back to that caller's
 *  defaults instead of breaking. The one exception is tv: its only
 *  non-default value is "schema", so anything else normalises to null here
 *  (the default gallery mode), mirroring how unknown tabs read as null. */
export function readViewUrl(search?: string): ViewUrlState {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(
      search ?? (typeof window === "undefined" ? "" : window.location.search),
    );
  } catch {
    params = new URLSearchParams();
  }
  const tab: UrlTab | null =
    readTab(params.get("tab")) ?? (params.get("mode") === "compare" ? "compare" : null);
  const sys = params.get("sys");
  const cmp = (params.get("cmp") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const q = params.get("q");
  const f = params.get("f");
  const tv = params.get("tv");
  return {
    tab,
    sys: sys ? sys : null,
    cmp,
    view: params.get("cv") ?? params.get("v"),
    component: params.get("cc") ?? params.get("c"),
    q: q ? q : null,
    f: f ? f : null,
    tv: tv === "schema" ? tv : null,
  };
}

export interface WriteViewUrlParams {
  tab?: UrlTab | null;
  sys?: string | null;
  cmp?: string[] | null;
  view?: string | null;
  component?: string | null;
  q?: string | null;
  f?: string | null;
  tv?: string | null;
}

/** Single replaceState writer for the querystring half of the URL — Rail owns
 *  the hash half (writeSectionHash) and each side preserves the other's part
 *  live, so the two never clobber. replaceState, not pushState: switching
 *  tabs/systems/sections must not spam back/forward (legacy parity).
 *  Unrelated params pass through untouched; legacy aliases (mode=, v=, c=)
 *  are canonicalized away on write. */
export function writeViewUrl(next: WriteViewUrlParams): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!next.tab || next.tab === "tokens") params.delete("tab");
  else params.set("tab", next.tab);
  if (next.sys) params.set("sys", next.sys);
  else params.delete("sys");
  params.delete("mode");
  if (next.cmp && next.cmp.length > 0) params.set("cmp", next.cmp.join(","));
  else params.delete("cmp");
  if (next.view && next.view !== "component") params.set("cv", next.view);
  else params.delete("cv");
  if (next.component) params.set("cc", next.component);
  else params.delete("cc");
  // Tab-scoped search state follows the same rule as the tab-scoped compare
  // params above: the Preview search rides only on the Preview tab, the
  // Tokens filter and schema mode only on the Tokens tab (null/undefined tab
  // is that tab — the default view), so switching tabs drops the other tab's
  // params instead of leaking them onto the copied link. Empty is the default
  // for q/f and gallery is the default for tv, so both omit.
  const onPreview = next.tab === "preview";
  const onTokens = !next.tab || next.tab === "tokens";
  if (onPreview && next.q) params.set("q", next.q);
  else params.delete("q");
  if (onTokens && next.f) params.set("f", next.f);
  else params.delete("f");
  if (onTokens && next.tv === "schema") params.set("tv", next.tv);
  else params.delete("tv");
  // Dark mode is retired: a stale ?dark=1 opens normally and is dropped here.
  params.delete("dark");
  params.delete("v");
  params.delete("c");
  const qs = params.toString();
  try {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`,
    );
  } catch {
    /* non-http contexts (file://) — the URL just won't sync */
  }
}

/** Mirror the active tab's current section into location.hash, preserving the
 *  querystring (legacy gallery scrollspy wrote `#${best}` the same way). */
export function writeSectionHash(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#${id}`,
    );
  } catch {
    /* ignore — same non-http caveat as above */
  }
}

/** Deep-link hash for the post-mount restore. Client-rendered content isn't
 *  in the DOM for the browser's native initial jump, so App scrolls to this
 *  itself. Decoded: location.hash is percent-encoded, getElementById wants
 *  the raw id. */
export function initialSectionHash(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash?.slice(1) ?? "";
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Scroll the main scroller to an element id (respects the scroll-margin-top
 *  the gallery/token CSS sets). False when the id isn't in the DOM — the
 *  caller then leaves the URL alone and scrollspy self-heals it. */
export function scrollToSection(id: string): boolean {
  if (typeof window === "undefined" || !id) return false;
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ block: "start" });
  return true;
}
