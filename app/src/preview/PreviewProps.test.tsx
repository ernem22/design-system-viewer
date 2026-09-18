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

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function Harness({
  system,
  push,
  onPatch,
}: {
  system: DesignSystem;
  push: PushToast;
  onPatch: (name: string, value: string) => void;
}) {
  const view = useTokensView(system, push);
  return (
    <>
      <span data-testid="tokens-value">{view.valueMap.get(TOKEN) ?? "missing"}</span>
      <PreviewProps system={system} onPatch={onPatch} />
    </>
  );
}

async function mount(
  system: DesignSystem,
  push: PushToast,
  onPatch: (name: string, value: string) => void,
): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Harness system={system} push={push} onPatch={onPatch} />);
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

  it("does not patch the token store just by rendering", async () => {
    const onPatch = vi.fn();
    await mount(divergent, vi.fn(), onPatch);
    expect(onPatch).not.toHaveBeenCalled();
  });
});
