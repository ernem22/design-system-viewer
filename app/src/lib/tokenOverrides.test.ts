import { afterEach, describe, expect, it } from "vitest";
import {
  clearAll,
  clearValueEdit,
  countOverrides,
  getInspectorState,
  getValueEdit,
  resolvedValue,
  scopeStyleFor,
  setSwap,
  setValueEdit,
  valueInScope,
} from "./tokenOverrides.ts";

// Issue #27: Preview value-edits became permanent and Reset only cleared
// swaps. Restored the legacy two-layer ephemeral model: `valueEdits` (global
// what-if, this file) + `swaps` (per-component). These pin the layer itself —
// its resolution precedence, that Reset drops it, and that it survives a
// system switch. The store is module-level, so every test clears both layers
// after itself.

const TOKEN = "--color-accent";

/** The authored layer the Preview panels pass in — in the app this is
    `tokenValueMap(system, dark).get`, which already folds css -> groups ->
    themes.dark. Here it's a plain closure so the override layer can be tested
    in isolation, including the "system doesn't define it" case (""). */
const authoredFrom = (map: Record<string, string>) => (name: string) => map[name] ?? "";

afterEach(() => {
  clearAll();
});

describe("resolvedValue — override precedence", () => {
  it("returns the authored value when nothing is overridden", () => {
    const authored = authoredFrom({ [TOKEN]: "#111111" });
    expect(resolvedValue(authored, TOKEN)).toBe("#111111");
  });

  it("lets a value edit win over the authored value, light or dark", () => {
    // The authored layer already resolves light/dark via tokenValueMap, so a
    // single override wins over either — the same call site serves both.
    const light = authoredFrom({ [TOKEN]: "#111111" });
    const dark = authoredFrom({ [TOKEN]: "#000000" });
    setValueEdit(TOKEN, "#ff0000");
    expect(resolvedValue(light, TOKEN)).toBe("#ff0000");
    expect(resolvedValue(dark, TOKEN)).toBe("#ff0000");
  });
});

describe("valueInScope — swap resolution", () => {
  it("resolves a swapped target through the global value-edit layer", () => {
    const authored = authoredFrom({ "--color-danger": "#222222", [TOKEN]: "#111111" });
    setSwap("demo", TOKEN, "--color-danger");
    // Swap --color-accent -> --color-danger.
    expect(valueInScope(authored, "demo", TOKEN)).toBe("#222222");
    // A value edit on the swapped-to token wins over the authored value.
    setValueEdit("--color-danger", "#ff0000");
    expect(valueInScope(authored, "demo", TOKEN)).toBe("#ff0000");
  });

  it("resolves a token directly when it is not swapped", () => {
    const authored = authoredFrom({ [TOKEN]: "#111111" });
    setValueEdit(TOKEN, "#ff0000");
    expect(valueInScope(authored, "demo", TOKEN)).toBe("#ff0000");
  });
});

// Legacy is swap-first: valueInDemo (preview/src/tokenOverrides.js:89-92)
// returns `source ? globalValue(source) : globalValue(name)` and never reads a
// value edit on the swap *target*. So editing a token that a scope also swaps
// away does not beat the swap; only an edit on the swap's *source* changes
// what the scope reads.
describe("valueInScope — swap-first precedence (legacy parity)", () => {
  it("ignores a value edit on the swapped-away target", () => {
    const authored = authoredFrom({ "--color-danger": "#222222", [TOKEN]: "#111111" });
    setSwap("demo", TOKEN, "--color-danger");
    setValueEdit(TOKEN, "#ff00aa");
    // Swap-first: the scope reads --color-danger -> #222222, not #ff00aa.
    expect(valueInScope(authored, "demo", TOKEN)).toBe("#222222");
  });

  it("resolves a value edit on the swap's source", () => {
    const authored = authoredFrom({ "--color-danger": "#222222", [TOKEN]: "#111111" });
    setSwap("demo", TOKEN, "--color-danger");
    setValueEdit("--color-danger", "#00ffaa");
    // globalValue(source): an edit on the source changes the swap's output.
    expect(valueInScope(authored, "demo", TOKEN)).toBe("#00ffaa");
  });

  it("still resolves the swap when neither side is edited", () => {
    const authored = authoredFrom({ "--color-danger": "#222222", [TOKEN]: "#111111" });
    setSwap("demo", TOKEN, "--color-danger");
    expect(valueInScope(authored, "demo", TOKEN)).toBe("#222222");
  });
});

// Same order, applied to the DOM node instead of a read: legacy's useSwapStyle
// (preview/src/ui.jsx:324-326) always writes `target: var(source)`, with no
// substitution for a value edit on the target; the source's edit repaints
// through the `:root` document override instead.
describe("scopeStyleFor — swap-first var(source)", () => {
  it("emits the swap redirect for every target", () => {
    expect(scopeStyleFor({ demo: { [TOKEN]: "--color-danger" } }, "demo")).toEqual({
      [TOKEN]: "var(--color-danger)",
    });
  });

  it("returns undefined for a scope with no swaps", () => {
    expect(scopeStyleFor({}, "demo")).toBeUndefined();
  });
});

describe("ephemeral layer", () => {
  it("is never written into any authored map", () => {
    const authoredMap: Record<string, string> = { [TOKEN]: "#111111" };
    const before = JSON.stringify(authoredMap);
    setValueEdit(TOKEN, "#ff0000");
    expect(resolvedValue(authoredFrom(authoredMap), TOKEN)).toBe("#ff0000");
    expect(JSON.stringify(authoredMap)).toBe(before);
  });

  it("keeps an override for a token the current system does not define", () => {
    setValueEdit(TOKEN, "#ff0000");
    // System A does not define the token at all. The override is not dropped
    // from the store — an unqueried token just never renders through it — and
    // it is still there for the system that does define it.
    expect(getValueEdit(TOKEN)).toBe("#ff0000");
    expect(resolvedValue(authoredFrom({ [TOKEN]: "#222222" }), TOKEN)).toBe("#ff0000");
  });

  it("applies the override again after switching away and back", () => {
    setValueEdit(TOKEN, "#ff0000");
    // System B defines the token: the override applies.
    expect(resolvedValue(authoredFrom({ [TOKEN]: "#222222" }), TOKEN)).toBe("#ff0000");
    // Switch to system A, which doesn't define it: the override is retained.
    expect(getValueEdit(TOKEN)).toBe("#ff0000");
    // Back to a system that defines it: the override applies untouched.
    expect(resolvedValue(authoredFrom({ [TOKEN]: "#333333" }), TOKEN)).toBe("#ff0000");
  });

  it("drops a single override with clearValueEdit", () => {
    setValueEdit(TOKEN, "#ff0000");
    clearValueEdit(TOKEN);
    expect(getValueEdit(TOKEN)).toBeUndefined();
    expect(resolvedValue(authoredFrom({ [TOKEN]: "#111111" }), TOKEN)).toBe("#111111");
  });
});

describe("countOverrides / clearAll — Reset honesty", () => {
  it("counts value edits and swaps together", () => {
    setValueEdit(TOKEN, "#ff0000");
    setSwap("demo", "--a", "--b");
    setSwap("demo", "--c", "--d");
    // 1 value edit + 2 swaps = 3 — the count the Reset pill must show.
    expect(countOverrides(getInspectorState())).toBe(3);
  });

  it("clears value edits as well as swaps (the #27 bug)", () => {
    setValueEdit(TOKEN, "#ff0000");
    setSwap("demo", "--a", "--b");
    clearAll();
    expect(getValueEdit(TOKEN)).toBeUndefined();
    expect(countOverrides(getInspectorState())).toBe(0);
  });
});
