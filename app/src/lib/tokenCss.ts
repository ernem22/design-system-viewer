import { parseTokens } from "../../../src/core/parse.js";

/**
 * Line-level token edits over the dialog's CSS text (#124).
 *
 * The grouped fill surface edits one declaration at a time, but the CSS text
 * stays the single source of truth — so every edit is a text edit here, not a
 * second token store. A name with an empty value is removed rather than
 * written, which is what keeps the form from emitting empty declarations:
 * `parseTokens` ignores them anyway, so writing them would only add noise to
 * the export.
 */

function declarationRe(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^([ \\t]*)${escaped}([ \\t]*):[^;\\n]*;?[ \\t]*$`, "m");
}

/** Name -> value for every declaration the parser can read. */
export function tokenValueMap(css: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const token of parseTokens(css) as { name: string; value: string }[]) {
    map.set(token.name, token.value);
  }
  return map;
}

/** Sets one declaration: replaces its line in place (keeping the file's own
    formatting and indentation) or appends it. An empty value removes the
    declaration. */
export function setTokenValue(css: string, name: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return removeTokenValue(css, name);
  const line = `${name}: ${trimmed};`;
  const re = declarationRe(name);
  if (re.test(css)) return css.replace(re, (_match, indent: string) => `${indent}${line}`);
  if (!css.trim()) return `${line}\n`;
  return `${css}${css.endsWith("\n") ? "" : "\n"}${line}\n`;
}

/** Removes one declaration's line (and its newline) when it is there. */
export function removeTokenValue(css: string, name: string): string {
  const re = declarationRe(name);
  if (!re.test(css)) return css;
  return css.replace(new RegExp(`${re.source}\\n?`, "m"), "");
}

/** Renames one declaration — what an extras suggestion applies. */
export function renameToken(css: string, from: string, to: string): string {
  const map = tokenValueMap(css);
  const value = map.get(from);
  if (value === undefined) return css;
  return setTokenValue(removeTokenValue(css, from), to, value);
}
