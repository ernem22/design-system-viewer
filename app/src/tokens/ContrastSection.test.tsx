// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { TokensView } from "./TokensView.tsx";
import { useTokensView } from "./useTokensView.ts";
import type { DesignSystem } from "../systems/store.ts";

// Issue #277: dark mode is retired — the contrast audit measures the base
// (light) values even when the system stores a `themes.dark` block. The
// fixture keeps a dark override to prove it is ignored: the section reports
// the light ratio (black on white = 21.00, AAA).

const noop = () => {};

function TokensHarness({ system }: { system: DesignSystem }) {
  const view = useTokensView(system, noop);
  return (
    <TokensView system={system} view={view} onDelete={noop} onMerge={noop} onPatch={noop} />
  );
}

const system: DesignSystem = {
  slug: "contrast-fixture",
  name: "Contrast fixture",
  css: ":root { --color-text: rgb(0, 0, 0); --color-bg: rgb(255, 255, 255); }",
  groups: [],
  themes: { dark: [{ name: "--color-text", value: "rgb(153, 153, 153)" }] },
  createdAt: "",
  updatedAt: "",
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function render(): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<TokensHarness system={system} />);
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

describe("ContrastSection base values (#277)", () => {
  it("reports the light palette even when a dark theme is stored", async () => {
    const el = await render();
    expect(el.querySelector(".tok-contrast-num")?.textContent).toBe("21.00");
    expect(el.querySelector(".tok-contrast-badge")?.textContent).toBe("AAA");
  });
});
