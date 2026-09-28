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

  // Finding 1 (#124 fix): parseTokens strips comments first, so a declaration
  // that only exists inside a comment is not a token. An edit keyed on the raw
  // text rewrites the comment and leaves the name missing in the saved system.
  it("ignores a declaration that only exists inside a comment", () => {
    const css = "/* --color-bg: #fff; */\n--color-text: #000;";
    const next = setTokenValue(css, "--color-bg", "#111");
    expect(next).toContain("/* --color-bg: #fff; */");
    expect(tokenValueMap(next).get("--color-bg")).toBe("#111");
  });

  // Finding 2 (#124 fix): parseTokens is last-write-wins, so the effective
  // declaration is the last one. Editing the first textual match changed a
  // shadowed value and left the live one untouched.
  it("edits the last declaration the parser reads, not an earlier duplicate", () => {
    const css = "--color-bg: #111;\n--color-bg: #fff;";
    expect(tokenValueMap(css).get("--color-bg")).toBe("#fff");
    expect(setTokenValue(css, "--color-bg", "#222")).toBe("--color-bg: #111;\n--color-bg: #222;");
  });

  it("does not touch a similarly prefixed name", () => {
    const css = "--color-bg-alt: #fff;\n--color-bg: #000;";
    expect(setTokenValue(css, "--color-bg", "#111")).toBe("--color-bg-alt: #fff;\n--color-bg: #111;");
  });

  // A minified stylesheet puts several declarations on one line, so a value
  // edit must find the declaration where it sits rather than anchor a whole
  // line and then append an orphan duplicate of the one it failed to match.
  it("edits one declaration on a minified block without duplicating it", () => {
    const css = ":root{--a:1px;--b:2px}";
    const next = setTokenValue(css, "--a", "3px");
    expect(next).toBe(":root{--a:3px;--b:2px}");
    expect(next.match(/--a\b/g)).toHaveLength(1);
    expect(next).toContain("--b:2px");
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

  it("removes one declaration from a minified block and leaves the rest", () => {
    expect(removeTokenValue(":root{--a:1px;--b:2px}", "--a")).toBe(":root{--b:2px}");
    expect(removeTokenValue(":root{--a:1px;--b:2px}", "--b")).toBe(":root{--a:1px;}");
  });

  // Finding 2 (#124 fix): clearing must remove the declaration the parser
  // actually reads (the last duplicate), or the token survives the clear.
  it("removes the declaration the parser reads, not an earlier duplicate", () => {
    const css = "--color-bg: #111;\n--color-text: #000;\n--color-bg: #fff;";
    expect(removeTokenValue(css, "--color-bg")).toBe("--color-bg: #111;\n--color-text: #000;\n");
  });

  it("leaves a commented declaration alone instead of deleting it", () => {
    const css = "/* --color-bg: #fff; */\n--color-text: #000;";
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

  // Finding 2 (#124 fix): the value comes from the parser's last-write read,
  // so the rename has to remove that same declaration — not the first match,
  // which would leave the source behind and move the wrong value.
  it("renames the declaration the parser reads (the last duplicate)", () => {
    const css = "--color-background: #eee;\n--color-bg: #111;\n--color-bg: #fff;";
    expect(tokenValueMap(css).get("--color-bg")).toBe("#fff");
    expect(tokenValueMap(renameToken(css, "--color-background", "--color-bg")).get("--color-bg")).toBe(
      "#eee",
    );
  });
});
