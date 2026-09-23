import { describe, expect, it } from "vitest";
import { removeTokenValue, renameToken, setTokenValue, tokenValueMap } from "./tokenCss.ts";

// Issue #124: the grouped fill surface edits one declaration at a time, so the
// text edits have to be surgical — an edit must not reformat the rest of the
// block, and an empty value must remove the line rather than write `--x: ;`
// (which the parser ignores anyway, but which would then sit in the export).

describe("tokenValueMap", () => {
  it("maps every readable declaration", () => {
    expect([...tokenValueMap("--color-bg: #fff;\n--space-4: 16px;")]).toEqual([
      ["--color-bg", "#fff"],
      ["--space-4", "16px"],
    ]);
  });
});

describe("setTokenValue", () => {
  it("appends a declaration that is not there yet", () => {
    expect(setTokenValue("--color-bg: #fff;", "--color-text", "#000")).toBe(
      "--color-bg: #fff;\n--color-text: #000;\n",
    );
  });

  it("writes into an empty block", () => {
    expect(setTokenValue("", "--color-bg", "#fff")).toBe("--color-bg: #fff;\n");
  });

  it("replaces in place, keeping the file's own indentation", () => {
    const css = ":root {\n  --color-bg: #fff;\n  --color-text: #000;\n}";
    expect(setTokenValue(css, "--color-bg", "#111")).toBe(
      ":root {\n  --color-bg: #111;\n  --color-text: #000;\n}",
    );
  });

  it("fills an empty template line rather than adding a second one", () => {
    const css = "--color-bg: ;\n--color-text: #000;";
    const next = setTokenValue(css, "--color-bg", "#fff");
    expect(next).toBe("--color-bg: #fff;\n--color-text: #000;");
    expect(next.match(/--color-bg/g)).toHaveLength(1);
  });

  it("does not touch a similarly prefixed name", () => {
    const css = "--color-bg-alt: #fff;\n--color-bg: #000;";
    expect(setTokenValue(css, "--color-bg", "#111")).toBe("--color-bg-alt: #fff;\n--color-bg: #111;");
  });

  it("removes the declaration when the value is cleared", () => {
    expect(setTokenValue("--color-bg: #fff;\n--color-text: #000;", "--color-bg", "  ")).toBe(
      "--color-text: #000;",
    );
  });
});

describe("removeTokenValue", () => {
  it("removes the line and its newline, leaving the rest alone", () => {
    expect(removeTokenValue("--color-bg: #fff;\n--color-text: #000;\n", "--color-bg")).toBe(
      "--color-text: #000;\n",
    );
  });

  it("is a no-op when the name is not there", () => {
    const css = "--color-text: #000;";
    expect(removeTokenValue(css, "--color-bg")).toBe(css);
  });
});

describe("renameToken", () => {
  it("moves the value onto the schema name", () => {
    expect(renameToken("--color-background: #eee;\n--color-bg: #fff;", "--color-background", "--color-bg")).toBe(
      "--color-bg: #eee;",
    );
  });

  it("is a no-op for a name that is not there", () => {
    const css = "--color-bg: #fff;";
    expect(renameToken(css, "--color-background", "--color-bg")).toBe(css);
  });
});
