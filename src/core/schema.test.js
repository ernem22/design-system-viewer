import { test } from "node:test";
import assert from "node:assert/strict";
import { coverage, templateCss, REFERENCE, REFERENCE_TOKEN_COUNT } from "./schema.js";
import { buildSystem, mergeSystem, parseTokens } from "./parse.js";
import { CATEGORIES } from "./taxonomy.js";

test("REFERENCE group ids all have matching taxonomy categories", () => {
  const catIds = new Set(CATEGORIES.map((c) => c.id));
  for (const g of REFERENCE) {
    assert.ok(catIds.has(g.id), `REFERENCE group "${g.id}" has no matching taxonomy category`);
  }
});

test("REFERENCE: every group non-empty, names unique, count matches", () => {
  const all = REFERENCE.flatMap((g) => g.tokens);
  assert.equal(new Set(all).size, all.length, "no duplicate token names across groups");
  assert.equal(all.length, REFERENCE_TOKEN_COUNT);
  for (const g of REFERENCE) assert.ok(g.tokens.length > 0, `${g.id} has tokens`);
});

test("coverage: present / missing / extra split", () => {
  const c = coverage(["--color-bg", "--color-surface", "--space-4", "--totally-custom"]);
  assert.equal(c.expected, REFERENCE_TOKEN_COUNT);
  assert.equal(c.present, 3);
  assert.equal(c.missing, REFERENCE_TOKEN_COUNT - 3);
  assert.deepEqual(c.extra, ["--totally-custom"]);

  const surface = c.groups.find((g) => g.id === "color-surface");
  assert.deepEqual(surface.present, ["--color-bg", "--color-surface"]);
  assert.ok(surface.missing.includes("--color-surface-overlay"));
});

test("coverage: full reference set = zero missing", () => {
  const c = coverage(REFERENCE.flatMap((g) => g.tokens));
  assert.equal(c.missing, 0);
  assert.equal(c.present, REFERENCE_TOKEN_COUNT);
  assert.equal(c.extraCount, 0);
});

test("buildSystem: attaches coverage", () => {
  const sys = buildSystem({ name: "Partial", css: ":root { --color-bg: #fff; --radius-md: 8px; }" });
  assert.equal(sys.coverage.present, 2);
  assert.ok(sys.coverage.missing > 100);
});

test("templateCss: full skeleton parses to zero tokens (all blank), covers every ref name", () => {
  const css = templateCss();
  assert.equal(parseTokens(css).length, 0, "blank --x: ; lines carry no value");
  for (const g of REFERENCE) for (const n of g.tokens) assert.ok(css.includes(`${n}: ;`), `${n} in skeleton`);
});

test("templateCss: subset scaffolds only requested names, skips empty groups", () => {
  const css = templateCss(["--color-bg", "--radius-md"]);
  assert.ok(css.includes("--color-bg: ;"));
  assert.ok(css.includes("--radius-md: ;"));
  assert.ok(!css.includes("--color-text"));
  assert.ok(!css.includes("Text"), "group with no requested token omitted");
  assert.ok(css.includes("/* Surface / Elevation */") && css.includes("/* Border Radius */"));
});

test("templateCss: filled skeleton round-trips", () => {
  const filled = templateCss(["--color-bg", "--space-4"]).replace("--color-bg: ;", "--color-bg: #fff;").replace("--space-4: ;", "--space-4: 16px;");
  const sys = buildSystem({ name: "Filled", css: filled });
  assert.equal(sys.tokenCount, 2);
  assert.equal(sys.coverage.present, 2);
});

test("mergeSystem: later block fills gaps and overrides", () => {
  const base = buildSystem({ name: "Kit", css: ":root { --color-bg: #fff; --color-text: #111; }" });
  assert.equal(base.coverage.present, 2);

  const merged = mergeSystem(base, ":root { --color-text: #000; --radius-md: 8px; --space-4: 16px; }");
  assert.equal(merged.slug, base.slug, "slug preserved");
  assert.equal(merged.createdAt, base.createdAt, "createdAt preserved");
  assert.equal(merged.coverage.present, 4, "bg + text + radius-md + space-4");

  const text = merged.groups.flatMap((g) => g.tokens).find((t) => t.name === "--color-text");
  assert.equal(text.value, "#000", "merged block wins");
});
