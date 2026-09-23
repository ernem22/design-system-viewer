import { REFERENCE } from "../../../src/core/schema.js";
import { parseTokens } from "../../../src/core/parse.js";

/**
 * Import readers for the Add System flow (#116 / #124).
 *
 * The dialog's sources are all the same pipeline with a different reader: CSS
 * text, a `.css` file, a URL, our own JSON export, the clipboard. This module
 * owns the parts that are pure: detecting which of those a block of text is,
 * reading a JSON export back into `{name, css}`, and the two normalisations an
 * import needs before it can be scored against the schema — prefix stripping
 * and near-miss suggestions for names the schema does not have.
 *
 * Nothing here writes: the dialog keeps the CSS text as the single source of
 * truth and `buildSystem`/`mergeSystem` stay the only write pipeline.
 */

type ReferenceGroup = { id: string; label: string; tokens: string[] };

/** Every canonical schema name — the set Preview can actually read. */
const SCHEMA_NAMES: string[] = (REFERENCE as ReferenceGroup[]).flatMap((g) => g.tokens);
const SCHEMA_NAME_SET = new Set(SCHEMA_NAMES);
/** First hyphen segment of every schema name (`--color-bg` -> `color`). Used to
    tell a real vendor prefix (`--ds-color-bg`) from a schema segment. */
const SCHEMA_SEGMENTS = new Set(SCHEMA_NAMES.map((n) => segments(n)[0]));

export type ImportFormat = "css" | "system-json" | "unknown";

export interface ImportedSystem {
  name: string;
  css: string;
  slug?: string;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function segments(name: string): string[] {
  return name.replace(/^--/, "").toLowerCase().split("-").filter(Boolean);
}

/** Parsed JSON, or null when the text is not JSON at all (a CSS block is not). */
function tryJson(text: string): unknown {
  const t = text.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return null;
  }
}

function hasCssField(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { css?: unknown }).css === "string" &&
    ((value as { css: string }).css as string).trim().length > 0
  );
}

/** Which source a pasted/dropped block is: a JSON system export, a CSS block
    with at least one `--token: value;` line, or neither. */
export function detectImportFormat(text: string): ImportFormat {
  const parsed = tryJson(text);
  if (parsed !== null) return hasCssField(parsed) ? "system-json" : "unknown";
  return /--[\w-]+\s*:/.test(text) ? "css" : "unknown";
}

/** A JSON export read back into the two fields the dialog needs. Throws with a
    message meant for the user, because every failure here is recoverable by
    picking a different file. */
export function readSystemJson(text: string): ImportedSystem {
  const parsed = tryJson(text);
  if (parsed === null) throw new Error("Not valid JSON");
  if (Array.isArray(parsed)) throw new Error("That JSON holds an array — import one system at a time");
  if (!hasCssField(parsed))
    throw new Error("That JSON has no `css` field — export a system from the Tokens tab");
  const obj = parsed as Record<string, unknown>;
  const slug = typeof obj.slug === "string" ? obj.slug : undefined;
  const rawName = typeof obj.name === "string" ? obj.name.trim() : "";
  return { name: rawName || slug || "Untitled", css: obj.css as string, slug };
}

/** Vendor prefixes in the block that the schema does not know: the first
    hyphen segment of a token name, when it is not a schema segment and it
    appears on at least `minCount` tokens. `--ds-color-bg` yields `ds`. */
export function detectPrefixes(css: string, minCount = 2): string[] {
  const counts = new Map<string, number>();
  for (const token of parseTokens(css) as { name: string }[]) {
    const parts = segments(token.name);
    if (parts.length < 2) continue;
    const [first] = parts;
    if (!first || SCHEMA_SEGMENTS.has(first)) continue;
    counts.set(first, (counts.get(first) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([prefix]) => prefix);
}

/** Removes a vendor prefix from token names and from `var()` references to
    them, leaving values, comments and formatting alone. */
export function stripPrefix(css: string, prefix: string): string {
  const clean = prefix.replace(/^--/, "").replace(/-+$/, "");
  if (!clean) return css;
  return css.replace(new RegExp(`--${escapeRe(clean)}-`, "g"), "--");
}

/** Abbreviations the same idea gets written with. Canonicalising both sides
    first is what lets `--color-background` find `--color-bg`: a prefix test
    alone cannot, because "background" does not start with "bg". */
const SEGMENT_ALIASES: Record<string, string> = {
  bg: "background",
  fg: "foreground",
  txt: "text",
  clr: "color",
  col: "color",
  sz: "size",
  rad: "radius",
  brd: "border",
  sp: "space",
  spc: "space",
  wt: "weight",
  fw: "weight",
  fam: "family",
};

function canonicalSegment(seg: string): string {
  return SEGMENT_ALIASES[seg] ?? seg;
}

/** Two hyphen segments match when they are the same idea: equal after
    canonicalisation, or one a prefix of the other (`radius` / `radii`). */
function segmentsMatch(a: string, b: string): boolean {
  const ca = canonicalSegment(a);
  const cb = canonicalSegment(b);
  if (ca === cb) return true;
  const [short, long] = ca.length <= cb.length ? [ca, cb] : [cb, ca];
  return short.length >= 2 && long.startsWith(short);
}

/** 0..1 similarity between two token names, judged on hyphen segments so that
    `--color-background` scores high against `--color-bg` and low against
    `--color-surface`. Every segment of the shorter name matching is worth 0.8
    on its own, so `--bg` still finds `--color-bg`. */
export function nameSimilarity(a: string, b: string): number {
  const sa = segments(a);
  const sb = segments(b);
  if (!sa.length || !sb.length) return 0;
  const [short, long] = sa.length <= sb.length ? [sa, sb] : [sb, sa];
  const used = new Set<number>();
  let matched = 0;
  for (const seg of short) {
    const i = long.findIndex((l, idx) => !used.has(idx) && segmentsMatch(seg, l));
    if (i >= 0) {
      used.add(i);
      matched++;
    }
  }
  const ratio = matched / long.length;
  return matched === short.length ? Math.max(ratio, 0.8) : ratio;
}

/** Best schema name for a name the schema does not have, or null when nothing
    is close enough to be worth suggesting. Conservative on purpose: a wrong
    suggestion costs more than no suggestion. */
export function suggestSchemaName(name: string, threshold = 0.75): string | null {
  if (SCHEMA_NAME_SET.has(name)) return null;
  let best: { name: string; score: number } | null = null;
  for (const candidate of SCHEMA_NAMES) {
    const score = nameSimilarity(name, candidate);
    if (score < threshold) continue;
    if (best === null || score > best.score) best = { name: candidate, score };
  }
  return best?.name ?? null;
}

/** The block's names that the schema does not have, each with a suggestion. */
export function extraSuggestions(css: string): { name: string; suggest: string | null }[] {
  const names = [...new Set((parseTokens(css) as { name: string }[]).map((t) => t.name))];
  return names
    .filter((name) => !SCHEMA_NAME_SET.has(name))
    .sort()
    .map((name) => ({ name, suggest: suggestSchemaName(name) }));
}

/** True when the name is one Preview can read. */
export function isSchemaName(name: string): boolean {
  return SCHEMA_NAME_SET.has(name);
}
