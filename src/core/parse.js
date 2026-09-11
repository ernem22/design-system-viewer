import { categorize } from "./taxonomy.js";
import { coverage } from "./schema.js";

/**
 * Extract every `--custom-property: value;` declaration from a raw CSS blob.
 * Selector-agnostic: pairs from any rule are collected flat, last write wins.
 * Comments are stripped first so `/* --fake: 1; *\/` never matches.
 *
 * @param {string} css
 * @returns {{name: string, value: string}[]}
 */
/** Drop markdown code fences a user may have pasted around the block. */
const stripFences = (css) => String(css).replace(/```[a-z]*\n?|```/gi, "");

export function parseTokens(css) {
  if (typeof css !== "string") return [];
  const withoutComments = stripFences(css).replace(/\/\*[\s\S]*?\*\//g, "");

  /** @type {Map<string,string>} */
  const seen = new Map();
  // --name : value ;  — value is everything up to the next unescaped ; or }
  const re = /(--[A-Za-z0-9_-]+)\s*:\s*([^;}]+)\s*(?:;|(?=}))/g;
  let m;
  while ((m = re.exec(withoutComments)) !== null) {
    const name = m[1].trim();
    const value = m[2].trim().replace(/\s+/g, " ");
    if (value) seen.set(name, value); // last wins
  }

  return [...seen].map(([name, value]) => ({ name, value }));
}

// Selectors that mark a dark-theme override block.
const DARK_SEL = /(^|[\s,>])(:root)?(\.dark\b|\[data-theme\s*[~|]?=\s*["']?dark["']?\]|\[data-mode\s*=\s*["']?dark["']?\])/i;

/**
 * Split a CSS blob into the base token set and its dark-theme overrides.
 * Handles `.dark` / `[data-theme="dark"]` rules and `@media (prefers-color-scheme: dark) { … }`
 * blocks with any number of inner rules.
 *
 * @param {string} css
 * @returns {{ base: {name:string,value:string}[], dark: {name:string,value:string}[] }}
 */
export function parseThemes(css) {
  const clean = stripFences(String(css)).replace(/\/\*[\s\S]*?\*\//g, "");
  let darkCss = "";
  let withoutMedia = "";
  // balanced-brace extraction for @media dark blocks
  {
    let i = 0;
    const lower = clean.toLowerCase();
    while (i < clean.length) {
      const at = lower.indexOf("@media", i);
      if (at === -1) { withoutMedia += clean.slice(i); break; }
      const brace = clean.indexOf("{", at);
      if (brace === -1) { withoutMedia += clean.slice(i); break; }
      const header = clean.slice(at, brace);
      const isDark = /prefers-color-scheme\s*:\s*dark/i.test(header);
      withoutMedia += clean.slice(i, at);
      // find matching closing brace
      let depth = 0;
      let end = -1;
      for (let j = brace; j < clean.length; j++) {
        if (clean[j] === "{") depth++;
        else if (clean[j] === "}") { depth--; if (depth === 0) { end = j; break; } }
      }
      if (end === -1) { // unterminated, treat rest as block
        if (isDark) darkCss += "\n" + clean.slice(brace + 1);
        break;
      }
      const inner = clean.slice(brace + 1, end);
      if (isDark) darkCss += "\n" + inner;
      else withoutMedia += " " + inner + " ";
      i = end + 1;
    }
  }

  // Rebuild the light side in *document order*: bare `--x: y;` declarations that
  // sit outside any rule, interleaved with the bodies of non-dark rules exactly
  // as they appear. Order is the whole contract — mergeSystem appends new
  // declarations after the stored `:root { … }`, so bucketing bare and rule
  // declarations separately let the original always win and made every merge a
  // silent no-op.
  let baseCss = "";
  // Selector regex excludes ';' so a bare `--x: y;` outside {} isn't eaten as a selector.
  const ruleRe = /([^{};]+)\{([^{}]*)\}/g;
  let m;
  let lastIdx = 0;
  while ((m = ruleRe.exec(withoutMedia)) !== null) {
    baseCss += "\n" + withoutMedia.slice(lastIdx, m.index) + ";";
    // re-terminate: a rule's last declaration may have dropped its semicolon
    if (DARK_SEL.test(m[1])) darkCss += "\n" + m[2] + ";";
    else baseCss += "\n" + m[2] + ";";
    lastIdx = ruleRe.lastIndex;
  }
  baseCss += "\n" + withoutMedia.slice(lastIdx) + ";";
  const base = parseTokens(baseCss);
  const baseMap = new Map(base.map((t) => [t.name, t.value]));
  const dark = parseTokens(darkCss).filter((t) => baseMap.get(t.name) !== t.value);
  return { base, dark };
}

const COLORY = /(^|-)(color|bg|background|fill|stroke|accent|brand|primary|surface|text|scrim|tint|shade|ink|ring)(-|$)/;
const LENGTHY = /(^|-)(space|spacing|gap|radius|rounded|inset|gutter|blur|offset)(-|$)|(-)(width|height|size|radius|gap)(-|$)/;
const BARE_NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;
const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_FN = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|gradient|linear-gradient|radial-gradient|conic-gradient)\(/i;
const NAMED = /^[a-z]+$/i;

/**
 * Cheap value sanity checks — never blocks a save, just surfaces likely typos
 * (unitless lengths, malformed hex, unknown colour syntax, dangling var()).
 * @param {{name:string,value:string}[]} tokens
 * @returns {{name:string,value:string,msg:string}[]}
 */
export function lintTokens(tokens) {
  const defined = new Set(tokens.map((t) => t.name));
  const out = [];
  for (const { name, value } of tokens) {
    const bare = name.replace(/^--/, "");
    const v = value.trim();

    const varRefs = [...v.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)].map((mm) => mm[1]);
    const missingRef = varRefs.find((r) => !defined.has(r));
    if (missingRef) { out.push({ name, value, msg: `undefined variable ${missingRef}` }); continue; }
    if (varRefs.length) continue; // value delegates to another token — trust it

    if (v.startsWith("#") && !HEX.test(v)) { out.push({ name, value, msg: "invalid hex code" }); continue; }

    // unitless line-height is valid CSS (a multiplier, not a length) — and a
    // trailing !important never makes an otherwise fine value wrong
    const vClean = v.replace(/\s*!important\s*$/i, "");
    if (LENGTHY.test(bare) && !/line-height/.test(bare) && BARE_NUMBER.test(vClean) && vClean !== "0") {
      out.push({ name, value, msg: "unitless length (missing px/rem?)" });
      continue;
    }
    // A name that reads as a measurement (LENGTHY: *-radius, *-width, *-gap…)
    // is never a color, even when it also contains a color-ish word like
    // "ring" (--focus-ring-radius) or "stroke" (--icon-stroke-width). The old
    // literal denylist missed members of the same family every time.
    if (COLORY.test(bare) && !LENGTHY.test(bare) && !/shadow|gradient|measure|motion|glow/.test(bare)) {
      const ok = HEX.test(vClean) || COLOR_FN.test(vClean) || NAMED.test(vClean) || vClean === "none";
      if (!ok) out.push({ name, value, msg: "unrecognized color value" });
    }
  }
  return out;
}

function wrapWithRoot(css) {
  let raw = stripFences(String(css)).trim();
  if (!raw) return ":root {\n}\n";
  if (raw.trim().startsWith(":root")) return raw;
  const tokens = parseTokens(raw);
  if (!tokens.length) return raw;
  return `:root {\n${tokens.map(t => `  ${t.name}: ${t.value};`).join("\n")}\n}\n`;
}

/**
 * Parse + categorize in one step — the shape stored in systems/<slug>.json.
 * @param {{name:string, css:string}} input
 */
export function buildSystem({ name, css, slug, createdAt }) {
  css = wrapWithRoot(css);
  const { base, dark } = parseThemes(css);
  const tokens = base;
  const groups = categorize(tokens);
  const known = groups
    .filter((g) => g.id !== "other")
    .reduce((sum, g) => sum + g.tokens.length, 0);
  const created = createdAt || new Date().toISOString();
  return {
    name: (name || "Untitled").trim(),
    slug: slug || slugify(name || "untitled"),
    createdAt: created,
    updatedAt: created,
    css,
    tokenCount: tokens.length,
    knownCount: known,
    unmatched: groups.find((g) => g.id === "other")?.tokens.map((t) => t.name) ?? [],
    groups,
    coverage: coverage(tokens.map((t) => t.name)),
    themes: dark.length ? { dark } : undefined,
    warnings: lintTokens(tokens),
  };
}

/**
 * Append a CSS block to an existing system's source and rebuild. Later
 * declarations win (parseTokens is last-write), so this is a token merge.
 * @param {{name:string,slug:string,css:string,createdAt:string}} existing
 * @param {string} moreCss
 */
export function mergeSystem(existing, moreCss) {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const css = `${existing.css}\n\n/* + added ${stamp} */\n${moreCss}`;
  const built = buildSystem({ name: existing.name, slug: existing.slug, createdAt: existing.createdAt, css });
  built.updatedAt = new Date().toISOString();
  return built;
}

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "system";
}
