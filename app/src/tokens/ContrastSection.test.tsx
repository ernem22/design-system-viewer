// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { TokensView } from "./TokensView.tsx";
import { useTokensView } from "./useTokensView.ts";
import type { DesignSystem } from "../systems/store.ts";

// Issue #22: the contrast audit was fed the CSS-derived `view.tokens`, so it
// measured the light values even with the dark variant active. These mount the
// real TokensView (the wiring the Reviewer flagged) and read the ratio/badge
// the section reports, so a section that keeps measuring light while claiming
// dark is caught. #999 text on #fff is a genuine AA failure (~2.85), which must
// surface as "Fail" for the mode being shown — not be hidden by a passing light
// measurement. The fixture uses rgb() literals because happy-dom passes custom
// property values through verbatim (a browser normalises hex to rgb itself).

const noop = () => {};

function TokensHarness({ system, dark }: { system: DesignSystem; dark: boolean }) {
  const view = useTokensView(system, noop, dark);
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

async function render(dark: boolean): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<TokensHarness system={system} dark={dark} />);
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

async function reported(dark: boolean): Promise<{ ratio: string; badge: string }> {
  const el = await render(dark);
  return {
    ratio: el.querySelector(".tok-contrast-num")?.textContent ?? "",
    badge: el.querySelector(".tok-contrast-badge")?.textContent ?? "",
  };
}

describe("ContrastSection dark awareness", () => {
  it("reports the dark palette's ratio when the flag is on", async () => {
    const light = await reported(false);
    act(() => root?.unmount());
    root = null;
    host?.remove();
    host = null;
    const dark = await reported(true);

    // Pre-fix TokensView fed the CSS-derived (light) tokens in both modes, so
    // this first assertion fails: both renders report "#000 on #fff" = 21.00.
    expect(dark.ratio).not.toBe(light.ratio);
    expect(light.ratio).toBe("21.00");
    expect(light.badge).toBe("AAA");
    // The dark override is a real AA failure; it must still be reported as one.
    expect(dark.badge).toBe("Fail");
    expect(Number(dark.ratio)).toBeLessThan(Number(light.ratio));
  });
});
