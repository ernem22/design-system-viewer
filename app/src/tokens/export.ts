import { categorize } from "../../../src/core/taxonomy.js";
import { parseTokens } from "../../../src/core/parse.js";
import type { DesignSystem, TokenGroup } from "../systems/store.ts";

/** Categorized :root stylesheet (old systemToCss) — the CSS export format. */
export function systemToCss(sys: DesignSystem): string {
  const groups: TokenGroup[] =
    sys.groups?.length
      ? sys.groups
      : (categorize(parseTokens(sys.css)) as TokenGroup[]);
  const blocks = groups
    .filter((g) => g.tokens.length)
    .map((g) => `  /* ${g.label} */\n` + g.tokens.map((t) => `  ${t.name}: ${t.value};`).join("\n"));
  return `/* ${sys.name} — ${sys.slug} */\n:root {\n${blocks.join("\n\n")}\n}\n`;
}

export function download(filename: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
