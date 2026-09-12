import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as Select from "@radix-ui/react-select";
import { loadGoogleFonts } from "./useSystemTokens.js";
import { fontFamiliesIn } from "./fonts.js";
import { injectSystemTokens } from "../systems/store.js";
import { COMPONENT_SECTIONS } from "./components.jsx";
import { EXTRA_SECTIONS } from "./extras.jsx";
import { SCREEN_SECTIONS } from "./screens.jsx";
import { TokenOverridesContext, useTokenOverridesProvider } from "./tokenOverrides.js";
import { Icon, SelectedScopePanel } from "./ui.jsx";
import { coverage } from "../../../src/core/schema.js";
import { parseTokens } from "../../../src/core/parse.js";

const GROUPS = [
  ["Components", COMPONENT_SECTIONS],
  ["Extras", EXTRA_SECTIONS],
  ["Screens", SCREEN_SECTIONS],
];

// Whether a font is actually usable right now — not whether the system ships
// an @font-face for it. document.fonts.check() reports what the browser can
// really render: true for an OS-installed font and true for a webfont once
// its Google Fonts request lands — only a genuine miss is left.
function FontNote({ css }) {
  const families = fontFamiliesIn(css);
  const key = families.join(",");
  const [missing, setMissing] = useState([]);

  useEffect(() => {
    if (!families.length || !document.fonts) { setMissing([]); return; }
    let alive = true;
    const check = () => families.filter((f) => !document.fonts.check(`16px "${f}"`));

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

// This page only ever reads the schema's canonical token names — that's the
// whole contract. Anything a system names differently is invisible here.
function SchemaNote({ coverage }) {
  if (!coverage?.extraCount) return null;
  const shown = coverage.extra.slice(0, 12);
  const more = coverage.extra.length - shown.length;
  const list = shown.join(", ") + (more > 0 ? `, +${more} more` : "");
  return (
    <div className="dsv-font-note">
      <b>{coverage.extraCount} token{coverage.extraCount === 1 ? "" : "s"} not used here:</b> {list}.
      This page only renders the schema's own names — rename these to match to see them.
    </div>
  );
}

const PreviewContext = createContext(null);

export function usePreview() {
  return useContext(PreviewContext);
}

/**
 * Owns single-system preview state: active system tokens on :root (shell +
 * canvas repaint together), rail/search/scrollspy, dark variant, and the
 * token-override layer. Layout-agnostic — App places the parts below into
 * Shell slots; the default Gallery export keeps the legacy full-page layout.
 */
export function PreviewProvider({ system, systems, onSelectSystem, children }) {
  const tokenOverrides = useTokenOverridesProvider();
  const overrideCount = Object.keys(tokenOverrides.valueEdits).length
    + Object.values(tokenOverrides.swaps).reduce((n, m) => n + Object.keys(m).length, 0);
  const [activeId, setActiveId] = useState(() => location.hash?.slice(1) || null);
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(false);
  const hasDark = !!(system?.themes?.dark?.length);

  // Single-system layer on :root — injected in layout phase so first paint
  // already carries the system's tokens (no fallback flash).
  useLayoutEffect(() => {
    injectSystemTokens(system, dark);
  }, [system, dark]);
  useEffect(() => {
    loadGoogleFonts(system?.css ?? "");
  }, [system]);

  // 1st tier: a single minimal sidebar — parent groups with collapsible
  // child section links. Open by default on desktop, persisted.
  const [railOpen, setRailOpen] = useState(() => {
    try {
      return localStorage.getItem("dsv.rail") !== "closed";
    } catch { return true; }
  });
  const toggleRail = () => setRailOpen((v) => {
    try { localStorage.setItem("dsv.rail", v ? "closed" : "open"); } catch {}
    return !v;
  });
  // Right properties panel — collapsible via its own edge handle.
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
  // Per-system coverage for the switcher menu — recomputed live so chips
  // never show a stale snapshot.
  const pctMap = useMemo(() => {
    const m = {};
    for (const s of systems) {
      try {
        const c = coverage(parseTokens(s.css).map((t) => t.name));
        m[s.slug] = Math.round((c.present / c.expected) * 100);
      } catch { m[s.slug] = null; }
    }
    return m;
  }, [systems]);
  // Screens alone is 27 links — collapsed by default so the rail reads as
  // three short, scannable groups. A group auto-opens the moment its own
  // section becomes active, so a deep link never lands on a hidden target.
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set(["Screens"]));
  const toggleGroup = (label) => setCollapsedGroups((s) => {
    const next = new Set(s);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });
  // section search — Turkish-aware lowercase. Filters both the rail links
  // and the rendered sections.
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

  // content mounts after the browser's initial hash jump — redo it once ready.
  useEffect(() => {
    if (!system || !location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (!el) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start" });
    }));
  }, [system]);

  // scrollspy — highlight the rail link for the section in view
  useEffect(() => {
    if (!system) return;
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
  }, [system, visibleSections]);

  // Never let a collapsed group hide the section scroll-spy just marked active.
  useEffect(() => {
    if (!activeId) return;
    const owner = GROUPS.find(([, sections]) => sections.some((s) => s.id === activeId))?.[0];
    if (owner) setCollapsedGroups((s) => (s.has(owner) ? new Set([...s].filter((g) => g !== owner)) : s));
  }, [activeId]);

  // Sliding active-link pill: measured in content-space so it scrolls
  // natively with the rail. A link hidden inside a collapsed group has no
  // layout box — hide the pill instead of parking it at a garbage offset.
  const railRef = useRef(null);
  const [indicator, setIndicator] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const rail = railRef.current;
      const link = rail?.querySelector(`a[href="#${CSS.escape(activeId || "")}"]`);
      if (!rail || !link || !link.getClientRects().length) { setIndicator(null); return; }
      const railRect = rail.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      if (linkRect.height < 4) { setIndicator(null); return; }
      setIndicator({ top: linkRect.top - railRect.top + rail.scrollTop, height: linkRect.height });
    };
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", measure); };
  }, [activeId, collapsedGroups, visibleGroups]);

  const covPct = system?.coverage
    ? Math.round((system.coverage.present / system.coverage.expected) * 100)
    : null;

  const value = {
    system, systems, onSelectSystem,
    tokenOverrides, overrideCount,
    dark, setDark, hasDark,
    query, setQuery,
    railOpen, toggleRail, propsOpen, toggleProps,
    copied, shareLink,
    pctMap, covPct,
    activeId, collapsedGroups, toggleGroup,
    visibleGroups, visibleSections,
    railRef, indicator,
  };

  return (
    <TokenOverridesContext.Provider value={tokenOverrides}>
      <PreviewContext.Provider value={value}>
        {children}
      </PreviewContext.Provider>
    </TokenOverridesContext.Provider>
  );
}

function useRequiredPreview() {
  const ctx = usePreview();
  if (!ctx) throw new Error("preview part rendered outside PreviewProvider");
  return ctx;
}

/** System switcher for the Shell topbar-left slot. */
export function PreviewSystemSwitcher() {
  const { system, systems, onSelectSystem, pctMap, covPct } = useRequiredPreview();
  if (systems.length < 2) return null;
  return (
    <>
      <Select.Root value={system?.slug ?? ""} onValueChange={onSelectSystem}>
        <Select.Trigger className="dsv-topbar-sysbtn" aria-label="Active design system">
          <span className="dsv-topbar-sysname"><Select.Value placeholder="Select system" /></span>
          <Select.Icon className="dsv-topbar-syschev"><Icon name="chevronDown" size={13} /></Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="dsv-select-content dsv-sysmenu" position="popper" sideOffset={6} align="start">
            <Select.Viewport>
              {systems.map((s) => (
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
      {covPct != null && <span className="dsv-topbar-cov" title="Schema token coverage">{covPct}%</span>}
    </>
  );
}

/** Topbar-right slot: edits pill, dark toggle, search, share. */
export function PreviewActions() {
  const { tokenOverrides, overrideCount, hasDark, dark, setDark, query, setQuery, copied, shareLink } = useRequiredPreview();
  return (
    <>
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
    </>
  );
}

/** Section-links rail for the Shell rail slot. */
export function PreviewRail() {
  const { railOpen, toggleRail, query, visibleGroups, activeId, collapsedGroups, toggleGroup, railRef, indicator } = useRequiredPreview();
  return (
    <>
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
            // A live filter always shows every match — collapsing would hide
            // the very thing the user just searched for.
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
    </>
  );
}

/** Gallery sections for the Shell main slot. */
export function PreviewMain() {
  const { system, query, visibleSections } = useRequiredPreview();
  if (!system) return <div className="dsv-err">No systems yet.</div>;
  return (
    <>
      <SchemaNote coverage={system.coverage} />
      <FontNote css={system.css} />
      {visibleSections.length === 0 && (
        <div className="dsv-err">No sections match “{query.trim()}”.</div>
      )}
      {visibleSections.map(({ id, Comp }) => <Comp key={id} />)}
    </>
  );
}

/** Docked properties panel for the Shell props slot. */
export function PreviewProps() {
  const { propsOpen, toggleProps } = useRequiredPreview();
  return (
    <>
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
    </>
  );
}

// Legacy full-page layout — same parts, old grid. Kept so the ported file
// stays standalone-renderable; App uses the parts in Shell slots instead.
export default function Gallery({ system, systems, onSelectSystem }) {
  return (
    <PreviewProvider system={system} systems={systems} onSelectSystem={onSelectSystem}>
      <PreviewShell />
    </PreviewProvider>
  );
}

function PreviewShell() {
  const { railOpen, propsOpen } = useRequiredPreview();
  return (
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
          <PreviewSystemSwitcher />
        </div>
        <div className="dsv-topbar-center" />
        <div className="dsv-topbar-right">
          <PreviewActions />
        </div>
      </header>
      <nav className="dsv-rail" aria-label="Preview sections">
        <PreviewRail />
      </nav>
      <main className="dsv-main">
        <PreviewMain />
      </main>
      <aside className="dsv-props" aria-label="Properties">
        <PreviewProps />
      </aside>
    </div>
  );
}
