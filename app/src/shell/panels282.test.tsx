// @vitest-environment happy-dom
// Issue #282: on a phone the shell opened with both drawers over the content,
// and the panel toggle animated `width` (a layout every frame). These are the
// RED mirrors: with `(max-width: 900px)` matching and empty storage the clips
// must render `data-open="false"`, and the stylesheet must not transition
// `width` (or any other layout property) on either clip.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The full component gallery is irrelevant here; render the shell with no
// gallery entries (same stub as App.test.tsx).
vi.mock("../gallery/components/index.ts", () => ({ COMPONENT_ENTRIES: [] }));

import { act } from "react";
import type { Root } from "react-dom/client";
import App from "../App.tsx";
import { usePanels } from "../lib/panelStorage.ts";

function stubMatchMedia(matches: boolean): void {
  const mql = {
    matches,
    media: "",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
    onchange: null,
  };
  vi.stubGlobal("matchMedia", vi.fn(() => mql));
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function mountApp(): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<App />);
  });
  return host;
}

function clipOpen(el: Element, selector: string): string | null {
  return el.querySelector(selector)?.getAttribute("data-open") ?? null;
}

function clickLabel(el: Element, label: string): void {
  const button = [...el.querySelectorAll<HTMLElement>('[aria-label]')].find(
    (n) => n.getAttribute("aria-label") === label,
  );
  if (!button) throw new Error(`no control labelled "${label}"`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  vi.unstubAllGlobals();
});

describe("issue #282 RED: narrow drawers start closed", () => {
  it("renders both clips closed with empty storage on a narrow viewport", async () => {
    stubMatchMedia(true);
    const el = await mountApp();
    expect(clipOpen(el, ".app-rail-clip")).toBe("false");
    expect(clipOpen(el, ".app-props-clip")).toBe("false");
  });

  it("renders both clips closed on narrow even when the desktop preference is open", async () => {
    stubMatchMedia(true);
    localStorage.setItem("dsv.app.rail", "open");
    localStorage.setItem("dsv.app.props", "open");
    const el = await mountApp();
    expect(clipOpen(el, ".app-rail-clip")).toBe("false");
    expect(clipOpen(el, ".app-props-clip")).toBe("false");
  });

  it("keeps the desktop default (open) when the viewport is wide", async () => {
    stubMatchMedia(false);
    const el = await mountApp();
    expect(clipOpen(el, ".app-rail-clip")).toBe("true");
    expect(clipOpen(el, ".app-props-clip")).toBe("true");
  });
});

describe("issue #282: narrow drawer behaviour", () => {
  it("opening the rail closes props and toggles nothing in storage", async () => {
    stubMatchMedia(true);
    function Probe() {
      const p = usePanels();
      return (
        <>
          <button type="button" aria-label="t-rail" onClick={p.toggleRail} />
          <button type="button" aria-label="t-props" onClick={p.toggleProps} />
          <button type="button" aria-label="t-reveal" onClick={p.revealProps} />
          <span data-testid="state">{`${p.railOpen}/${p.propsOpen}`}</span>
        </>
      );
    }
    const { createRoot } = await import("react-dom/client");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(<Probe />);
    });
    const state = () => host!.querySelector('[data-testid="state"]')!.textContent;
    const tap = (label: string) => clickLabel(host!, label);

    expect(state()).toBe("false/false");
    tap("t-rail");
    expect(state()).toBe("true/false");
    tap("t-props");
    expect(state()).toBe("false/true");
    tap("t-reveal");
    expect(state()).toBe("false/true");
    // Narrow toggles are ephemeral: neither panel key may appear in storage.
    expect(localStorage.getItem("dsv.app.rail")).toBeNull();
    expect(localStorage.getItem("dsv.app.props")).toBeNull();
    expect(localStorage.getItem("dsv.rail")).toBeNull();
    expect(localStorage.getItem("dsv.props")).toBeNull();
  });

  it("persists desktop toggles to storage when the viewport is wide", async () => {
    stubMatchMedia(false);
    function Probe() {
      const p = usePanels();
      return (
        <>
          <button type="button" aria-label="t-rail" onClick={p.toggleRail} />
          <span data-testid="state">{`${p.railOpen}/${p.propsOpen}`}</span>
        </>
      );
    }
    const { createRoot } = await import("react-dom/client");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(<Probe />);
    });
    expect(host!.querySelector('[data-testid="state"]')!.textContent).toBe("true/true");
    clickLabel(host!, "t-rail");
    expect(host!.querySelector('[data-testid="state"]')!.textContent).toBe("false/true");
    expect(localStorage.getItem("dsv.app.rail")).toBe("closed");
  });

  it("Esc closes an open narrow drawer", async () => {
    stubMatchMedia(true);
    const el = await mountApp();
    clickLabel(el, "Show sidebar");
    expect(clipOpen(el, ".app-rail-clip")).toBe("true");
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(clipOpen(el, ".app-rail-clip")).toBe("false");
  });

  it("a pointer outside the drawers closes an open narrow drawer", async () => {
    stubMatchMedia(true);
    const el = await mountApp();
    clickLabel(el, "Show sidebar");
    expect(clipOpen(el, ".app-rail-clip")).toBe("true");
    await act(async () => {
      el
        .querySelector(".app-main")!
        .dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(clipOpen(el, ".app-rail-clip")).toBe("false");
  });
});

// Stylesheet invariants, read from text like shellContract.test.ts
// (happy-dom has no layout engine). vitest runs with cwd = app/.
const shellCss = readFileSync(resolve(process.cwd(), "src/shell/shell.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function declarationsFor(selector: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(shellCss); m !== null; m = re.exec(shellCss)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.includes(selector)) bodies.push(m[2]);
  }
  return bodies;
}

function reducedMotionCss(): string {
  const blocks: string[] = [];
  const re = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/g;
  for (let m = re.exec(shellCss); m !== null; m = re.exec(shellCss)) {
    const open = shellCss.indexOf("{", m.index);
    if (open === -1) continue;
    let depth = 0;
    for (let i = open; i < shellCss.length; i++) {
      if (shellCss[i] === "{") depth++;
      else if (shellCss[i] === "}") {
        depth--;
        if (depth === 0) {
          blocks.push(shellCss.slice(open + 1, i));
          break;
        }
      }
    }
  }
  return blocks.join("\n");
}

describe("issue #282 RED: no width animation on the panel clips", () => {
  for (const selector of [".app-rail-clip", ".app-props-clip"]) {
    it(`${selector} never transitions a layout property`, () => {
      for (const body of declarationsFor(selector)) {
        expect(body, `${selector} transitions width`).not.toMatch(/transition:[^;]*\bwidth\b/);
        expect(body, `${selector} transitions margin`).not.toMatch(/transition:[^;]*\bmargin\b/);
        expect(body, `${selector} transitions grid columns`).not.toMatch(
          /transition:[^;]*\bgrid-template-columns\b/,
        );
      }
    });
  }

  for (const selector of [".app-rail-inner", ".app-props-inner"]) {
    it(`${selector} slides with transform and fades with opacity from viewer-private tokens`, () => {
      const bodies = declarationsFor(selector).join("\n");
      expect(bodies, "has a transition").toMatch(/transition:/);
      expect(bodies, "slides with transform").toMatch(/transform/);
      expect(bodies, "fades with opacity").toMatch(/opacity/);
      expect(bodies, "duration survives the active system").toMatch(/var\(--app-duration-/);
      expect(bodies, "easing survives the active system").toMatch(/var\(--app-ease-out\)/);
    });
  }

  it("keeps only an opacity fade of at most ~150ms under reduced motion", () => {
    const reduced = reducedMotionCss();
    expect(reduced.length > 0, "reduced-motion block exists").toBe(true);
    expect(reduced, "fades opacity").toMatch(/opacity/);
    expect(reduced, "no sliding under reduced motion").not.toMatch(/translate/);
    expect(reduced, "fade is short (fast token, 100ms)").toMatch(/var\(--app-duration-fast\)/);
  });
});
