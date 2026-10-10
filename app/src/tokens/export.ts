import { categorize } from "../../../src/core/taxonomy.js";
import { parseTokens } from "../../../src/core/parse.js";
import type { DesignSystem, TokenGroup } from "../systems/store.ts";

/** Categorized :root stylesheet (old systemToCss) — the CSS export format.
 *
 *  Dark mode is retired: a stored `themes.dark` block is never emitted. The
 *  export carries the base (light) values only. */
export function systemToCss(sys: DesignSystem): string {
  const groups: TokenGroup[] =
    sys.groups?.length
      ? sys.groups
      : (categorize(parseTokens(sys.css)) as TokenGroup[]);
  const blocks = groups
    .filter((g) => g.tokens.length)
    .map((g) => `  /* ${g.label} */\n` + g.tokens.map((t) => `  ${t.name}: ${t.value};`).join("\n"));
  const css = `/* ${sys.name} — ${sys.slug} */\n:root {\n${blocks.join("\n\n")}\n}\n`;
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
