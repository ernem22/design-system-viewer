// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Toasts } from "./Toasts.tsx";
import type { Toast, ToastQueue } from "../lib/toasts.ts";

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

const noopQueue: ToastQueue = {
  pause: () => {},
  resume: () => {},
  dismiss: () => {},
};

async function render(toasts: Toast[], queue: ToastQueue = noopQueue): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Toasts toasts={toasts} queue={queue} />);
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

  it("scopes the live region to each toast instead of the whole stack", async () => {
    const el = await render([
      toast(1, "System saved", "ok"),
      toast(2, "Parse failed", "err"),
    ]);
    const stack = el.querySelector(".app-toasts")!;
    // A single stack-level polite region re-read every visible toast whenever
    // a new one arrived; each toast now owns its semantics.
    expect(stack.getAttribute("role")).toBeNull();
    expect(stack.getAttribute("aria-live")).toBeNull();

    const [ok, err] = [...el.querySelectorAll(".app-toast")];
    expect(ok.getAttribute("role")).toBe("status");
    expect(ok.getAttribute("aria-live")).toBe("polite");
    expect(err.getAttribute("role")).toBe("alert");
    expect(err.getAttribute("aria-live")).toBe("assertive");
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

  it("uses the AA text tokens on the warn and err skins", () => {
    // A class the renderer emits but the stylesheet never defines is a silent
    // downgrade to the neutral base skin — the exact bug the Reviewer named.
    // The base warning/danger hues fail 4.5:1 on the overlay surface, so the
    // text uses the -text ramp while the border keeps the tone hue.
    expect(toastsCss).toMatch(/\.app-toast-warn\s*\{[^}]*--color-warning-text/);
    expect(toastsCss).toMatch(/\.app-toast-err\s*\{[^}]*--color-danger-text/);
  });

  it("gives a persistent error toast an explicit dismiss control", async () => {
    let dismissed = -1;
    const el = await render([toast(7, "Parse failed", "err")], {
      pause: () => {},
      resume: () => {},
      dismiss: (id) => {
        dismissed = id;
      },
    });
    const close = el.querySelector<HTMLButtonElement>(".app-toast-close");
    expect(close, "error toast has a close button").not.toBeNull();
    expect(close!.getAttribute("aria-label")).toBe("Dismiss");
    await act(async () => {
      close!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(dismissed).toBe(7);
  });

  it("does not put a close control on the short-lived tones", async () => {
    const el = await render([
      toast(1, "Saved", "ok"),
      toast(2, "Check URL", "warn"),
    ]);
    expect(el.querySelector(".app-toast-close")).toBeNull();
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

  it("exits on the same node: a removed toast keeps its DOM node with data-leaving", async () => {
    // Reviewer finding on #284: the exit fade was a visual no-op — the live
    // node unmounted in one frame and a freshly mounted ghost (already at
    // opacity 0, mounted by an effect a frame late) never transitioned. The
    // leaving toast must be the SAME node, so opacity 1->0 actually runs.
    // Fails on bc125fa, where the ghost is a different node.
    const { createRoot } = await import("react-dom/client");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(<Toasts toasts={[toast(1, "Link copied", "ok")]} queue={noopQueue} />);
    });
    const before = host.querySelector(".app-toast");
    expect(before).not.toBeNull();
    expect(before!.getAttribute("data-leaving")).toBeNull();
    await act(async () => {
      root!.render(<Toasts toasts={[]} queue={noopQueue} />);
    });
    const leaving = host.querySelector(".app-toast");
    expect(leaving, "leaving toast stays mounted for the exit fade").not.toBeNull();
    expect(leaving, "exit animates the same node (opacity 1->0 transitions)").toBe(
      before,
    );
    expect(leaving!.getAttribute("data-leaving")).toBe("true");
    // The fade completes inside the 150ms exit budget, then the node unmounts.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    expect(host.querySelectorAll(".app-toast")).toHaveLength(0);
  });
});
