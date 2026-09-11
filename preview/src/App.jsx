import { useEffect, useMemo, useState } from "react";
import { useSystemTokens } from "./useSystemTokens.js";
import { fontFamiliesIn } from "./fonts.js";
import { COMPONENT_SECTIONS } from "./components.jsx";
import { EXTRA_SECTIONS } from "./extras.jsx";
import { SCREEN_SECTIONS } from "./screens.jsx";
import Compare from "./compare.jsx";
import { TokenOverridesContext, useTokenOverridesProvider } from "./tokenOverrides.js";

const GROUPS = [
  ["Components", COMPONENT_SECTIONS],
  ["Extras", EXTRA_SECTIONS],
  ["Screens", SCREEN_SECTIONS],
];

export default function App() {
  const isCompare = new URLSearchParams(location.search).get("mode") === "compare";
  return isCompare ? <Compare /> : <Gallery />;
}

// Whether a font is actually usable right now — not whether the system ships
// an @font-face for it. That check was always true for every seed system (none
// self-host a font) and never went false once useSystemTokens.js started
// fetching from Google Fonts, so it just alarmed on fonts that were working
// fine. document.fonts.check() reports what the browser can really render:
// true for an OS-installed font (Georgia, SFMono-Regular, …) and true for a
// webfont once its Google Fonts request lands — only a genuine miss is left.
function FontNote({ css }) {
  const families = fontFamiliesIn(css);
  const key = families.join(",");
  const [missing, setMissing] = useState([]);

  useEffect(() => {
    if (!families.length || !document.fonts) { setMissing([]); return; }
    let alive = true;
    const check = () => families.filter((f) => !document.fonts.check(`16px "${f}"`));

    // document.fonts.load() triggers the fetch for a matching @font-face (a
    // no-op if the family is already local, e.g. Georgia); .ready then waits
    // for whatever's in flight — but the Google Fonts <link> is a separate
    // network round trip, so its @font-face rules may not exist yet on this
    // first pass. A second pass after they've had time to register catches it.
    Promise.allSettled(families.map((f) => document.fonts.load(`16px "${f}"`)))
      .then(() => document.fonts.ready)
      .then(() => { if (alive) setMissing(check()); });

    const retry = setTimeout(() => {
      Promise.allSettled(families.map((f) => document.fonts.load(`16px "${f}"`))).then(() => {
        if (alive) setMissing(check());
      });
    }, 1000);

    return () => { alive = false; clearTimeout(retry); };
  }, [key]);

  if (!missing.length) return null;
  return (
    <div className="dsv-font-note">
      <b>Not available in this browser:</b> {missing.join(", ")}. Falls back to a default font.
    </div>
  );
}

// This page only ever reads the schema's canonical token names (var(--color-accent),
// var(--space-4), …) — that's the whole contract. Anything a system names
// differently (--primary-color instead of --color-accent) parses fine and even
// shows up correctly grouped in the Tokens tab gallery (name-pattern matching
// there is fuzzy), but is invisible here: nothing in this page's CSS ever
// references it, so it silently falls back instead of rendering.
function SchemaNote({ coverage }) {
  if (!coverage?.extraCount) return null;
  const shown = coverage.extra.slice(0, 12);
  const more = coverage.extra.length - shown.length;
  const list = shown.join(", ") + (more > 0 ? `, +${more} more` : "");
  return (
    <div className="dsv-font-note">
      <b>{coverage.extraCount} token{coverage.extraCount === 1 ? "" : "s"} not used here:</b> {list}.
      This page only renders the schema's own names — rename these to match (Tokens tab → Schema) to see them.
    </div>
  );
}

function Gallery() {
  const { system, error, loading, dark, setDark, hasDark } = useSystemTokens();
  const tokenOverrides = useTokenOverridesProvider();
  const overrideCount = Object.keys(tokenOverrides.valueEdits).length
    + Object.values(tokenOverrides.swaps).reduce((n, m) => n + Object.keys(m).length, 0);
  const [activeId, setActiveId] = useState(() => location.hash?.slice(1) || null);
  const [query, setQuery] = useState("");
  // section search — Turkish-aware lowercase so "Önizleme" finds "önizleme".
  // Filters both the rail links and the rendered sections so a query like
  // "tabs" shows only matching content, not an empty main next to a rail.
  const visibleGroups = useMemo(() => {
    const t = query.trim().toLocaleLowerCase("tr");
    if (!t) return GROUPS;
    return GROUPS.map(([label, sections]) => [
      label,
      sections.filter((s) => s.label.toLocaleLowerCase("tr").includes(t)),
    ]).filter(([, sections]) => sections.length);
  }, [query]);
  const visibleSections = useMemo(
    () => visibleGroups.flatMap(([, sections]) => sections),
    [visibleGroups],
  );

  // content mounts after the browser's initial hash jump — redo it once ready,
  // after layout settles (content-visibility was removed so one frame is enough,
  // second frame covers font-driven shifts).
  useEffect(() => {
    if (loading || !location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (!el) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start" });
    }));
  }, [loading]);

  // scrollspy — highlight the rail link for the section in view
  useEffect(() => {
    if (loading) return;
    const map = new Map();
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) map.set(e.target.id, e.intersectionRatio);
        else map.delete(e.target.id);
      }
      if (map.size) {
        let best = null, bestR = -1;
        for (const [id, r] of map) if (r > bestR) { bestR = r; best = id; }
        if (best) {
          setActiveId(best);
          try { history.replaceState(null, "", `#${best}`); } catch {}
        }
      }
    }, { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.1, 0.25] });
    visibleSections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [loading, visibleSections]);

  return (
    <TokenOverridesContext.Provider value={tokenOverrides}>
    <div className="dsv-app">
      <nav className="dsv-rail" aria-label="Preview sections">
        <div className="dsv-rail-head">
          <h1>{system ? system.name : "Preview"}</h1>
          {hasDark && (
            <label className="dsv-dark-toggle">
              <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />
              <span className="dsv-sw" aria-hidden="true"><span className="dsv-sw-th" /></span>
              <span className="dsv-dark-label">Dark variant</span>
            </label>
          )}
          {overrideCount > 0 && (
            <button type="button" className="dsv-override-pill" onClick={tokenOverrides.clearAll}>
              <span>{overrideCount} token edit{overrideCount === 1 ? "" : "s"}</span>
              <span className="dsv-override-pill-reset">Reset</span>
            </button>
          )}
          <span className="dsv-rail-filter">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter sections…" aria-label="Filter sections"
            />
            {query && <button onClick={() => setQuery("")} aria-label="Clear section filter">×</button>}
          </span>
        </div>
        {visibleGroups.length === 0 && (
          <p className="dsv-muted" style={{ padding: "0 var(--space-2)", fontSize: "var(--font-size-sm)" }}>
            No sections match “{query.trim()}”.
          </p>
        )}
        {visibleGroups.map(([label, sections]) => (
          <div key={label} className="dsv-rail-group">
            <div className="group-label"><span>{label}</span><span className="n">{sections.length}</span></div>
            {sections.map((s) => <a key={s.id} href={`#${s.id}`} className={activeId === s.id ? "active" : ""} aria-current={activeId === s.id ? "true" : undefined}>{s.label}</a>)}
          </div>
        ))}
      </nav>

      <main className="dsv-main">
        {loading && <p className="dsv-muted">Loading…</p>}
        {error === "no-systems" && (
          <div className="dsv-err">No systems yet. Use <b>Add System</b> to add a token block.</div>
        )}
        {error && error !== "no-systems" && (
          <div className="dsv-err">Failed to load system ({error}). Components shown with fallback tokens.</div>
        )}

        {!loading && system && <SchemaNote coverage={system.coverage} />}
        {!loading && system && <FontNote css={system.css} />}
        {visibleSections.length === 0 && !loading && !error && (
          <div className="dsv-err">No sections match “{query.trim()}”.</div>
        )}
        {!loading && visibleSections.map(({ id, Comp }) => <Comp key={id} />)}
      </main>
    </div>
    </TokenOverridesContext.Provider>
  );
}
