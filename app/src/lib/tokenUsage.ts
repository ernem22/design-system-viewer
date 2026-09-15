// Answers "which token does this demo actually use?" by statically reading
// the source of the gallery's .tsx bodies and .css files — not by walking
// the live DOM. A DOM walk would miss anything Radix mounts through a Portal
// (Dialog, Popover, DropdownMenu, …) whenever it's closed, since portalled
// content isn't a descendant of the demo's own container element. Reading
// source text sidesteps that: a `<Dialog.Content className="…">` is there in
// the JSX regardless of whether the dialog happens to be open.
//
// Ported from preview/src/tokenUsage.js. The `?raw` source-import trick works
// the same way in app/ — but instead of named imports (which had to be edited
// every time a gallery section was added), this uses `import.meta.glob` so
// new bodies and stylesheets under gallery/ are picked up automatically.
//
// Screens have no separate map here (unlike the legacy tokensForScreen):
// app/ renders every section — components and screens alike — through the
// same <Demo title="…"> blocks, so one title-keyed map covers everything.

const tsxSources = import.meta.glob<string>("../gallery/components/**/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
});
const cssSources = import.meta.glob<string>("../gallery/**/*.css", {
  query: "?raw",
  import: "default",
  eager: true,
});

// className -> Set<tokenName>, from every rule in the stylesheets. Pseudo
// classes / attribute selectors (:hover, [data-state="open"], …) collapse to
// their base class, so a hover-only token still counts.
function buildClassTokenMap(css: string): Map<string, Set<string>> {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const map = new Map<string, Set<string>>();
  // Same "selector { body }" shape parse.js uses for @media blocks — the '@'
  // exclusion just makes a media wrapper's own opening brace fail to match,
  // so this still finds every rule nested inside one.
  const ruleRe = /([^{}@]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(noComments)) !== null) {
    const [, selectorList, body] = m;
    const tokens = [...body.matchAll(/var\(\s*(--[\w-]+)/g)].map((t) => t[1]);
    if (!tokens.length) continue;
    for (const selector of selectorList.split(",")) {
      for (const cls of selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
        const name = cls[1];
        if (!map.has(name)) map.set(name, new Set());
        for (const t of tokens) map.get(name)?.add(t);
      }
    }
  }
  return map;
}

// name -> source text of every top-level `function Name(…) { … }` in a file —
// so a Demo that renders an opaque sub-component (<ToastDemo/>, <OtpDemo/>)
// still gets that sub-component's own classes counted. The signature scan
// tolerates typed params and return annotations (`function ListItem({…}:
// Props) { … }`) — the legacy version only matched bare `Name()`, which
// would miss this repo's typed helpers.
function extractFunctionBodies(src: string): Map<string, string> {
  const bodies = new Map<string, string>();
  const defRe = /function ([A-Z]\w*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = defRe.exec(src)) !== null) {
    // Skip the parameter list (paren-aware, quote-aware — defaults may hold
    // strings with parens), then an optional `: ReturnType`, to land on the
    // body's own opening brace.
    let i = defRe.lastIndex;
    let parens = 1;
    let quote: string | null = null;
    while (parens > 0 && i < src.length) {
      const ch = src[i];
      if (quote) {
        if (ch === quote && src[i - 1] !== "\\") quote = null;
      } else if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
      } else if (ch === "(") {
        parens++;
      } else if (ch === ")") {
        parens--;
      }
      i++;
    }
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] === ":") {
      while (i < src.length && src[i] !== "{") i++;
    }
    if (src[i] !== "{") continue;
    let depth = 1;
    i++;
    const start = m.index;
    while (depth > 0 && i < src.length) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    bodies.set(m[1], src.slice(start, i));
    defRe.lastIndex = i;
  }
  return bodies;
}

// { title, slice } for every <Demo title="…"> block — sliced from its own
// opening tag up to the next Demo's (or end of file), which is exact since
// Demo blocks are siblings that never nest.
function extractDemoBlocks(src: string): Array<{ title: string; slice: string }> {
  const starts = [...src.matchAll(/<Demo title="([^"]+)"/g)];
  return starts.map((s, i) => ({
    title: s[1],
    slice: src.slice(s.index, starts[i + 1]?.index ?? src.length),
  }));
}

const TAG_ATTRS = (tag: string) => new RegExp(`<${tag}\\b([^>]*)>`, "g");

function tokensForSlice(
  slice: string,
  localFns: Map<string, string>,
  classTokenMap: Map<string, Set<string>>,
): string[] {
  // Pull in an opaque sub-component's own source once, so its classes and
  // inline var() calls are visible to the regexes below too.
  let text = slice;
  for (const [name, body] of localFns) {
    if (new RegExp(`<${name}\\b`).test(slice)) text += "\n" + body;
  }

  const classes = new Set<string>();
  const directTokens = new Set<string>();

  for (const m of text.matchAll(/className="([^"]+)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) classes.add(c);
  }
  for (const m of text.matchAll(/var\(\s*(--[\w-]+)/g)) directTokens.add(m[1]);

  // <Button>/<Field> assemble their real classNames from props inside
  // gallery/ui.tsx, invisible to a plain className="…" scan — mirror that
  // logic (defaults and md-means-no-class included).
  for (const m of text.matchAll(TAG_ATTRS("Button"))) {
    classes.add("dsv-btn");
    const attrs = m[1];
    const variant = attrs.match(/variant="([\w-]+)"/)?.[1] ?? "solid"; // ui.tsx default
    classes.add(`dsv-btn--${variant}`);
    const size = attrs.match(/size="(sm|lg|xl)"/)?.[1]; // "md" adds no class, same as ui.tsx
    if (size) classes.add(`dsv-btn--${size}`);
  }
  for (const m of text.matchAll(TAG_ATTRS("Field"))) {
    classes.add("dsv-field");
    const attrs = m[1];
    if (/\blabel=/.test(attrs)) classes.add("dsv-label");
    if (/\berror=/.test(attrs)) classes.add("dsv-hint--err");
    else if (/\bhint=/.test(attrs)) classes.add("dsv-hint");
  }

  const tokens = new Set(directTokens);
  for (const cls of classes) {
    const t = classTokenMap.get(cls);
    if (t) for (const x of t) tokens.add(x);
  }
  // Dynamic classNames (template literals, ternaries) are invisible to the
  // static className="…" scan above — match any dsv-* identifier in the text
  // instead (this repo's gallery convention is dsv-* throughout). A trailing
  // "--" (e.g. `dsv-gradient-tile--${label}`) acts as a prefix matching every
  // variant class, since the concrete suffix is only known at runtime.
  for (const m of text.matchAll(/dsv-[a-zA-Z0-9_-]+/g)) {
    const raw = m[0];
    const exact = classTokenMap.get(raw.replace(/-+$/, ""));
    if (exact) for (const x of exact) tokens.add(x);
    if (/-$/.test(raw)) {
      for (const [cls, set] of classTokenMap) {
        if (cls.startsWith(raw)) for (const x of set) tokens.add(x);
      }
    }
  }
  return [...tokens].sort();
}

function buildDemoTokenMap(): Map<string, string[]> {
  const cssText = Object.values(cssSources).join("\n");
  const classTokenMap = buildClassTokenMap(cssText);
  const map = new Map<string, string[]>();
  for (const src of Object.values(tsxSources)) {
    const localFns = extractFunctionBodies(src);
    for (const { title, slice } of extractDemoBlocks(src)) {
      map.set(title, tokensForSlice(slice, localFns, classTokenMap));
    }
  }
  return map;
}

const DEMO_TOKENS = buildDemoTokenMap();

/** Tokens a given `<Demo title="…">` block references, sorted; [] if unknown. */
export function tokensForDemo(title: string): string[] {
  return DEMO_TOKENS.get(title) ?? [];
}
