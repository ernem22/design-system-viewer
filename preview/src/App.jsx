import { useEffect } from "react";
import { useSystemTokens } from "./useSystemTokens.js";
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

// Fonts a system names but does not ship a matching @font-face for: the preview
// only renders them if the viewer already has them installed, else it falls back.
function FontNote({ css }) {
  if (!css) return null;
  const generic = /^(sans-serif|serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|-apple-system|blinkmacsystemfont|inherit|initial|cursive|fantasy|math|emoji)$/i;
  const families = [...css.matchAll(/--font-[\w-]*(?:sans|serif|mono|family|body|heading|display|ui)[\w-]*\s*:\s*([^;{}]+)/gi)]
    .map((m) => m[1].split(",")[0].trim().replace(/^["']|["']$/g, ""))
    .filter((f, i, a) => f && !generic.test(f) && a.indexOf(f.toLowerCase()) === a.findIndex((x) => x.toLowerCase() === f.toLowerCase()));
  if (!families.length) return null;

  const bundled = new Set(
    [...css.matchAll(/@font-face[^}]*font-family\s*:\s*([^;}]+)/gi)]
      .map((m) => m[1].trim().replace(/^["']|["']$/g, "").toLowerCase()),
  );
  const unbundled = families.filter((f) => !bundled.has(f.toLowerCase()));
  if (!unbundled.length) return null;

  return (
    <div className="dsv-err" style={{ borderColor: "var(--color-warning, #b7791f)" }}>
      <b>Fonts not bundled:</b> {unbundled.join(", ")} — no <code>@font-face</code> definition in system.
      Falls back to system font if not installed in this browser.
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

        {!loading && system && <FontNote css={system.css} />}
        {!loading && GROUPS.flatMap(([, sections]) => sections).map(({ id, Comp }) => <Comp key={id} />)}
      </main>
    </div>
  );
}
