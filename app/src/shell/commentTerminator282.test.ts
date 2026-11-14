// Fixer regression for issue #282: shell.css once wrote a literal `*/` inside
// a block comment (`shared --duration-*/--ease-* names`, shell.css:436), which
// closed the comment early. The rest of the comment then leaked into the
// `.app-rail-inner` rule as declarations and the minifier dropped the
// `transition` that followed — invisible to source-text assertions (they still
// saw `transition:` in the rule body), fatal only in the built asset (esbuild
// css-syntax-error, no transition on `.app-rail-inner` at runtime). Reads
// stylesheet text because happy-dom has no cascade — same approach as
// shellContract.test.ts. Fails on ecef459, passes once the comment no longer
// contains a premature terminator.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const raw: string = readFileSync(
  fileURLToPath(new URL("./shell.css", import.meta.url)),
  "utf8",
);

// Strip comments the way a CSS parser pairs them: a comment ends at the first
// `*/`. Any `*/` surviving the strip leaked out of a comment body.
const stripped: string = raw.replace(/\/\*[\s\S]*?\*\//g, "");

describe("issue #282 fixer: no premature comment terminator in shell.css", () => {
  it("leaves no stray */ once comments are stripped", () => {
    expect(stripped, "stray */ leaks from a comment body").not.toContain("*/");
  });
});
