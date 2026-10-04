// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyViewerDark, readViewerDark, VIEWER_DARK_KEY } from "./viewerDark.ts";

// Issue #115: the viewer chrome needs its own dark mode, independent of the
// active system's `themes.dark`. These pin the two observable rules the
// control relies on — the stored value and the root `[data-theme]` attribute.
describe("viewer dark state (#115)", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("defaults to light when nothing is stored", () => {
    expect(readViewerDark()).toBe(false);
  });

  it("persists the choice and reflects it on the root element", () => {
    applyViewerDark(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(VIEWER_DARK_KEY)).toBe("1");
    expect(readViewerDark()).toBe(true);

    applyViewerDark(false);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(VIEWER_DARK_KEY)).toBe("0");
    expect(readViewerDark()).toBe(false);
  });
});
