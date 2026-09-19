import { useEffect, useMemo, useState } from "react";
import { parseTokens } from "../../../src/core/parse.js";
import { coverage } from "../../../src/core/schema.js";
import { fontFamiliesIn } from "../lib/fonts.ts";
import { Welcome } from "../shell/Welcome.tsx";
import type { DesignSystem, Token } from "../systems/store.ts";
import type { CoverageInfo } from "../tokens/useTokensView.ts";

/** Preview only reads the schema's canonical names — tokens named anything
   else render in the Tokens gallery but silently fall back here. */
function SchemaNote({ css }: { css: string }) {
  const cov = useMemo(
    () => coverage((parseTokens(css) as Token[]).map((t) => t.name)) as CoverageInfo,
    [css],
  );
  if (!cov.extraCount) return null;
  const shown = cov.extra.slice(0, 12);
  const more = cov.extra.length - shown.length;
  return (
    <div className="dsv-font-note">
      <b>
        {cov.extraCount} token{cov.extraCount === 1 ? "" : "s"} not used here:
      </b>{" "}
      {shown.join(", ")}
      {more > 0 ? `, +${more} more` : ""}. This page only renders the schema&apos;s own names — rename these
      to match (Tokens tab → Schema) to see them.
    </div>
  );
}

/** Families the browser genuinely can't render (after the Google Fonts
   request has had a chance to land) — not "families without @font-face". */
function FontNote({ css }: { css: string }) {
  const key = fontFamiliesIn(css).join(",");
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    const families = key ? key.split(",") : [];
    if (!families.length || !document.fonts) {
      setMissing([]);
      return;
    }
    let alive = true;
    const check = () => families.filter((f) => !document.fonts.check(`16px "${f}"`));
    const load = () => Promise.allSettled(families.map((f) => document.fonts.load(`16px "${f}"`)));
    load()
      .then(() => document.fonts.ready)
      .then(() => {
        if (alive) setMissing(check());
      });
    // The Google Fonts <link> is its own round trip — its @font-face rules
    // may not exist on the first pass.
    const retry = setTimeout(() => {
      load().then(() => {
        if (alive) setMissing(check());
      });
    }, 1000);
    return () => {
      alive = false;
      clearTimeout(retry);
    };
  }, [key]);

  if (!missing.length) return null;
  return (
    <div className="dsv-font-note">
      <b>Not available in this browser:</b> {missing.join(", ")}. Falls back to a default font.
    </div>
  );
}

function noop(): void {}

/** Zero-systems Preview state: reuses the app's existing empty-state chrome
   (shell/Welcome.tsx, the same paste/upload affordances the Tokens tab shows)
   rather than inventing a Preview-only look. */
function PreviewEmpty({ onPaste, onUpload }: { onPaste: () => void; onUpload: () => void }) {
  return <Welcome onPaste={onPaste} onUpload={onUpload} />;
}

/** Load-failure notice, distinct from the empty state. The message is the
   legacy viewer's report (preview/src/App.jsx:411) verbatim — the reason is
   the one the systems load already carries, not a string invented here. Like
   legacy it is a *notice*: the seed fallback keeps rendering the gallery with
   its tokens, and this says what happened on the way there. */
function PreviewError({ error }: { error: string }) {
  return (
    <div className="dsv-err" role="alert">
      Failed to load system ({error}). Components shown with fallback tokens.
    </div>
  );
}

/**
 * Preview's load states. While the index is in flight: a loading placeholder.
 * When the load failed: the failure notice, then the schema/font notes for
 * whatever fallback system is active (the gallery below keeps rendering with
 * the seed's tokens, matching legacy). With zero systems and no failure: the
 * app's empty state, which App shows without the gallery.
 */
export function PreviewNotes({
  system,
  loading = false,
  error = null,
  onPaste = noop,
  onUpload = noop,
}: {
  system: DesignSystem | null;
  loading?: boolean;
  error?: string | null;
  onPaste?: () => void;
  onUpload?: () => void;
}) {
  if (loading) return <p className="app-placeholder app-loading">Loading systems…</p>;
  return (
    <>
      {error && <PreviewError error={error} />}
      {system ? (
        <>
          <SchemaNote css={system.css} />
          <FontNote css={system.css} />
        </>
      ) : (
        !error && <PreviewEmpty onPaste={onPaste} onUpload={onUpload} />
      )}
    </>
  );
}
