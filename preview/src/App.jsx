import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as Select from "@radix-ui/react-select";
import { useSystemTokens, fetchSystems } from "./useSystemTokens.js";
import { fontFamiliesIn } from "./fonts.js";
import { COMPONENT_SECTIONS } from "./components.jsx";
import { EXTRA_SECTIONS } from "./extras.jsx";
import { SCREEN_SECTIONS } from "./screens.jsx";
import Compare from "./compare.jsx";
import { TokenOverridesContext, useTokenOverridesProvider } from "./tokenOverrides.js";
import { Icon, SelectedScopePanel } from "./ui.jsx";
import { coverage } from "../../src/core/schema.js";
import { parseTokens } from "../../src/core/parse.js";

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
  // 1st tier: a single minimal sidebar — parent groups with collapsible
  // child section links. It collapses to fully hidden (not to an icon
  // strip); group headers only ever expand/collapse, they never yank the
  // page scroll. Open by default on desktop, persisted.
  const [railOpen, setRailOpen] = useState(() => {
    try {
      return localStorage.getItem("dsv.rail") !== "closed";
    } catch { return true; }
  });
  const toggleRail = () => setRailOpen((v) => {
    try { localStorage.setItem("dsv.rail", v ? "closed" : "open"); } catch {}
    return !v;
  });
  // Right properties panel — collapsible via its own edge handle or the
  // topbar toggle. Stays mounted (overlay dialog covers ≤760px instead).
  const [propsOpen, setPropsOpen] = useState(() => {
    try { return localStorage.getItem("dsv.props") !== "closed"; } catch { return true; }
  });
  const toggleProps = () => setPropsOpen((v) => {
    try { localStorage.setItem("dsv.props", v ? "closed" : "open"); } catch {}
    return !v;
  });
  // A component badge click selects a scope — if the panel was closed the
  // click would look dead, so selecting always reveals the panel.
  const selectedId = tokenOverrides.selected?.id;
  useEffect(() => {
    if (!selectedId) return;
    try { localStorage.setItem("dsv.props", "open"); } catch {}
    setPropsOpen(true);
  }, [selectedId]);
  const [copied, setCopied] = useState(false);
  const shareLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  // Outer-shell remote controls: this iframe is a guest of the main app, so
  // system switches and tab jumps are requests the parent applies (it owns
  // the state and posts the confirmed slug back). Standalone (opened
  // directly, no parent) falls back to a plain reload / hides the tabs.
  const embedded = useMemo(() => {
    try { return window.parent !== window; } catch { return false; }
  }, []);
  const [allSystems, setAllSystems] = useState([]);
  useEffect(() => {
    let alive = true;
    fetchSystems().then((all) => { if (alive) setAllSystems(all); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const postParent = (msg) => {
    try { window.parent.postMessage(msg, location.origin === "null" ? "*" : location.origin); } catch {}
  };
  const requestSystem = (slug) => {
    if (embedded) postParent({ type: "dsv:request-system", slug });
    else {
      const p = new URLSearchParams(location.search);
      p.set("sys", slug);
      location.search = p.toString();
    }
  };
  const requestTab = (t) => { if (embedded) postParent({ type: "dsv:request-tab", tab: t }); };
  // Per-system coverage for the switcher menu — recomputed live like Compare
  // does, so chips never show a stale snapshot.
  const pctMap = useMemo(() => {
    const m = {};
    for (const s of allSystems) {
      try {
        const c = coverage(parseTokens(s.css).map((t) => t.name));
        m[s.slug] = Math.round((c.present / c.expected) * 100);
      } catch { m[s.slug] = null; }
    }
    return m;
  }, [allSystems]);
  // Screens alone is 27 links — collapsed by default so the rail reads as three
  // short, scannable groups instead of one long scroll. Components/Extras stay
  // open since they're short. A group auto-opens the moment its own section
  // becomes active (below), so a deep link never lands on a hidden target.
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set(["Screens"]));
  const toggleGroup = (label) => setCollapsedGroups((s) => {
    const next = new Set(s);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });
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

  // Never let a collapsed group hide the section scroll-spy just marked active.
  useEffect(() => {
    if (!activeId) return;
    const owner = GROUPS.find(([, sections]) => sections.some((s) => s.id === activeId))?.[0];
    if (owner) setCollapsedGroups((s) => (s.has(owner) ? new Set([...s].filter((g) => g !== owner)) : s));
  }, [activeId]);

  // Sliding active-link pill: measured in content-space (viewport delta +
  // scrollTop) so it scrolls natively with the rail instead of needing a
  // scroll listener, and re-measures whenever the link layout can shift.
  // A link hidden inside a collapsed group has no layout box — parking the
  // pill on it would strand it at a garbage offset, so hide it instead
  // (aria-current on the link itself still carries the selection).
  const railRef = useRef(null);
  const [indicator, setIndicator] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const rail = railRef.current;
      if (!rail || !activeId) { setIndicator(null); return; }
      const link = rail.querySelector(`a[href="#${CSS.escape(activeId)}"]`);
      if (!link || !link.getClientRects().length) { setIndicator(null); return; }
      const railRect = rail.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      if (linkRect.height < 4) { setIndicator(null); return; }
      setIndicator({ top: linkRect.top - railRect.top + rail.scrollTop, height: linkRect.height });
    };
    measure();
    const raf = requestAnimationFrame(measure); // after this paint settles (collapse/filter reflow)
    // Group expand/collapse animates grid-template-rows over ~200ms: the rAF
    // above samples a mid-animation box, so sample once more after the
    // transition lands instead of stranding the pill at a squashed offset.
    const settled = setTimeout(measure, 250);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(raf); clearTimeout(settled); window.removeEventListener("resize", measure); };
  }, [activeId, collapsedGroups, visibleGroups]);

  const covPct = system?.coverage
    ? Math.round((system.coverage.present / system.coverage.expected) * 100)
    : null;

  return (
    <TokenOverridesContext.Provider value={tokenOverrides}>
    <div className="dsv-app" data-rail={railOpen ? "open" : "closed"} data-props={propsOpen ? "open" : "closed"}>
      <header className="dsv-topbar">
        <div className="dsv-topbar-left">
          <span className="dsv-brand" title="Design System Viewer">
            <svg className="dsv-brand-mark" width="18" height="18" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" rx="2.5" fill="var(--color-accent)" />
              <rect x="12" y="1" width="9" height="9" rx="2.5" fill="var(--color-accent)" opacity=".5" />
              <rect x="1" y="12" width="9" height="9" rx="2.5" fill="var(--color-accent)" opacity=".5" />
              <rect x="12" y="12" width="9" height="9" rx="2.5" fill="var(--color-accent)" opacity=".2" />
            </svg>
            <span className="dsv-brand-name">Design System Viewer</span>
          </span>
          {allSystems.length > 1 && (
            <Select.Root value={system?.slug ?? ""} onValueChange={requestSystem}>
              <Select.Trigger className="dsv-topbar-sysbtn" aria-label="Active design system">
                <span className="dsv-topbar-sysname"><Select.Value placeholder="Select system" /></span>
                <Select.Icon className="dsv-topbar-syschev"><Icon name="chevronDown" size={13} /></Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="dsv-select-content dsv-sysmenu" position="popper" sideOffset={6} align="start">
                  <Select.Viewport>
                    {allSystems.map((s) => (
                      <Select.Item key={s.slug} value={s.slug} className="dsv-select-item">
                        <Select.ItemIndicator className="dsv-select-item-indicator"><Icon name="check" size={14} /></Select.ItemIndicator>
                        <Select.ItemText>{s.name}</Select.ItemText>
                        {pctMap[s.slug] != null && <span className="dsv-sysmenu-pct">{pctMap[s.slug]}%</span>}
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          )}
          {covPct != null && <span className="dsv-topbar-cov" title="Schema token coverage">{covPct}%</span>}
        </div>
        <div className="dsv-topbar-center">
          {embedded && (
            <div className="dsv-topbar-tabs" role="tablist" aria-label="Views">
              {[["system", "Tokens"], ["preview", "Preview"], ["compare", "Compare"]].map(([v, l]) => (
                <button
                  key={v} type="button" role="tab" aria-selected={v === "preview"}
                  className={v === "preview" ? "on" : ""} onClick={() => requestTab(v)}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="dsv-topbar-right">
          {overrideCount > 0 && (
            <button type="button" className="dsv-topbar-pill" onClick={tokenOverrides.clearAll} title="Reset all token edits">
              <span>{overrideCount} edit{overrideCount === 1 ? "" : "s"}</span>
              <span className="dsv-override-pill-reset">Reset</span>
            </button>
          )}
          {hasDark && (
            <label className="dsv-topbar-dark" title="Toggle dark variant">
              <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} aria-label="Dark variant" />
              <span className="dsv-sw" aria-hidden="true"><span className="dsv-sw-th" /></span>
              <span className="dsv-topbar-dark-label">Dark</span>
            </label>
          )}
          <span className="dsv-topbar-search">
            <Icon name="search" size={14} />
            <input
              type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…" aria-label="Filter sections"
            />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear section filter">×</button>}
          </span>
          <button
            type="button" className="dsv-topbar-iconbtn" onClick={shareLink}
            title="Copy link to this view" aria-label="Copy link to this view"
          >
            <Icon name={copied ? "check" : "link"} size={15} />
          </button>
          {embedded && (
            <button
              type="button" className="dsv-topbar-add" onClick={() => postParent({ type: "dsv:request-add" })}
              title="Add design system" aria-label="Add design system"
            >
              <Icon name="plus" size={14} />
              <span className="dsv-topbar-add-label">Add</span>
            </button>
          )}
        </div>
      </header>
      <nav className="dsv-rail" aria-label="Preview sections">
        <button
          type="button" className="dsv-rail-handle" onClick={toggleRail}
          aria-expanded={railOpen}
          aria-label={railOpen ? "Hide sidebar" : "Show sidebar"}
          title={railOpen ? "Hide sidebar" : "Show sidebar"}
        >
          <Icon name={railOpen ? "chevronsLeft" : "chevronsRight"} size={14} />
        </button>
        <div className="dsv-rail-clip">
        <div className="dsv-rail-inner" ref={railRef}>
        {visibleGroups.length === 0 && (
          <p className="dsv-muted" style={{ padding: "0 var(--space-2)", fontSize: "var(--font-size-sm)" }}>
            No sections match “{query.trim()}”.
          </p>
        )}
        {indicator && <div className="dsv-rail-indicator" style={{ top: indicator.top, height: indicator.height }} aria-hidden="true" />}
        {visibleGroups.map(([label, sections]) => {
          // A live filter always shows every match — collapsing would hide the
          // very thing the user just searched for.
          const isCollapsed = !query && collapsedGroups.has(label);
          return (
            <div key={label} className="dsv-rail-group">
              <button
                type="button" className="group-label" onClick={() => toggleGroup(label)}
                aria-expanded={!isCollapsed}
              >
                <Icon name="chevronDown" size={11} className="group-chevron" />
                <span>{label}</span>
                <span className="n">{sections.length}</span>
              </button>
              <div className={`dsv-rail-group-items${isCollapsed ? " is-collapsed" : ""}`}>
                <div>
                  {sections.map((s) => <a key={s.id} href={`#${s.id}`} className={activeId === s.id ? "active" : ""} aria-current={activeId === s.id ? "true" : undefined}>{s.label}</a>)}
                </div>
              </div>
            </div>
          );
        })}
        </div>
        </div>
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

      <aside className="dsv-props" aria-label="Properties">
        <button
          type="button" className="dsv-props-handle" onClick={toggleProps}
          aria-expanded={propsOpen}
          aria-label={propsOpen ? "Close properties panel" : "Open properties panel"}
          title={propsOpen ? "Close properties panel" : "Open properties panel"}
        >
          <Icon name={propsOpen ? "chevronsRight" : "chevronsLeft"} size={14} />
        </button>
        <div className="dsv-props-clip">
        <div className="dsv-props-inner">
          <SelectedScopePanel />
        </div>
        </div>
      </aside>
    </div>
    </TokenOverridesContext.Provider>
  );
}
