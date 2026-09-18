// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { loadGoogleFonts, useGoogleFonts, type FontScope } from "./googleFonts.ts";

// Issue #40: font links used to be loaded from the union of the active system
// plus every Compare column. Changing a Compare pick therefore re-diffed the
// <link> set for Tokens/Preview too, and any new css string identity re-ran the
// extraction. These tests pin the two halves of the fix: per-scope ownership
// (only your own links get touched) and a family-set diff (an unchanged set
// touches nothing).

const CSS_INTER = `--font-sans: Inter, sans-serif;`;
const CSS_ROBOTO = `--font-sans: Roboto, sans-serif;`;
const CSS_MERRIWEATHER = `--font-heading: Merriweather, serif;`;

function links(scope?: FontScope): HTMLLinkElement[] {
  const selector = scope
    ? `link[data-dsv-font][data-dsv-font-scope="${scope}"]`
    : `link[data-dsv-font]`;
  return [...document.querySelectorAll<HTMLLinkElement>(selector)];
}

function fams(scope: FontScope): string[] {
  return links(scope).map((l) => l.dataset.fam ?? "");
}

function expectSameNodes(after: HTMLLinkElement[], before: HTMLLinkElement[]): void {
  expect(after).toHaveLength(before.length);
  after.forEach((node, i) => expect(node).toBe(before[i]));
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function Probe({ activeCss, compareCss }: { activeCss: string; compareCss: string }) {
  useGoogleFonts(activeCss, "active");
  useGoogleFonts(compareCss, "compare");
  return null;
}

async function renderProbe(
  activeCss: string,
  compareCss: string,
): Promise<{ rerender: (a: string, c: string) => Promise<void> }> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Probe activeCss={activeCss} compareCss={compareCss} />);
  });
  return {
    rerender: async (a, c) => {
      await act(async () => {
        root!.render(<Probe activeCss={a} compareCss={c} />);
      });
    },
  };
}

// These tests assert on the DOM only. happy-dom would fetch every stylesheet
// link we append (and its failure handler would tear the links back out), so
// hide the `rel` attribute from happy-dom's loader while keeping the element
// fully query-able. Only `getAttribute('rel')` is masked; `href` and
// `data-dsv-font*` stay real.
let restoreCreate: (() => void) | null = null;
beforeEach(() => {
  const real = document.createElement.bind(document);
  const spy = vi.spyOn(document, "createElement").mockImplementation(((
    tag: string,
    options?: ElementCreationOptions,
  ) => {
    const el = real(tag, options);
    if (String(tag).toLowerCase() === "link") {
      const getAttribute = el.getAttribute.bind(el);
      el.getAttribute = (name: string) => (name === "rel" ? null : getAttribute(name));
    }
    return el;
  }) as typeof document.createElement);
  restoreCreate = () => spy.mockRestore();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  for (const l of links()) l.remove();
  restoreCreate?.();
  restoreCreate = null;
});

describe("scoped Google Fonts loading", () => {
  it("keeps the active scope's link nodes untouched when compare changes", async () => {
    const { rerender } = await renderProbe(CSS_INTER, CSS_ROBOTO);
    const activeBefore = links("active");
    expect(fams("active")).toEqual(["Inter"]);
    expect(fams("compare")).toEqual(["Roboto"]);

    // Compare switches a column to a system with a different family.
    await rerender(CSS_INTER, CSS_MERRIWEATHER);

    expectSameNodes(links("active"), activeBefore);
    expect(fams("active")).toEqual(["Inter"]);
    expect(fams("compare")).toEqual(["Merriweather"]);
  });

  it("does not touch links when patchToken changes css identity only", async () => {
    const { rerender } = await renderProbe(CSS_INTER, CSS_ROBOTO);
    const activeBefore = links("active");

    // Same family, brand-new css string (patchToken rewrites the value form).
    await rerender(`--font-sans: Inter, system-ui;\n--color-bg: #000;`, CSS_ROBOTO);

    expectSameNodes(links("active"), activeBefore);
    expect(fams("active")).toEqual(["Inter"]);
  });

  it("scopes removal to the consumer that changed", () => {
    loadGoogleFonts(CSS_ROBOTO, "compare");
    loadGoogleFonts(CSS_INTER, "active");
    const activeBefore = links("active");

    loadGoogleFonts(`--font-sans: DM Sans;`, "compare");

    expectSameNodes(links("active"), activeBefore);
    expect(fams("compare")).toEqual(["DM Sans"]);
  });

  it("loads each scope's families into its own links", () => {
    loadGoogleFonts(CSS_INTER, "active");
    loadGoogleFonts(CSS_ROBOTO, "compare");

    expect(fams("active")).toEqual(["Inter"]);
    expect(fams("compare")).toEqual(["Roboto"]);
    expect(links("active")[0].getAttribute("data-dsv-font-scope")).toBe("active");
    expect(links("compare")[0].getAttribute("data-dsv-font-scope")).toBe("compare");
  });

  it("emits zero active-scope <link> mutations across repeated compare changes", async () => {
    const { rerender } = await renderProbe(CSS_INTER, CSS_ROBOTO);

    // Capture the pre-existing active consumer's <link> by node identity (and
    // href) BEFORE any interaction. Deliberately not via data-dsv-font-scope:
    // that attribute only exists after the fix, so classifying by it would
    // bucket every mutation as "compare" and let this test pass vacuously.
    const activeNodes = new Set(
      [...document.querySelectorAll<HTMLLinkElement>("link[data-dsv-font]")].filter((l) => {
        const href = l.getAttribute("href");
        return l.dataset.fam === "Inter" && href !== null && href.includes("family=Inter");
      }),
    );
    expect(activeNodes.size).toBeGreaterThan(0);

    const activeMutations: string[] = [];
    const compareMutations: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of [...record.addedNodes, ...record.removedNodes]) {
          if (!(node instanceof HTMLLinkElement)) continue;
          // Bucket by captured identity, not by an attribute the fix writes.
          const bucket = activeNodes.has(node) ? activeMutations : compareMutations;
          bucket.push(`${record.type}:${node.dataset.fam ?? ""}`);
        }
      }
    });
    observer.observe(document.head, { childList: true });

    const picks = [CSS_MERRIWEATHER, `--font-sans: Fira Sans;`, `--font-sans: IBM Plex Sans;`];
    for (const css of picks) await rerender(CSS_INTER, css);
    // measurement evidence for PR #40
    console.log(
      `[#40] compare picks=${picks.length} active-link-mutations=${activeMutations.length} compare-link-mutations=${compareMutations.length}`,
    );
    expect(activeMutations).toEqual([]);
    expect(compareMutations.length).toBeGreaterThan(0);
    observer.disconnect();
  });
});
