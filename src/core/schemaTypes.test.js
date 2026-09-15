import { test } from "node:test";
import assert from "node:assert/strict";
import { REFERENCE, REFERENCE_TOKEN_COUNT } from "./schema.js";
import { SCHEMA_TYPES, OTHER_TYPE, typeOfGroup, parseSchemaByType, tokensOfType } from "./schemaTypes.js";

test("every REFERENCE group has a deliberately chosen type (no silent other)", () => {
  for (const g of REFERENCE) {
    assert.notEqual(typeOfGroup(g.id), OTHER_TYPE, `schema group "${g.id}" is unmapped`);
  }
});

test("unknown group ids fall back to other instead of throwing", () => {
  assert.equal(typeOfGroup("not-a-group"), OTHER_TYPE);
});

test("motion type holds duration, easing and all motion-* groups", () => {
  const ids = parseSchemaByType().find((s) => s.type === "motion").groups.map((g) => g.id);
  assert.deepEqual(ids, ["duration", "motion-distance", "motion-scale", "motion-blur", "easing", "motion"]);
});

test("typography type holds font-*, line-height, letter-spacing, text-measure", () => {
  const ids = parseSchemaByType().find((s) => s.type === "typography").groups.map((g) => g.id);
  assert.deepEqual(ids, [
    "font-family",
    "font-display",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "text-measure",
  ]);
});

test("parseSchemaByType: lossless, ordered, counted", () => {
  const sections = parseSchemaByType();
  assert.deepEqual(
    sections.map((s) => s.type),
    SCHEMA_TYPES.map((t) => t.type),
    "every type present, in SCHEMA_TYPES order",
  );
  assert.equal(
    sections.reduce((n, s) => n + s.tokenCount, 0),
    REFERENCE_TOKEN_COUNT,
    "no token lost or duplicated",
  );
  for (const s of sections) {
    assert.equal(
      s.tokenCount,
      s.groups.reduce((n, g) => n + g.tokens.length, 0),
      `${s.type} count matches its groups`,
    );
  }
});

test("parseSchemaByType: does not mutate the input", () => {
  const before = JSON.stringify(REFERENCE);
  parseSchemaByType();
  assert.equal(JSON.stringify(REFERENCE), before);
});

test("tokensOfType: motion tokens are exactly the motion groups' tokens", () => {
  const viaHelper = tokensOfType("motion");
  const viaSections = parseSchemaByType()
    .find((s) => s.type === "motion")
    .groups.flatMap((g) => g.tokens);
  assert.deepEqual(viaHelper, viaSections);
  assert.ok(viaHelper.includes("--duration-fast"), "spot-check duration token");
  assert.ok(viaHelper.includes("--ease-out"), "spot-check easing token");
  assert.ok(viaHelper.includes("--motion-enter"), "spot-check semantic motion token");
});
