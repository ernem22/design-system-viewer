// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import type { DesignSystem } from "../systems/store.ts";
import type { PushToast } from "../lib/toasts.ts";
import { selectScope } from "../lib/tokenOverrides.ts";
import { useTokensView } from "../tokens/useTokensView.ts";
import { PreviewProps } from "./PreviewProps.tsx";

// Issue #37: the Preview inspector and the Tokens tab must report the same
// value for the same token. This harness mounts both against one system whose
// `groups` and `css` disagree (the hand-edited/corrupt localStorage case) and
// reads each panel's rendered value. On the pre-fix commit Preview used
// groups while Tokens parsed css, so the two values differed.

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

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function Harness({
  system,
  push,
  onPatch,
  dark = false,
}: {
  system: DesignSystem;
  push: PushToast;
  onPatch: (name: string, value: string) => void;
  dark?: boolean;
}) {
  const view = useTokensView(system, push, dark);
  return (
    <>
      <span data-testid="tokens-value">{view.valueMap.get(TOKEN) ?? "missing"}</span>
      <PreviewProps system={system} onPatch={onPatch} dark={dark} />
    </>
  );
}

async function mount(
  system: DesignSystem,
  push: PushToast,
  onPatch: (name: string, value: string) => void,
  dark = false,
): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Harness system={system} push={push} onPatch={onPatch} dark={dark} />);
  });
  return host;
}

function tokensValue(el: HTMLDivElement): string {
  return el.querySelector('[data-testid="tokens-value"]')!.textContent ?? "";
}

function previewValue(el: HTMLDivElement): string {
  return el.querySelector(".dsv-token-row-value")!.textContent ?? "";
}

beforeEach(() => {
  selectScope({ id: "demo", title: "Demo", tokens: [TOKEN] });
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  selectScope(null);
});

describe("Preview vs Tokens token values", () => {
  it("agree on the in-effect value when groups and css diverge", async () => {
    const onPatch = vi.fn();
    const el = await mount(divergent, vi.fn(), onPatch);
    expect(tokensValue(el)).toBe("#111111");
    expect(previewValue(el)).toBe("#111111");
    expect(previewValue(el)).toBe(tokensValue(el));
  });

  it("show the authored value when there is no divergence", async () => {
    const el = await mount(consistent, vi.fn(), vi.fn());
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
    const el = await mount(cssOnly, vi.fn(), vi.fn());
    expect(tokensValue(el)).toBe("#333333");
    expect(previewValue(el)).toBe("#333333");
  });

  it("agree on the light value when a dark theme is present but off", async () => {
    const el = await mount(darkThemed, vi.fn(), vi.fn(), false);
    expect(tokensValue(el)).toBe("#111111");
    expect(previewValue(el)).toBe("#111111");
  });

  it("agree on the dark override when dark is on", async () => {
    const el = await mount(darkThemed, vi.fn(), vi.fn(), true);
    expect(tokensValue(el)).toBe("#000000");
    expect(previewValue(el)).toBe("#000000");
  });

  it("does not patch the token store just by rendering", async () => {
    const onPatch = vi.fn();
    await mount(divergent, vi.fn(), onPatch);
    expect(onPatch).not.toHaveBeenCalled();
  });
});
