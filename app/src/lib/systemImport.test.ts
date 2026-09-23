import { describe, expect, it } from "vitest";
import {
  detectImportFormat,
  detectPrefixes,
  extraSuggestions,
  isSchemaName,
  nameSimilarity,
  readSystemJson,
  stripPrefix,
  suggestSchemaName,
} from "./systemImport.ts";

// Issue #124: the import sources. These are the pure readers behind the
// dialog's Source step — a JSON export has to come back in, a vendor prefix has
// to be strippable, and a name the schema does not have has to be offered a
// near-miss suggestion instead of silently scoring as an extra.

const JSON_EXPORT = JSON.stringify({
  name: "Aurora",
  slug: "aurora",
  css: ":root {\n  --color-bg: #0a0a0f;\n}",
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
});

describe("detectImportFormat", () => {
  it("reads a CSS block with a token line", () => {
    expect(detectImportFormat("--color-bg: #fff;")).toBe("css");
  });

  it("reads our own JSON export", () => {
    expect(detectImportFormat(JSON_EXPORT)).toBe("system-json");
  });

  it("rejects JSON without a css field, and plain text", () => {
    expect(detectImportFormat('{"name":"x"}')).toBe("unknown");
    expect(detectImportFormat("hello world")).toBe("unknown");
    expect(detectImportFormat("")).toBe("unknown");
  });
});

describe("readSystemJson", () => {
  it("returns the name, slug and css", () => {
    expect(readSystemJson(JSON_EXPORT)).toEqual({
      name: "Aurora",
      slug: "aurora",
      css: ":root {\n  --color-bg: #0a0a0f;\n}",
    });
  });

  it("falls back to the slug, then to Untitled", () => {
    expect(readSystemJson('{"slug":"ds","css":"--color-bg: #fff;"}').name).toBe("ds");
    expect(readSystemJson('{"css":"--color-bg: #fff;"}').name).toBe("Untitled");
  });

  it("explains a recoverable failure instead of returning an empty system", () => {
    expect(() => readSystemJson("not json")).toThrow(/valid JSON/);
    expect(() => readSystemJson('[{"css":"--a: 1;"}]')).toThrow(/array/);
    expect(() => readSystemJson('{"name":"x"}')).toThrow(/css/);
  });
});

describe("detectPrefixes", () => {
  const prefixed = ["--ds-color-bg: #fff;", "--ds-color-text: #000;", "--ds-space-4: 16px;"].join("\n");

  it("finds a vendor prefix the schema does not use", () => {
    expect(detectPrefixes(prefixed)).toEqual(["ds"]);
  });

  it("finds nothing in a block that is already schema-shaped", () => {
    expect(detectPrefixes("--color-bg: #fff;\n--color-text: #000;")).toEqual([]);
  });

  it("ignores a single occurrence (a one-off name is not a prefix)", () => {
    expect(detectPrefixes("--ds-color-bg: #fff;\n--color-text: #000;")).toEqual([]);
  });
});

describe("stripPrefix", () => {
  it("rewrites names and var() references to them", () => {
    const css = "--ds-color-bg: #fff;\n--color-text: var(--ds-color-bg);";
    expect(stripPrefix(css, "ds")).toBe("--color-bg: #fff;\n--color-text: var(--color-bg);");
  });

  it("accepts the prefix with or without its leading dashes", () => {
    expect(stripPrefix("--ds-color-bg: #fff;", "--ds-")).toBe("--color-bg: #fff;");
  });

  it("is a no-op for an empty prefix", () => {
    expect(stripPrefix("--ds-color-bg: #fff;", "")).toBe("--ds-color-bg: #fff;");
  });
});

describe("near-miss suggestions", () => {
  it("scores an abbreviation of the same idea high", () => {
    expect(nameSimilarity("--color-background", "--color-bg")).toBeGreaterThan(0.75);
  });

  it("scores a different idea low", () => {
    // One of the two segments matches (`color`), which is 0.5 — under the 0.75
    // bar a suggestion needs, so it is reported as an extra, not as a rename.
    expect(nameSimilarity("--color-background", "--color-surface")).toBeLessThan(0.75);
    expect(suggestSchemaName("--color-background")).toBe("--color-bg");
  });

  it("suggests the schema name for a rename", () => {
    expect(suggestSchemaName("--color-background")).toBe("--color-bg");
    expect(suggestSchemaName("--bg")).toBe("--color-bg");
  });

  it("never suggests for a name the schema already has, or for noise", () => {
    expect(suggestSchemaName("--color-bg")).toBeNull();
    expect(suggestSchemaName("--totally-unrelated-noise")).toBeNull();
  });

  it("lists the extras with their suggestions", () => {
    expect(extraSuggestions("--color-bg: #fff;\n--color-background: #eee;")).toEqual([
      { name: "--color-background", suggest: "--color-bg" },
    ]);
  });
});

describe("isSchemaName", () => {
  it("tells a schema name from an extra", () => {
    expect(isSchemaName("--font-size-base")).toBe(true);
    expect(isSchemaName("--color-background")).toBe(false);
  });
});
