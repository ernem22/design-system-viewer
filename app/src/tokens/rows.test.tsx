// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { OpacityRow } from "./rows.tsx";

// Legacy opacityRow (src/viewer/app.js:647) drew the demo on
// `background: var(--ui-accent)`, so the alpha step is visible against a
// transparent ground. The React port kept only `opacity`, which made every
// row invisible/misleading (issue #28). These tests pin the demo's inline
// style: the opacity token drives alpha, the accent token is the ground.

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function renderRow(name: string, value: string): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <OpacityRow
        tokens={[{ name, value }]}
        selectedName={null}
        onPick={() => {}}
        editingName={null}
        onEdit={() => {}}
        onSave={() => {}}
      />,
    );
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

describe("OpacityRow", () => {
  it("draws the opacity demo over the accent background", async () => {
    const el = (await renderRow("--opacity-hover", "0.5")).querySelector<HTMLElement>(".tok-shadowbox")!;
    expect(el.style.opacity).toBe("var(--opacity-hover)");
    expect(el.style.background).toBe("var(--color-accent)");
  });

  it("sets the background for every opacity row, not just the first", async () => {
    const html = await renderRow("--opacity-disabled", "0.4");
    const boxes = [...html.querySelectorAll<HTMLElement>(".tok-shadowbox")];
    expect(boxes).toHaveLength(1);
    expect(boxes[0].style.background).toBe("var(--color-accent)");
  });
});
