import { useEffect, useState } from "react";
import { useSystemTokens } from "./useSystemTokens.js";
import { fontFamiliesIn } from "./fonts.js";
import { COMPONENT_SECTIONS } from "./components.jsx";
import { EXTRA_SECTIONS } from "./extras.jsx";
import { SCREEN_SECTIONS } from "./screens.jsx";
import Compare from "./compare.jsx";

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
  const { system, error, loading } = useSystemTokens();

  // content mounts after the browser's initial hash jump — redo it once ready
  useEffect(() => {
    if (loading || !location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [loading]);

  return (
    <div className="dsv-app">
      <nav className="dsv-rail">
        <h1>{system ? system.name : "Preview"}</h1>
        {GROUPS.map(([label, sections]) => (
          <div key={label}>
            <div className="group-label">{label}</div>
            {sections.map((s) => <a key={s.id} href={`#${s.id}`}>{s.label}</a>)}
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
        {!loading && GROUPS.flatMap(([, sections]) => sections).map(({ id, Comp }) => <Comp key={id} />)}
      </main>
    </div>
  );
}
