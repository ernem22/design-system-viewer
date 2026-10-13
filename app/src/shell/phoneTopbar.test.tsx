// @vitest-environment happy-dom
// Issue #327: at ≤480px the wordmark ("Design Syst…") squeezed the system
// switcher to "pe…", hiding which of the 38 systems is active. The fix hides
// the wordmark text (mark stays, with an accessible name) and lets the
// switcher take the remaining row width. happy-dom has no layout engine, so
// like shellContract.test.ts the CSS invariants are read from the stylesheet
// text, scoped to the 480px block; the running-app geometry (switcher shows
// the full "perp ultra v2") was measured by hand in the issue.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const shellCss = readFileSync(
  resolve(process.cwd(), "src/shell/shell.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

// The block shell.css owns for the phone two-row topbar (issue #282).
function phoneBlock(): string {
  const at = shellCss.indexOf("@media (max-width: 480px)");
  expect(at, "480px media block exists").toBeGreaterThanOrEqual(0);
  const open = shellCss.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < shellCss.length; i++) {
    if (shellCss[i] === "{") depth++;
    if (shellCss[i] === "}") {
      depth--;
      if (depth === 0) return shellCss.slice(open + 1, i);
    }
  }
  throw new Error("unterminated 480px media block");
}

function declarationsFor(block: string, selector: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(block); m !== null; m = re.exec(block)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.includes(selector)) bodies.push(m[2]);
  }
  return bodies;
}

describe("phone topbar keeps the system name readable (issue #327)", () => {
  it("hides the wordmark text inside the 480px block, keeping only the mark", () => {
    const bodies = declarationsFor(phoneBlock(), ".app-brand-name");
    expect(bodies.length, ".app-brand-name re-declared in 480px block").toBeGreaterThan(0);
    const hidden = bodies.some(
      (b) =>
        /display:\s*none\b/.test(b) ||
        (/position:\s*absolute\b/.test(b) && /clip-path:\s*inset/.test(b)),
    );
    expect(hidden, ".app-brand-name must be hidden visually in the 480px block").toBe(true);
  });

  it("lets the switcher take the remaining row width with no 120px cap", () => {
    const bodies = declarationsFor(phoneBlock(), ".app-sysbtn");
    expect(bodies.length, ".app-sysbtn re-declared in 480px block").toBeGreaterThan(0);
    const joined = bodies.join("\n");
    expect(joined, ".app-sysbtn must not keep the 120px cap").not.toMatch(/120px/);
    expect(joined).toMatch(/flex:\s*1\s+1\s+auto/);
    expect(joined).toMatch(/min-width:\s*0/);
  });

  it("keeps the brand mark visible with an accessible name", async () => {
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { default: Brand } = await import("./Brand.tsx");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<Brand />);
    });
    try {
      const brand = host.querySelector<HTMLElement>(".app-brand");
      expect(brand, ".app-brand renders").not.toBeNull();
      expect(brand!.querySelector(".app-brand-mark"), "mark stays visible").not.toBeNull();
      expect(
        brand!.getAttribute("aria-label"),
        '.app-brand keeps an accessible name while the wordmark hides',
      ).toBe("Design System Viewer");
    } finally {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    }
  });
});
