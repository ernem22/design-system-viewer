import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  decode,
  decodeSystem,
  encode,
  encodeSystem,
  SHARE_EMBED_LIMIT,
} from "./shareLink.ts";
import { parseTokens } from "../../../src/core/parse.js";

// Issue #337: "Copy link to this view" copied a URL with no system data, so a
// recipient with only the bundled catalogue opened some other system. The `s`
// payload embeds the tokens (minified, deflate-raw, base64url). RED on the
// parent commit, where shareLink.ts does not exist.

const UNSAFE_VALUE = /(url\(|@import|expression\(|javascript:)/i;

function bundledCss(slug: string): { name: string; css: string } {
  const raw = JSON.parse(
    readFileSync(new URL(`../../../systems/${slug}.json`, import.meta.url), "utf8"),
  ) as { name: string; css: string };
  return { name: raw.name, css: raw.css };
}

describe("shareLink round-trip (issue #337)", () => {
  it("round-trips perp-ultra-v2's CSS token-for-token within the embed limit", async () => {
    const { name, css } = bundledCss("perp-ultra-v2");
    const encoded = await encode({ name, css });
    expect(encoded.length).toBeLessThanOrEqual(SHARE_EMBED_LIMIT);
    expect(encoded.length).toBeLessThanOrEqual(7000);

    const decoded = await decode(encoded);
    expect(decoded.name).toBe(name);
    // Token-for-token: the same parsed stream the viewer renders, unsafe
    // values aside (perp-ultra-v2 ships none, so this is the whole stream).
    const expected = (
      parseTokens(css) as { name: string; value: string }[]
    ).filter((t) => !UNSAFE_VALUE.test(t.value));
    expect(decoded.tokens).toEqual(expected);
    expect(decoded.dropped).toBe(
      (parseTokens(css) as unknown[]).length - expected.length,
    );
  });

  it("drops a url(...) value and reports 1 dropped", async () => {
    const encoded = await encodeSystem({
      name: "Unsafe demo",
      css: ":root { --ok: #ffffff; --x: url(https://e.example/a.png); }",
    });
    const decoded = await decodeSystem(encoded);
    expect(decoded.tokens.map((t) => t.name)).not.toContain("--x");
    expect(decoded.tokens.map((t) => t.name)).toContain("--ok");
    expect(decoded.dropped).toBe(1);
  });

  it("rejects a damaged payload instead of applying it", async () => {
    await expect(decode("a".repeat(100))).rejects.toThrow();
    await expect(decode("!!!not-a-payload!!!")).rejects.toThrow();
    await expect(decode("a".repeat(20001))).rejects.toThrow();
  });
});
