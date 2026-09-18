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

// Fixer finding #1: the swap step used to short-circuit the value-edit layer,
// so editing a token that a scope also swaps away was ignored. Precedence is
// `valueEdit > swap > authored`: the literal the user typed is what the token
// equals, and a scoped redirect must not hide it.
describe("valueInScope — valueEdit > swap precedence", () => {
  it("lets a value edit on the target beat a swap that targets that token", () => {
    const authored = authoredFrom({ "--color-danger": "#222222", [TOKEN]: "#111111" });
    setSwap("demo", TOKEN, "--color-danger");
    setValueEdit(TOKEN, "#ff00aa");
    // The swap layer would resolve to #222222; the edit must win with #ff00aa.
    expect(valueInScope(authored, "demo", TOKEN)).toBe("#ff00aa");
  });

  it("still resolves the swap when the target itself is not edited", () => {
    const authored = authoredFrom({ "--color-danger": "#222222", [TOKEN]: "#111111" });
    setSwap("demo", TOKEN, "--color-danger");
    expect(valueInScope(authored, "demo", TOKEN)).toBe("#222222");
  });
});

// Same order, applied to the DOM node instead of a read: the scope's inline
// `target: var(source)` is what a component actually inherits, so it has to
// yield to the target's value edit too (finding #1's section style).
describe("scopeStyleFor — page-level valueEdit > swap", () => {
  it("emits the swap redirect when the target has no value edit", () => {
    expect(scopeStyleFor({ demo: { [TOKEN]: "--color-danger" } }, {}, "demo")).toEqual({
      [TOKEN]: "var(--color-danger)",
    });
  });

  it("emits the edited literal in place of the swap when the target is edited", () => {
    expect(
      scopeStyleFor({ demo: { [TOKEN]: "--color-danger" } }, { [TOKEN]: "#ff00aa" }, "demo"),
    ).toEqual({ [TOKEN]: "#ff00aa" });
  });

  it("returns undefined for a scope with no swaps", () => {
    expect(scopeStyleFor({}, { [TOKEN]: "#ff00aa" }, "demo")).toBeUndefined();
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
