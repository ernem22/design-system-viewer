// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  VIEWER_THEME_KEY,
  applyViewerTheme,
  defaultViewerTheme,
  readViewerTheme,
} from "./viewerTheme.ts";

// Issue #111: the viewer's own theme (legacy `dsv.theme`, `[data-theme]` on
// <html>) — persisted, with `prefers-color-scheme` as the first-load default.
// Separate from the topbar Dark switch, which toggles the system's variant.

function stubPrefersLight(light: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: light && query.includes("prefers-color-scheme: light"),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("viewer theme (#111)", () => {
  it("defaults to light when the OS prefers light", () => {
    stubPrefersLight(true);
    expect(defaultViewerTheme()).toBe("light");
    expect(readViewerTheme()).toBe("light");
  });

  it("defaults to dark when the OS does not prefer light", () => {
    stubPrefersLight(false);
    expect(defaultViewerTheme()).toBe("dark");
    expect(readViewerTheme()).toBe("dark");
  });

  it("prefers a stored theme over the OS default", () => {
    stubPrefersLight(false);
    localStorage.setItem(VIEWER_THEME_KEY, "light");
    expect(readViewerTheme()).toBe("light");
  });

  it("ignores an invalid stored value and falls back to the OS default", () => {
    stubPrefersLight(true);
    localStorage.setItem(VIEWER_THEME_KEY, "sepia");
    expect(readViewerTheme()).toBe("light");
  });

  it("applyViewerTheme sets [data-theme] and persists the choice", () => {
    applyViewerTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(VIEWER_THEME_KEY)).toBe("dark");
  });
});
