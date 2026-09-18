// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import type { DesignSystem } from "../systems/store.ts";
import type { PushToast } from "../lib/toasts.ts";
import {
  clearAll,
  clearValueEdit,
  countOverrides,
  getInspectorState,
  getValueEdit,
  selectScope,
  setSwap,
  setValueEdit,
} from "../lib/tokenOverrides.ts";
import { useTokensView } from "../tokens/useTokensView.ts";
import { useSectionScopeStyle } from "../gallery/tokenInspector.tsx";
import { PreviewProps } from "./PreviewProps.tsx";

// Issue #37: the Preview inspector and the Tokens tab must report the same
// value for the same token. This harness mounts both against one system whose
// `groups` and `css` disagree (the hand-edited/corrupt localStorage case) and
// reads each panel's rendered value. On the pre-fix commit Preview used
// groups while Tokens parsed css, so the two values differed.
//
// Issue #27 rides on the same harness for the edit flow: driving the real
// "Edit value" editor must land in the ephemeral override layer (rendering
// through PreviewProps), NOT in onPatch (the stored system), and Reset must
// drop it. On the pre-fix commit the editor called onPatch, so these failed.

const TOKEN = "--color-accent";

const divergent = {
  slug: "divergent",
  name: "Divergent",
  css: `:root { ${TOKEN}: #222222; }`,
  groups: [
    {
      id: "color-accent",
      label: "Accent / Brand",
      kind: "color",
      tokens: [{ name: TOKEN, value: "#111111" }],
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as DesignSystem;

const consistent = {
  ...divergent,
  css: `:root { ${TOKEN}: #4f46e5; }`,
  groups: [
    {
      id: "color-accent",
      label: "Accent / Brand",
      kind: "color",
      tokens: [{ name: TOKEN, value: "#4f46e5" }],
    },
  ],
} as unknown as DesignSystem;

const darkThemed = {
  ...divergent,
  css: `:root { ${TOKEN}: #222222; }`,
  groups: [
    {
      id: "color-accent",
      label: "Accent / Brand",
      kind: "color",
      tokens: [{ name: TOKEN, value: "#111111" }],
    },
  ],
  themes: { dark: [{ name: TOKEN, value: "#000000" }] },
} as unknown as DesignSystem;

// Two same-kind tokens so a swap (--color-accent -> --color-danger) has a real
// source to resolve, with a distinct authored value to tell the layers apart.
const swapPair = {
  slug: "swap-pair",
  name: "Swap pair",
  css: `:root { ${TOKEN}: #111111; --color-danger: #222222; }`,
  groups: [
    {
      id: "color-accent",
      label: "Accent / Brand",
      kind: "color",
      tokens: [{ name: TOKEN, value: "#111111" }],
    },
    {
      id: "color-danger",
      label: "Danger",
      kind: "color",
      tokens: [{ name: "--color-danger", value: "#222222" }],
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as DesignSystem;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function Harness({
  system,
  push,
  dark = false,
}: {
  system: DesignSystem;
  push: PushToast;
  dark?: boolean;
}) {
  const view = useTokensView(system, push, dark);
  // The real hook the gallery section uses to write a scope's swaps onto its
  // own node — the inline custom properties the tester reads on the page.
  const scopeStyle = useSectionScopeStyle("demo");
  return (
    <>
      <span data-testid="tokens-value">{view.valueMap.get(TOKEN) ?? "missing"}</span>
      <span data-testid="scope-style">{JSON.stringify(scopeStyle ?? null)}</span>
      <PreviewProps system={system} dark={dark} />
    </>
  );
}

async function mount(
  system: DesignSystem,
  push: PushToast,
  dark = false,
): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Harness system={system} push={push} dark={dark} />);
  });
  return host;
}

function tokensValue(el: HTMLDivElement): string {
  return el.querySelector('[data-testid="tokens-value"]')!.textContent ?? "";
}

function previewValue(el: HTMLDivElement): string {
  return el.querySelector(".dsv-token-row-value")!.textContent ?? "";
}

/** The inline swap style `useSectionScopeStyle("demo")` produced. */
function scopeStyle(el: HTMLDivElement): Record<string, string> | null {
  return JSON.parse(el.querySelector('[data-testid="scope-style"]')!.textContent ?? "null");
}

beforeEach(() => {
  selectScope({ id: "demo", title: "Demo", tokens: [TOKEN] });
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  // Overrides are module-level (survive a root unmount), so drop them between
  // tests or one test's what-if edit leaks into the next.
  act(() => clearAll());
  selectScope(null);
});

describe("Preview vs Tokens token values", () => {
  it("agree on the in-effect value when groups and css diverge", async () => {
    const el = await mount(divergent, vi.fn());
    expect(tokensValue(el)).toBe("#111111");
    expect(previewValue(el)).toBe("#111111");
    expect(previewValue(el)).toBe(tokensValue(el));
  });

  it("show the authored value when there is no divergence", async () => {
    const el = await mount(consistent, vi.fn());
    expect(tokensValue(el)).toBe("#4f46e5");
    expect(previewValue(el)).toBe("#4f46e5");
  });

  it("agree on a token authored only in css when groups exist", async () => {
    const cssOnly = {
      slug: "css-only",
      name: "Css only",
      css: `:root { ${TOKEN}: #333333; }`,
      groups: [
        {
          id: "color-bg",
          label: "Background",
          kind: "color",
          tokens: [{ name: "--color-bg", value: "#ffffff" }],
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as unknown as DesignSystem;
    const el = await mount(cssOnly, vi.fn());
    expect(tokensValue(el)).toBe("#333333");
    expect(previewValue(el)).toBe("#333333");
  });

  it("agree on the light value when a dark theme is present but off", async () => {
    const el = await mount(darkThemed, vi.fn(), false);
    expect(tokensValue(el)).toBe("#111111");
    expect(previewValue(el)).toBe("#111111");
  });

  it("agree on the dark override when dark is on", async () => {
    const el = await mount(darkThemed, vi.fn(), true);
    expect(tokensValue(el)).toBe("#000000");
    expect(previewValue(el)).toBe("#000000");
  });
});

// Issue #27 — the Preview "what-if" edit is ephemeral, not a store write.
// Drives the real editor (open "Edit value", type, blur) and asserts the
// rendered row and the override store, never the authored system.
describe("Preview value edits are ephemeral (#27)", () => {
  async function clickEdit(el: HTMLDivElement): Promise<void> {
    const btn = [...el.querySelectorAll<HTMLButtonElement>(".dsv-token-row-actions button")].find(
      (b) => b.textContent === "Edit value",
    )!;
    await act(async () => {
      btn.click();
    });
  }

  async function typeAndBlur(el: HTMLDivElement, value: string): Promise<void> {
    const input = el.querySelector<HTMLInputElement>(".dsv-token-value-input")!;
    await act(async () => {
      // React tracks the last value on the node; set through the native setter
      // so the change event isn't swallowed as a no-op.
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      // React maps onBlur onto the bubble-phase focusout event; dispatch that
      // (happy-dom's .blur() doesn't reliably reach React's listener).
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
  }

  it("lands the edit in the override layer and never mutates the system", async () => {
    const el = await mount(divergent, vi.fn());
    const before = JSON.stringify(divergent);
    await clickEdit(el);
    await typeAndBlur(el, "#00ff00");

    expect(getValueEdit(TOKEN)).toBe("#00ff00");
    expect(previewValue(el)).toBe("#00ff00");
    // The authored system object is untouched — Preview never writes it.
    expect(JSON.stringify(divergent)).toBe(before);
    // The Tokens panel (authored source of truth) still reads the stored value,
    // proving the edit did not land there.
    expect(tokensValue(el)).toBe("#111111");
  });

  it("reverts the edited value when Reset (clearAll) runs", async () => {
    const el = await mount(divergent, vi.fn());
    await clickEdit(el);
    await typeAndBlur(el, "#00ff00");
    expect(previewValue(el)).toBe("#00ff00");

    act(() => clearAll());
    // Back to the authored/system value. On the parent commit's code this
    // stayed #00ff00 because the edit had been written into the store.
    expect(getValueEdit(TOKEN)).toBeUndefined();
    expect(previewValue(el)).toBe("#111111");
  });

  it("keeps the edit across a system switch and brings it back (override keyed by token)", async () => {
    setValueEdit(TOKEN, "#00ff00");
    // A different system that defines the token sees the override applied.
    const elA = await mount(consistent, vi.fn());
    expect(previewValue(elA)).toBe("#00ff00");
    act(() => root?.unmount());
    root = null;
    host?.remove();
    // System that doesn't author the token: the override still applies to the
    // row (it wins over the empty authored value) and is retained in the store.
    const noToken = {
      slug: "empty",
      name: "Empty",
      css: "",
      groups: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as unknown as DesignSystem;
    const elB = await mount(noToken, vi.fn());
    expect(getValueEdit(TOKEN)).toBe("#00ff00");
    expect(previewValue(elB)).toBe("#00ff00");
    act(() => root?.unmount());
    root = null;
    host?.remove();
    // Switch back: override still applies, untouched.
    const elA2 = await mount(consistent, vi.fn());
    expect(previewValue(elA2)).toBe("#00ff00");
  });

  it("counts value edits and swaps together in the Reset pill count", () => {
    setValueEdit(TOKEN, "#00ff00");
    setSwap("demo", "--a", "--b");
    // 1 edit + 1 swap. On the parent commit the counter read swaps only, so
    // this reported 1 — the exact dishonest count #27 complains about.
    expect(countOverrides(getInspectorState())).toBe(2);
  });
});

// Fixer finding #1 (end-to-end): with a value edit on a token that the same
// scope also swaps away, the scope node must read the edited literal, not the
// swap redirect. On the pre-fix head it stayed `var(--color-danger)`, so the
// whole subtree resolved to the swapped-to token (the tester's #b64f42).
describe("Preview value edits beat swaps on the same token (#92 fixer)", () => {
  it("writes the edited literal on the scope node when the target is swapped", async () => {
    const el = await mount(swapPair, vi.fn());
    act(() => {
      setSwap("demo", TOKEN, "--color-danger");
    });
    expect(scopeStyle(el)).toEqual({ [TOKEN]: "var(--color-danger)" });

    act(() => setValueEdit(TOKEN, "#ff00aa"));
    // valueEdit > swap: #ff00aa, not the swapped-to #222222.
    expect(scopeStyle(el)).toEqual({ [TOKEN]: "#ff00aa" });
  });

  it("restores the swap redirect once the value edit is cleared", async () => {
    const el = await mount(swapPair, vi.fn());
    act(() => {
      setSwap("demo", TOKEN, "--color-danger");
      setValueEdit(TOKEN, "#ff00aa");
    });
    act(() => clearValueEdit(TOKEN));
    expect(scopeStyle(el)).toEqual({ [TOKEN]: "var(--color-danger)" });
  });
});

// Fixer finding #2: legacy applied a value edit at the document level (a
// `:root` style tag), so a what-if repainted the whole page. This port only
// resolved the inspector row. The store now mirrors its edits into
// `document.head` on every change and Reset removes the tag.
describe("value edits repaint the document (#27 legacy parity)", () => {
  const STYLE_ID = "dsv-token-value-overrides";

  it("writes a :root override style tag on edit and removes it on Reset", async () => {
    await mount(swapPair, vi.fn());
    expect(document.getElementById(STYLE_ID)).toBeNull();

    act(() => setValueEdit(TOKEN, "#ff00aa"));
    const tag = document.getElementById(STYLE_ID);
    // On the pre-fix head no tag is ever injected — the assertion below fails.
    expect(tag).not.toBeNull();
    expect(tag!.textContent).toContain(`${TOKEN}:#ff00aa`);
    expect(tag!.textContent).toContain(":root{");

    act(() => clearAll());
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });

  it("keeps the tag while any edit remains and drops it only when empty", async () => {
    await mount(swapPair, vi.fn());
    act(() => {
      setValueEdit(TOKEN, "#ff00aa");
      setValueEdit("--color-danger", "#00ffaa");
    });
    expect(document.getElementById(STYLE_ID)!.textContent).toContain("--color-danger:#00ffaa");

    act(() => clearValueEdit(TOKEN));
    expect(document.getElementById(STYLE_ID)).not.toBeNull();
    expect(document.getElementById(STYLE_ID)!.textContent).not.toContain(`${TOKEN}:`);

    act(() => clearValueEdit("--color-danger"));
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });
});
