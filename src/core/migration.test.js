import { test } from "node:test";
import assert from "node:assert/strict";
import { coverage, templateCss, REFERENCE, REFERENCE_TOKEN_COUNT } from "./schema.js";
import { buildSystem, lintTokens, parseTokens } from "./parse.js";
import { CATEGORIES, categorize } from "./taxonomy.js";

const bucketOf = (name) => {
  const groups = categorize([{ name, value: "x" }]);
  return groups[0]?.id;
};

test("migration: every new REFERENCE group has a matching taxonomy category", () => {
  const catIds = new Set(CATEGORIES.map((c) => c.id));
  for (const g of REFERENCE) {
    assert.ok(catIds.has(g.id), `REFERENCE group "${g.id}" has no matching taxonomy category`);
  }
});

test("migration: expected new categories exist in schema + taxonomy", () => {
  const refIds = new Set(REFERENCE.map((g) => g.id));
  for (const id of [
    "color-brand", "font-display", "text-measure", "section-spacing",
    "composition", "media", "control-geometry", "iconography",
    "glow", "gradient", "motion-distance", "motion-scale", "motion-blur",
    "motion", "accessibility", "responsive",
    "component-button", "component-card", "component-nav", "component-badge",
    "component-modal", "component-tooltip", "component-input",
    "component-avatar", "component-divider", "component-overlay",
  ]) {
    assert.ok(refIds.has(id), `REFERENCE missing group "${id}"`);
  }
});

test("migration: every token buckets into its own schema group", () => {
  const bad = [];
  for (const g of REFERENCE) {
    for (const name of g.tokens) {
      if (bucketOf(name) !== g.id) bad.push(`${name} (want ${g.id}, got ${bucketOf(name)})`);
    }
  }
  assert.deepEqual(bad, [], "every token must categorize into its schema group");
});

test("migration: preserved tokens still exist with stable names", () => {
  const all = new Set(REFERENCE.flatMap((g) => g.tokens));
  for (const name of [
    "--color-bg", "--color-surface", "--color-text", "--color-text-secondary",
    "--color-accent", "--color-border", "--font-size-base", "--font-weight-bold",
    "--space-4", "--radius-md", "--shadow-md",
    "--grid-columns", "--grid-gutter",
  ]) {
    assert.ok(all.has(name), `preserved token "${name}" missing from schema`);
  }
});

test("migration: token aliases round-trip without warnings", () => {
  const sys = buildSystem({
    name: "Aliased",
    css: `:root {
      --color-neutral-900: #111;
      --color-text: var(--color-neutral-900);
      --radius-md: 8px;
      --button-radius: var(--radius-md);
      --duration-normal: 250ms;
      --ease-emphasized: cubic-bezier(0, 0, 0.2, 1);
      --motion-enter: var(--duration-normal) var(--ease-emphasized);
    }`,
  });
  const map = Object.fromEntries(
    sys.groups.flatMap((g) => g.tokens).map((t) => [t.name, t.value]),
  );
  assert.equal(map["--color-text"], "var(--color-neutral-900)", "alias value preserved verbatim");
  assert.equal(map["--motion-enter"], "var(--duration-normal) var(--ease-emphasized)", "composite ref preserved");
  assert.deepEqual(sys.warnings, [], "defined refs produce no warnings");
  assert.equal(bucketOf("--button-radius"), "component-button");
});

test("migration: undefined var() refs still warn, never block", () => {
  const warnings = lintTokens(parseTokens("--motion-page: var(--duration-missing) var(--ease-out);"));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].msg, /undefined variable --duration-missing/);
});

test("migration: new non-color tokens don't false-positive the color lint", () => {
  const warnings = lintTokens(parseTokens(`
    --text-measure-md: 65ch;
    --focus-ring-width: 2px;
    --focus-ring-radius: 0.5rem;
    --focus-ring-offset: 2px;
    --icon-stroke-width: 1.5px;
    --icon-stroke-width-thin: 1px;
    --icon-stroke-width-medium: 2px;
    --icon-stroke-width-bold: 2.5px;
    --ring-offset-width: 2px;
    --line-height-normal: 1.5;
    --color-accent: red !important;
    --gradient-brand: linear-gradient(135deg, #6366f1, #4f46e5);
    --motion-enter: 250ms cubic-bezier(0, 0, 0.2, 1);
    --glow-sm: 0 0 24px rgba(99, 102, 241, 0.35);
    --section-space-md: 64px;
    --container-padding-md: 24px;
  `));
  assert.deepEqual(warnings, [], `unexpected lint warnings: ${JSON.stringify(warnings)}`);
});

test("migration: responsive + composition + media + component tokens bucket correctly", () => {
  const cases = {
    "section-spacing": ["--section-space-md"],
    "composition": ["--composition-gutter", "--composition-max-width", "--composition-overlap-lg", "--composition-aspect-wide"],
    "media": ["--media-radius", "--media-aspect-video", "--media-overlay-strong"],
    "control-geometry": ["--control-padding-x-md", "--control-radius", "--control-icon-gap"],
    "iconography": ["--icon-stroke-width", "--icon-gap-sm"],
    "responsive": ["--mobile-page-padding", "--desktop-grid-gap"],
    "glow": ["--glow-md"],
    "gradient": ["--gradient-hero"],
    "motion-distance": ["--motion-distance-md"],
    "motion-scale": ["--motion-scale-hover"],
    "motion": ["--motion-modal"],
    "accessibility": ["--focus-ring-width", "--touch-target-min"],
    "color-brand": ["--color-brand-500"],
    "font-display": ["--font-size-display-md"],
    "layout": ["--container-padding-lg", "--grid-margin-md", "--grid-columns-lg", "--container-max-width-2xl"],
    "component-button": ["--button-height-md"],
    "component-card": ["--card-shadow"],
    "component-nav": ["--nav-item-height"],
    "component-badge": ["--badge-radius"],
    "component-modal": ["--modal-width-lg"],
    "component-tooltip": ["--tooltip-max-width"],
    "component-input": ["--input-height-md"],
    "component-avatar": ["--avatar-ring-color"],
    "component-divider": ["--divider-spacing"],
    "component-overlay": ["--overlay-blur"],
  };
  for (const [want, names] of Object.entries(cases)) {
    for (const name of names) {
      assert.equal(bucketOf(name), want, `${name} should bucket into ${want}`);
    }
  }
});

test("migration: template skeleton covers the expanded schema, subset still works", () => {
  const css = templateCss();
  assert.equal(parseTokens(css).length, 0, "blank lines carry no value");
  for (const name of ["--color-brand-500", "--section-space-md", "--button-height-md", "--motion-enter", "--gradient-hero"]) {
    assert.ok(css.includes(`${name}: ;`), `${name} in skeleton`);
  }
  const sub = templateCss(["--button-radius", "--color-bg"]);
  assert.ok(sub.includes("--button-radius: ;") && sub.includes("--color-bg: ;"));
  assert.ok(!sub.includes("--motion-enter"));
});

test("migration: coverage counts the expanded reference set", () => {
  const c = coverage(REFERENCE.flatMap((g) => g.tokens));
  assert.equal(c.missing, 0);
  assert.equal(c.present, REFERENCE_TOKEN_COUNT);
  assert.ok(REFERENCE_TOKEN_COUNT > 400, `schema expanded (got ${REFERENCE_TOKEN_COUNT})`);
});
