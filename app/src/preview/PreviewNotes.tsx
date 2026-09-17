import { useEffect, useMemo, useState } from "react";
import { parseTokens } from "../../../src/core/parse.js";
import { coverage } from "../../../src/core/schema.js";
import { fontFamiliesIn } from "../lib/fonts.ts";
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

export function PreviewNotes({ system }: { system: DesignSystem | null }) {
  if (!system) return null;
  return (
    <>
      <SchemaNote css={system.css} />
      <FontNote css={system.css} />
    </>
  );
}
