// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Brand from "./Brand.tsx";
import HelpDialog from "./HelpDialog.tsx";

// Issue #89: the legacy viewer's "How to use" button and its #kbdDlg guide
// (index.html:705, 731-779; app.js:1096) were dropped in the React port. This
// suite proves the guide is back, keyboard-reachable, carries the canonical
// schema-name rule, and closes on Escape. It renders through Brand — the one
// always-mounted topbar cluster — because the topbar action cluster (App.tsx)
// and dialog host (Shell.tsx) are held by other open PRs; on the parent commit
// Brand has no help trigger, so every case here is RED there.

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function renderBrand(): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Brand />);
  });
  return host;
}

function helpTrigger(el: HTMLDivElement): HTMLButtonElement {
  return el.querySelector<HTMLButtonElement>(".app-help-trigger")!;
}

async function openHelp(el: HTMLDivElement): Promise<void> {
  await act(async () => helpTrigger(el).click());
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  localStorage.clear();
});

describe("Help dialog (legacy kbdDlg parity)", () => {
  it("restores the 'How to use' topbar affordance the port dropped", async () => {
    const el = await renderBrand();
    const trigger = el.querySelector<HTMLButtonElement>(".app-help-trigger");
    expect(trigger).not.toBeNull();
    expect(trigger!.getAttribute("aria-label")).toBe("How to use");
  });

  it("opens from the trigger and states the canonical schema-name rule", async () => {
    const el = await renderBrand();
    await openHelp(el);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.textContent).toContain("Preview only reads the canonical schema names");
  });

  it("closes on Escape", async () => {
    const el = await renderBrand();
    await openHelp(el);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("closes from the 'Got it' action", async () => {
    const el = await renderBrand();
    await openHelp(el);
    const done = document.querySelector<HTMLButtonElement>(".app-help-done")!;
    await act(async () => done.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

// Issue #316: the dialog described an older app ("Fill template", "15
// screens", "systems/*.json on disk", Update-in-toolbar) and hid its only
// button below the fold (the whole dialog scrolled, button included). The
// text now matches the app at the merge base and the footer sits outside the
// scrolling body. Every case here is RED on the parent commit.
async function renderOpenHelp(): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<HelpDialog defaultOpen />);
  });
}

function openDialog(): HTMLElement {
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  expect(dialog, "Help dialog renders open").not.toBeNull();
  return dialog!;
}

// happy-dom has no layout engine, so the footer-visibility invariant is read
// from the stylesheet text (like shellContract.test.ts): the dialog frame
// must not scroll itself while the body does.
const helpCss = readFileSync(
  resolve(process.cwd(), "src/shell/HelpDialog.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

function declarationsFor(selector: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(helpCss); m !== null; m = re.exec(helpCss)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.includes(selector)) bodies.push(m[2]);
  }
  return bodies;
}

describe("Help dialog content and layout (issue #316)", () => {
  it("names the current add-system affordance, not the old Fill template", async () => {
    await renderOpenHelp();
    const text = openDialog().textContent ?? "";
    expect(text).not.toContain("Fill template");
    expect(text).toContain("Fill with schema");
  });

  it("states data location and screen counts truthfully", async () => {
    await renderOpenHelp();
    const text = openDialog().textContent ?? "";
    expect(text).not.toContain("systems/*.json on disk");
    expect(text).not.toContain("15 screens");
  });

  it("keeps the 'Got it' button outside the element that scrolls", async () => {
    await renderOpenHelp();
    const dialog = openDialog();
    const body = dialog.querySelector(".app-help-body");
    expect(body, "dialog has a scrolling body region").not.toBeNull();
    const done = dialog.querySelector(".app-help-done");
    expect(done, "'Got it' button renders").not.toBeNull();
    expect(body!.contains(done), "'Got it' sits outside the scrolling body").toBe(
      false,
    );
  });

  it("scrolls the body, not the dialog frame", () => {
    const frame = declarationsFor(".app-help-dialog").join("\n");
    expect(frame).toMatch(/display:\s*flex/);
    expect(frame).toMatch(/flex-direction:\s*column/);
    expect(frame).not.toMatch(/overflow-y:\s*auto/);
    expect(frame).not.toMatch(/overflow:\s*auto/);
    const body = declarationsFor(".app-help-body").join("\n");
    expect(body).toMatch(/overflow-y:\s*auto/);
  });
});
