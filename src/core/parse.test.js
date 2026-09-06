import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTokens, parseThemes, lintTokens, buildSystem, slugify } from "./parse.js";
import { categorize } from "./taxonomy.js";

const SAMPLE = `
:root {
  /* --commented-out: nope; */
  --color-bg: #ffffff;
  --color-text: #0c0c0c;
  --color-border: #e5e7eb;
  --gray-500: #7c7c7c;
  --color-primary: #b8e62e;
  --color-accent: #ff6b00;
  --color-success: #22c55e;
  --font-size-base: 16px;
  --font-weight-bold: 700;
  --line-height-normal: 1.5;
  --space-4: 16px;
  --radius-md: 8px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.1);
  --duration-fast: 120ms;
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --z-modal: 1400;
  --mystery-value: 42;
}
[data-theme="dark"] { --color-bg: #0c0c0c; }
`;

test("parseTokens: extracts pairs, strips comments, last write wins", () => {
  const tokens = parseTokens(SAMPLE);
  const map = Object.fromEntries(tokens.map((t) => [t.name, t.value]));

  assert.equal(map["--commented-out"], undefined, "commented token must not appear");
  assert.equal(map["--color-bg"], "#0c0c0c", "dark-theme override wins (last)");
  assert.equal(map["--ease-out"], "cubic-bezier(0, 0, 0.2, 1)", "commas inside value kept");
  assert.equal(tokens.length, 17);
});

test("parseTokens: strips pasted markdown code fences", () => {
  const tokens = parseTokens("```css\n:root { --color-bg: #fff; }\n```");
  assert.deepEqual(tokens, [{ name: "--color-bg", value: "#fff" }]);
});

test("parseTokens: bad input is safe", () => {
  assert.deepEqual(parseTokens(""), []);
  assert.deepEqual(parseTokens(null), []);
  assert.deepEqual(parseTokens("body { color: red; }"), []);
});

test("categorize: buckets tokens and orders 'other' last", () => {
  const groups = categorize(parseTokens(SAMPLE));
  const byId = Object.fromEntries(groups.map((g) => [g.id, g.tokens.map((t) => t.name)]));

  assert.ok(byId["color-surface"].includes("--color-bg"));
  assert.ok(byId["color-text"].includes("--color-text"));
  assert.ok(byId["color-accent"].includes("--color-primary"));
  assert.ok(byId["color-accent"].includes("--color-accent"));
  assert.ok(byId["color-state"].includes("--color-success"));
  assert.ok(byId["color-ramp"].includes("--gray-500"));
  assert.ok(byId["font-size"].includes("--font-size-base"));
  assert.ok(byId["shadow"].includes("--shadow-sm"));
  assert.ok(byId["duration"].includes("--duration-fast"));
  assert.ok(byId["z-index"].includes("--z-modal"));
  assert.ok(byId["other"].includes("--mystery-value"), "unknown token -> other");
  assert.equal(groups.at(-1).id, "other", "'other' group emitted last");
});

test("categorize: bare --font-sans / --font-mono land in font-family", () => {
  const groups = categorize(parseTokens("--font-sans: Inter; --font-mono: monospace; --font-size-base: 16px;"));
  const byId = Object.fromEntries(groups.map((g) => [g.id, g.tokens.map((t) => t.name)]));
  assert.deepEqual(byId["font-family"], ["--font-sans", "--font-mono"]);
  assert.ok(!byId["other"], "nothing uncategorized");
});

test("categorize: 'spring' in ease-spring is not mistaken for a border ring", () => {
  const groups = categorize(parseTokens("--ease-spring: cubic-bezier(0,0,1,1); --focus-ring: #6ea8fe;"));
  const byId = Object.fromEntries(groups.map((g) => [g.id, g.tokens.map((t) => t.name)]));
  assert.ok(byId["easing"]?.includes("--ease-spring"));
  assert.ok(byId["color-interaction"]?.includes("--focus-ring"));
});

test("categorize: --shadow-focus stays in shadow, not border", () => {
  const groups = categorize(parseTokens("--shadow-focus: 0 0 0 3px #6ea8fe; --color-focus-ring: #6ea8fe;"));
  const byId = Object.fromEntries(groups.map((g) => [g.id, g.tokens.map((t) => t.name)]));
  assert.deepEqual(byId["shadow"], ["--shadow-focus"]);
  assert.deepEqual(byId["color-interaction"], ["--color-focus-ring"]);
});

test("categorize: border rule does not swallow line-height / border-width / border-radius", () => {
  const groups = categorize(
    parseTokens("--line-height-normal: 1.5; --border-width-thin: 1px; --border-radius-md: 8px; --color-border: #333;"),
  );
  const byId = Object.fromEntries(groups.map((g) => [g.id, g.tokens.map((t) => t.name)]));
  assert.ok(byId["line-height"]?.includes("--line-height-normal"));
  assert.ok(byId["border-width"]?.includes("--border-width-thin"));
  assert.ok(byId["radius"]?.includes("--border-radius-md"));
  assert.ok(byId["color-border"]?.includes("--color-border"));
});

test("buildSystem: summary counts + slug", () => {
  const sys = buildSystem({ name: "My Kit!", css: SAMPLE });
  assert.equal(sys.slug, "my-kit");
  assert.equal(sys.tokenCount, 17);
  assert.equal(sys.knownCount, 16);
  assert.deepEqual(sys.unmatched, ["--mystery-value"]);
});

test("parseThemes: splits base from .dark / [data-theme] / media overrides", () => {
  const { base, dark } = parseThemes(`
    :root { --color-bg: #fff; --color-text: #111; --space-4: 16px; }
    [data-theme="dark"] { --color-bg: #000; --color-text: #eee; }
    .dark { --color-border: #333; }
    @media (prefers-color-scheme: dark) { :root { --color-bg: #010101; } }
  `);
  const b = Object.fromEntries(base.map((t) => [t.name, t.value]));
  assert.equal(b["--color-bg"], "#fff", "base keeps light value");
  assert.equal(b["--space-4"], "16px");
  const d = Object.fromEntries(dark.map((t) => [t.name, t.value]));
  assert.equal(d["--color-text"], "#eee");
  assert.equal(d["--color-border"], "#333");
  assert.ok(d["--color-bg"] && d["--color-bg"] !== "#fff", "dark bg override captured");
  assert.ok(!("--space-4" in d), "unchanged tokens are not in dark set");
});

test("parseThemes: no theme block -> empty dark, base unchanged", () => {
  const { base, dark } = parseThemes(":root { --a: 1px; --b: 2px; }");
  assert.equal(base.length, 2);
  assert.deepEqual(dark, []);
});

test("lintTokens: flags unitless length, bad hex, unknown colour, dangling var", () => {
  const msgs = Object.fromEntries(
    lintTokens(parseTokens(`
      --space-4: 16;
      --radius-md: 8px;
      --color-bg: #ggg;
      --color-accent: 123abc;
      --color-text: var(--nope);
      --color-ok: var(--color-bg);
    `)).map((w) => [w.name, w.msg]),
  );
  assert.match(msgs["--space-4"], /unitless/);
  assert.equal(msgs["--radius-md"], undefined, "valid px is clean");
  assert.match(msgs["--color-bg"], /hex/);
  assert.match(msgs["--color-accent"], /unrecognized/);
  assert.match(msgs["--color-text"], /undefined/);
  assert.equal(msgs["--color-ok"], undefined, "var() to a defined token is fine");
});

test("buildSystem: carries dark theme + warnings", () => {
  const sys = buildSystem({
    name: "Themed",
    css: `:root { --color-bg: #fff; --space-4: 16 } [data-theme="dark"] { --color-bg: #000 }`,
  });
  assert.deepEqual(sys.themes.dark, [{ name: "--color-bg", value: "#000" }]);
  assert.equal(sys.warnings.length, 1);
  assert.match(sys.warnings[0].msg, /unitless/);
});

test("slugify: turkish + junk collapses", () => {
  assert.equal(slugify("Company Theme 2026"), "company-theme-2026");
  assert.equal(slugify("   "), "system");
});
