import { categorize } from "../../../src/core/taxonomy.js";
import { parseTokens } from "../../../src/core/parse.js";
import type { DesignSystem, TokenGroup } from "../systems/store.ts";

/** Categorized :root stylesheet (old systemToCss) — the CSS export format.
 *
 *  A system's dark variant rides in a `[data-theme="dark"]` block. The viewer
 *  applies dark by overwriting the custom properties on the root element when
 *  the Dark switch is on — an explicit opt-in, not the OS preference — so an
 *  attribute-gated block matches that model (a `@media (prefers-color-scheme:
 *  dark)` block would follow the OS instead). `[data-theme="dark"]` is also
 *  one of the selector shapes `parse.js`'s DARK_SEL reads back, so re-importing
 *  the exported file restores `themes.dark` instead of losing it. */
export function systemToCss(sys: DesignSystem): string {
  const groups: TokenGroup[] =
    sys.groups?.length
      ? sys.groups
      : (categorize(parseTokens(sys.css)) as TokenGroup[]);
  const blocks = groups
    .filter((g) => g.tokens.length)
    .map((g) => `  /* ${g.label} */\n` + g.tokens.map((t) => `  ${t.name}: ${t.value};`).join("\n"));
  let css = `/* ${sys.name} — ${sys.slug} */\n:root {\n${blocks.join("\n\n")}\n}\n`;
  const dark = sys.themes?.dark ?? [];
  if (dark.length) {
    const darkBlock = dark.map((t) => `  ${t.name}: ${t.value};`).join("\n");
    css += `\n[data-theme="dark"] {\n${darkBlock}\n}\n`;
  }
  return css;
}

export function download(filename: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
