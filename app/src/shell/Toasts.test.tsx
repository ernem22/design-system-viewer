// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Toasts } from "./Toasts.tsx";
import type { Toast } from "../lib/toasts.ts";

// Raw stylesheet text: the warn tone's class must exist as a rule, not only as
// a className the renderer emits (issue #34 finding 1 — a warn toast rendered
// with the neutral base skin because `.app-toast-warn` had no CSS). vitest runs
// with cwd = app/, so the co-located stylesheet is resolvable from there.
const toastsCss = readFileSync(resolve(process.cwd(), "src/shell/Toasts.css"), "utf8");

// The companion suite lib/toasts.test.ts covers the queue itself. This one
// covers what the queue renders, and doubles as the proof that a *.test.tsx
// file is collected at all -- before vitest.config.ts listed `.tsx` in
// `include`, this file would have been skipped silently and the suite would
// still have reported green.

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function render(toasts: Toast[]): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Toasts toasts={toasts} />);
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

function toast(id: number, msg: string, tone: Toast["tone"]): Toast {
  return { id, msg, tone };
}

describe("Toasts", () => {
  it("renders nothing but the live region when the queue is empty", async () => {
    const el = await render([]);
    const region = el.querySelector(".app-toasts");
    expect(region).not.toBeNull();
    expect(region!.children).toHaveLength(0);
  });

  it("announces politely so a toast is not read as an alert", async () => {
    const region = (await render([])).querySelector(".app-toasts")!;
    expect(region.getAttribute("role")).toBe("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
  });

  it("renders one node per queued toast, in queue order", async () => {
    const el = await render([
      toast(1, "System saved", "ok"),
      toast(2, "Parse failed", "err"),
    ]);
    const items = [...el.querySelectorAll(".app-toast")];
    expect(items.map((n) => n.textContent)).toEqual([
      "System saved",
      "Parse failed",
    ]);
  });

  it("carries the tone into a per-tone class", async () => {
    const el = await render([
      toast(1, "ok msg", "ok"),
      toast(2, "warn msg", "warn"),
      toast(3, "err msg", "err"),
    ]);
    const items = [...el.querySelectorAll(".app-toast")];
    expect(items[0].className).toContain("app-toast-ok");
    expect(items[1].className).toContain("app-toast-warn");
    expect(items[2].className).toContain("app-toast-err");
  });

  it("defines the warn tone's skin with the warning token, like the err skin", () => {
    // A class the renderer emits but the stylesheet never defines is a silent
    // downgrade to the neutral base skin — the exact bug the Reviewer named.
    expect(toastsCss).toMatch(/\.app-toast-warn\s*\{[^}]*--color-warning/);
    expect(toastsCss).toMatch(/\.app-toast-err\s*\{[^}]*--color-danger/);
  });

  it("keeps two same-message toasts as two distinct nodes", async () => {
    // Regression guard for the duplicate-toast class of bug (issue #21): the
    // component must not dedupe by message -- the queue decides what exists.
    const el = await render([
      toast(1, "System deleted", "ok"),
      toast(2, "System deleted", "ok"),
    ]);
    expect(el.querySelectorAll(".app-toast")).toHaveLength(2);
  });
});
