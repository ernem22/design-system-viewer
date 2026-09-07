// Answers "which token does this demo actually use?" by statically reading
// the source of components.jsx / extras.jsx and components.css — not by
// walking the live DOM. A DOM walk would miss anything Radix mounts through
// a Portal (Dialog, Popover, DropdownMenu, …) whenever it's closed, since
// portalled content isn't a descendant of the demo's own container element.
// Reading source text sidesteps that: a `<Dialog.Content className="…">` is
// there in the JSX regardless of whether the dialog happens to be open.
import cssText from "./styles/components.css?raw";
import componentsSrc from "./components.jsx?raw";
import extrasSrc from "./extras.jsx?raw";
import screensSrc from "./screens.jsx?raw";

// className -> Set<tokenName>, from every rule in the stylesheet. Pseudo
// classes / attribute selectors (:hover, [data-state="open"], …) collapse to
// their base class, so a hover-only token still counts.
function buildClassTokenMap(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const map = new Map();
  // Same "selector { body }" shape parse.js uses for @media blocks — the '@'
  // exclusion just makes a media wrapper's own opening brace fail to match,
  // so this still finds every rule nested inside one.
  const ruleRe = /([^{}@]+)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(noComments)) !== null) {
    const [, selectorList, body] = m;
    const tokens = [...body.matchAll(/var\(\s*(--[\w-]+)/g)].map((t) => t[1]);
    if (!tokens.length) continue;
    for (const selector of selectorList.split(",")) {
      for (const cls of selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
        const name = cls[1];
        if (!map.has(name)) map.set(name, new Set());
        for (const t of tokens) map.get(name).add(t);
      }
    }
  }
  return map;
}

// name -> source text of every top-level `function Name() { … }` in a file —
// so a Demo that renders an opaque sub-component (<ToastDemo/>, <OtpDemo/>)
// still gets that sub-component's own classes counted.
function extractFunctionBodies(src) {
  const bodies = new Map();
  const defRe = /function ([A-Z]\w*)\(\) \{/g;
  let m;
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
function extractDemoBlocks(src) {
  const starts = [...src.matchAll(/<Demo title="([^"]+)"/g)];
  return starts.map((m, i) => ({
    title: m[1],
    slice: src.slice(m.index, starts[i + 1]?.index ?? src.length),
  }));
}

const TAG_ATTRS = (tag) => new RegExp(`<${tag}\\b([^>]*)>`, "g");

function tokensForSlice(slice, localFns, classTokenMap) {
  // Pull in an opaque sub-component's own source once, so its classes and
  // inline var() calls are visible to the regexes below too.
  let text = slice;
  for (const [name, body] of localFns) {
    if (new RegExp(`<${name}\\b`).test(slice)) text += "\n" + body;
  }

  const classes = new Set();
  const directTokens = new Set();

  for (const m of text.matchAll(/className="([^"]+)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) classes.add(c);
  }
  for (const m of text.matchAll(/var\(\s*(--[\w-]+)/g)) directTokens.add(m[1]);

  // <Button>/<Field> assemble their real classNames from props inside
  // ui.jsx, invisible to a plain className="…" scan — mirror that logic.
  for (const m of text.matchAll(TAG_ATTRS("Button"))) {
    classes.add("dsv-btn");
    const attrs = m[1];
    const variant = attrs.match(/variant="([\w-]+)"/)?.[1] ?? "solid"; // ui.jsx default
    classes.add(`dsv-btn--${variant}`);
    const size = attrs.match(/size="(sm|lg)"/)?.[1]; // "md" adds no class, same as ui.jsx
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

function buildDemoTokenMap() {
  const classTokenMap = buildClassTokenMap(cssText);
  const map = new Map();
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
export function tokensForDemo(title) {
  return DEMO_TOKENS.get(title) ?? [];
}
