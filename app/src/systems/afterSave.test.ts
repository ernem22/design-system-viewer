// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AFTER_SAVE_DEFAULT,
  AFTER_SAVE_KEY,
  LEGACY_AFTER_SAVE_KEY,
  readAfterSave,
  writeAfterSave,
} from "./afterSave.ts";

// Issue #32: the pre-migration app stored the Add-dialog "Open in" choice as
// `dsv.afterSave` with values `system|preview|compare`; the React app reads
// `dsv.app.afterSave` with `tokens|preview|compare`. Reading the legacy key
// once (and translating `system` -> `tokens`) is what makes the user-visible
// preference survive.

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("readAfterSave", () => {
  it("migrates the legacy key and `system` value onto the canonical spelling", () => {
    localStorage.setItem(LEGACY_AFTER_SAVE_KEY, "system");

    expect(readAfterSave()).toBe("tokens");
    expect(localStorage.getItem(AFTER_SAVE_KEY)).toBe("tokens");
    expect(localStorage.getItem(LEGACY_AFTER_SAVE_KEY)).toBeNull();
  });

  it("honors legacy preview/compare values without touching their spelling", () => {
    localStorage.setItem(LEGACY_AFTER_SAVE_KEY, "compare");
    expect(readAfterSave()).toBe("compare");
    expect(localStorage.getItem(AFTER_SAVE_KEY)).toBe("compare");

    localStorage.clear();
    localStorage.setItem(LEGACY_AFTER_SAVE_KEY, "preview");
    expect(readAfterSave()).toBe("preview");
    expect(localStorage.getItem(AFTER_SAVE_KEY)).toBe("preview");
  });

  it("canonicalizes a legacy value already sitting under the canonical key", () => {
    localStorage.setItem(AFTER_SAVE_KEY, "system");
    expect(readAfterSave()).toBe("tokens");
    expect(localStorage.getItem(AFTER_SAVE_KEY)).toBe("tokens");
  });

  it("falls back to the default for an unknown canonical value", () => {
    localStorage.setItem(AFTER_SAVE_KEY, "bogus");
    expect(readAfterSave()).toBe(AFTER_SAVE_DEFAULT);
  });

  it("falls back to the default for an unknown legacy value", () => {
    localStorage.setItem(LEGACY_AFTER_SAVE_KEY, "bogus");
    expect(readAfterSave()).toBe(AFTER_SAVE_DEFAULT);
  });

  it("falls back to the default when nothing is stored", () => {
    expect(readAfterSave()).toBe(AFTER_SAVE_DEFAULT);
  });

  it("prefers a valid canonical key over the legacy key", () => {
    localStorage.setItem(AFTER_SAVE_KEY, "tokens");
    localStorage.setItem(LEGACY_AFTER_SAVE_KEY, "compare");
    expect(readAfterSave()).toBe("tokens");
    // The legacy key is left alone: the canonical value already won.
    expect(localStorage.getItem(AFTER_SAVE_KEY)).toBe("tokens");
  });

  it("falls back to the default when storage is unreachable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readAfterSave()).toBe(AFTER_SAVE_DEFAULT);
  });
});

describe("writeAfterSave", () => {
  it("writes only the canonical key", () => {
    writeAfterSave("tokens");
    expect(localStorage.getItem(AFTER_SAVE_KEY)).toBe("tokens");
    expect(localStorage.getItem(LEGACY_AFTER_SAVE_KEY)).toBeNull();
  });

  it("silently no-ops when storage is unreachable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => writeAfterSave("compare")).not.toThrow();
  });
});
