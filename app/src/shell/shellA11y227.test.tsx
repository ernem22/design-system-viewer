// @vitest-environment happy-dom
/**
 * RED on the parent for issue #227 (a11y slice of audit #127): shell skip
 * link, search focus ring, toast overflow and safe area, preview live regions.
 *
 * Fails on the parent commit where <main> has no id with no skip link to it,
 * and the async "Loading systems…" notice is not in a live region.
 * Companion assertions pin the rest of the issue's findings (search
 * focus-visible ring, toast safe-area + wrapping, font-note live region).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import Shell from "./Shell.tsx";
import { PreviewNotes } from "../preview/PreviewNotes.tsx";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function mount(node: React.ReactNode): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(node);
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  document.body.innerHTML = "";
});

function shellCss(): string {
  return read("./shell.css").replace(/\/\*[\s\S]*?\*\//g, "");
}

function toastsCss(): string {
  return read("./Toasts.css").replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("issue #227 RED: skip link targets <main>, loading notice is live", () => {
  it("provides a skip link targeting the <main> region", async () => {
    const el = await mount(
      <Shell
        brand={<span>Brand</span>}
        tabs={[{ id: "tokens", label: "Tokens", content: <div>content</div> }]}
        railOpen={true}
        propsOpen={true}
      />,
    );
    const main = el.querySelector("main");
    expect(main, "<main> renders").not.toBeNull();
    const mainId = main!.getAttribute("id");
    expect(mainId, "<main> has an id").toBeTruthy();
    const skip = el.querySelector(`a[href="#${mainId}"]`);
    expect(skip, `skip link targeting #${mainId} renders`).not.toBeNull();
    expect(skip!.textContent, "skip link names its target").toMatch(/skip/i);
  });

  it("announces the async loading notice in a live region", async () => {
    const el = await mount(<PreviewNotes system={null} loading />);
    expect(el.textContent).toContain("Loading systems…");
    const live =
      el.querySelector('[role="status"]') ?? el.querySelector("[aria-live]");
    expect(live, "loading notice is in a live region").not.toBeNull();
    expect(live!.textContent).toContain("Loading systems…");
  });
});

describe("issue #227 companion findings", () => {
  it("gives the topbar search input a visible focus indicator (not outline: 0)", () => {
    const css = shellCss();
    const m = css.match(/\.app-topbar-search\s+input:focus-visible\s*\{([^}]*)\}/);
    expect(m, "search input:focus-visible rule exists").not.toBeNull();
    const body = m![1];
    expect(body, "no outline: 0/none reset").not.toMatch(/outline:\s*(0|none)\b/);
    expect(body, "visible outline").toMatch(/outline:/);
  });

  it("offsets the toast stack for the safe area", () => {
    const css = toastsCss();
    const m = css.match(/\.app-toasts\s*\{([^}]*)\}/);
    expect(m, ".app-toasts rule exists").not.toBeNull();
    expect(m![1], "bottom respects safe-area").toContain(
      "env(safe-area-inset-bottom)",
    );
  });

  it("lets long toast messages wrap instead of overflowing the viewport", () => {
    const css = toastsCss();
    const m = css.match(/\.app-toast\s*\{([^}]*)\}/);
    expect(m, ".app-toast rule exists").not.toBeNull();
    expect(m![1], "no white-space: nowrap").not.toMatch(
      /white-space:\s*nowrap/,
    );
  });

  it("announces the async font-availability note", () => {
    const src = read("../preview/PreviewNotes.tsx");
    // FontNote's async update must render inside a live region so the
    // "Not available in this browser" message is announced.
    expect(src, "font note is a live region").toMatch(
      /role="status"|aria-live/,
    );
  });
});
