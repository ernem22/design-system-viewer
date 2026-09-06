import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRgb, contrastRatio, rating } from "./contrast.js";

test("parseRgb: pulls a triple from any rgb-ish string", () => {
  assert.deepEqual(parseRgb("rgb(255, 255, 255)"), [255, 255, 255]);
  assert.deepEqual(parseRgb("rgba(0, 0, 0, 0.5)"), [0, 0, 0]);
  assert.deepEqual(parseRgb("12 34 56"), [12, 34, 56]);
  // naive: takes the first 3 numbers of anything. Fine — app.js only ever
  // feeds it browser-computed rgb(); Node tests pass explicit triples.
  assert.equal(parseRgb("nope"), null);
});

test("contrastRatio: known WCAG anchors", () => {
  assert.equal(Math.round(contrastRatio([0, 0, 0], [255, 255, 255])), 21);
  assert.equal(contrastRatio([255, 255, 255], [255, 255, 255]), 1);
  const midGrey = contrastRatio("rgb(119,119,119)", "rgb(255,255,255)");
  assert.ok(midGrey > 4 && midGrey < 5, `#777 on white ~4.48, got ${midGrey}`);
});

test("contrastRatio: unparseable colour -> null", () => {
  assert.equal(contrastRatio("oklch(0.2 0 0)", "#fff"), null);
});

test("rating: AA / AAA thresholds", () => {
  assert.equal(rating(21).label, "AAA");
  assert.equal(rating(4.6).label, "AA");
  assert.equal(rating(3.2).pass, "large");
  assert.equal(rating(2).pass, false);
  assert.equal(rating(null).label, "—");
});
