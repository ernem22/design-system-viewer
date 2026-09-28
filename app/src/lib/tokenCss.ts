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

/**
 * A declaration anywhere in the file, not anchored to a whole line: a minified
 * stylesheet puts several declarations on one line (`:root{--a:1px;--b:2px}`),
 * so scanning line-by-line misses every one but a lone declaration and then
 * appends a duplicate of the declaration it could not match.
 *
 * Groups: 1 = the character before the name (start of file or a separator),
 * 2 = whitespace between the name and `:`, 3 = whitespace after the `:` (the
 * value's own leading whitespace, newlines included), 4 = the value, 5 =
 * whitespace before the terminator, 6 = `;` or the `}` that closes it.
 */
function declarationRe(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(^|[^A-Za-z0-9_-])${escaped}([ \\t]*):(\\s*)([^;}]*?)(\\s*)(;|(?=\\}))`,
  );
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
  const re = declarationRe(name);
  if (re.test(css)) {
    // Swap only the value: the name, the colons and every run of whitespace
    // (minified or hand-formatted) stay exactly as the file wrote them.
    return css.replace(
      re,
      (_match, pre: string, postName: string, postColon: string, _old: string, preTerm: string, term: string) =>
        `${pre}${name}${postName}:${postColon}${trimmed}${preTerm}${term}`,
    );
  }
  const line = `${name}: ${trimmed};`;
  if (!css.trim()) return `${line}\n`;
  return `${css}${css.endsWith("\n") ? "" : "\n"}${line}\n`;
}

/** Removes one declaration when it is there. A declaration alone on its line
    takes its line break with it; on a minified block (several declarations on
    one line) only the declaration itself is removed, so its neighbours and the
    file's formatting stay put. */
export function removeTokenValue(css: string, name: string): string {
  const match = declarationRe(name).exec(css);
  if (!match) return css;
  const start = match.index + match[1].length;
  const end = match.index + match[0].length;
  const lineStart = css.lastIndexOf("\n", start - 1) + 1;
  const after = css.slice(end);
  const tail = after.match(/^[ \t]*\n?/)?.[0] ?? "";
  const ownLine = css.slice(lineStart, start).trim() === "";
  if (ownLine && (tail.includes("\n") || after.trim() === "")) {
    return css.slice(0, lineStart) + css.slice(end + tail.length);
  }
  return css.slice(0, start) + css.slice(end);
}

/** Renames one declaration — what an extras suggestion applies. */
export function renameToken(css: string, from: string, to: string): string {
  const map = tokenValueMap(css);
  const value = map.get(from);
  if (value === undefined) return css;
  return setTokenValue(removeTokenValue(css, from), to, value);
}
