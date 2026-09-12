// Answers "which token does this demo actually use?" by statically reading
// the source of the section files and gallery.css — not by walking the live
// DOM. A DOM walk would miss anything Radix mounts through a Portal (Dialog,
// Popover, DropdownMenu, …) whenever it's closed, since portalled content
// isn't a descendant of the demo's own container element.
import cssText from "./gallery.css?raw";
import componentsSrc from "./components.tsx?raw";
import extrasSrc from "./extras.tsx?raw";
import screensSrc from "./screens.tsx?raw";

// className -> Set<tokenName>, from every rule in the stylesheet. Pseudo
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
    if (tokens.length === 0) continue;
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

// name -> source text of every top-level `function Name() { … }` in a file —
// so a Demo that renders an opaque sub-component (<ToastDemo/>, <OtpDemo/>)
// still gets that sub-component's own classes counted.
function extractFunctionBodies(src: string): Map<string, string> {
  const bodies = new Map<string, string>();
  const defRe = /function ([A-Z]\w*)\(\) \{/g;
  let m: RegExpExecArray | null;
  while ((m = defRe.exec(src)) !== null) {
    let depth = 1;
    let i = defRe.lastIndex;
    while (depth > 0 && i < src.length) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    bodies.set(m[1], src.slice(m.index, i));
  }
  return bodies;
}

// { title, slice } for every <Demo title="…"> block — sliced from its own
// opening tag up to the next Demo's (or end of file), which is exact since
// Demo blocks are siblings that never nest.
function extractDemoBlocks(src: string): { title: string; slice: string }[] {
  const starts = [...src.matchAll(/<Demo title="([^"]+)"/g)];
  return starts.map((m, i) => ({
    title: m[1],
    slice: src.slice(m.index, starts[i + 1]?.index ?? src.length),
  }));
}

const TAG_ATTRS = (tag: string): RegExp => new RegExp(`<${tag}\\b([^>]*)>`, "g");

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
  // ui.tsx, invisible to a plain className="…" scan — mirror that logic.
  for (const m of text.matchAll(TAG_ATTRS("Button"))) {
    classes.add("dsv-btn");
    const attrs = m[1];
    const variant = attrs.match(/variant="([\w-]+)"/)?.[1] ?? "solid"; // ui.tsx default
    classes.add(`dsv-btn--${variant}`);
    const size = attrs.match(/size="(sm|lg)"/)?.[1]; // "md" adds no class, same as ui.tsx
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
  return [...tokens].sort();
}

function buildDemoTokenMap(): Map<string, string[]> {
  const classTokenMap = buildClassTokenMap(cssText);
  const map = new Map<string, string[]>();
  for (const src of [componentsSrc, extrasSrc, screensSrc]) {
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

// Screens aren't <Demo> blocks — each is one whole-page mockup assigned to a
// stable id via the `["screen-id", "Label", BodyFn, "desc"]` rows of
// SCREEN_SECTIONS. BodyFn is a real `function Name() {}` (matches
// extractFunctionBodies), so its full body is the screen's slice.
function extractScreenIds(src: string): { id: string; fn: string }[] {
  return [...src.matchAll(/\["([a-z0-9-]+)",\s*"[^"]*",\s*([A-Z]\w*),\s*"[^"]*"\]/g)].map((m) => ({
    id: m[1],
    fn: m[2],
  }));
}

function buildScreenTokenMap(): Map<string, string[]> {
  const classTokenMap = buildClassTokenMap(cssText);
  const map = new Map<string, string[]>();
  const localFns = extractFunctionBodies(screensSrc);
  for (const { id, fn } of extractScreenIds(screensSrc)) {
    const body = localFns.get(fn);
    if (body) map.set(id, tokensForSlice(body, localFns, classTokenMap));
  }
  return map;
}

const SCREEN_TOKENS = buildScreenTokenMap();

/** Tokens a given `<Screen id="…">`'s body references, sorted; [] if unknown. */
export function tokensForScreen(id: string): string[] {
  return SCREEN_TOKENS.get(id) ?? [];
}
