// @vitest-environment happy-dom
// Issue #118: the Tokens tab rendered the same row twice — a `.tok-raw` table
// for "flat" kinds and the `.tok-row` flex layout for demo kinds — so adjacent
// groups disagreed about the value/action columns and about the value's
// emphasis. One row component must draw both, with the distinction carried by
// props. happy-dom has no layout engine, so the geometry invariant is read from
// the stylesheet text (like shell/shellContract.test.ts) and the DOM is checked
// structurally: every group renders `.tok-row`, never a table, with the same
// four cells.
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TokenGroup } from "./TokenGroup.tsx";
import type { VisibleGroup } from "./useTokensView.ts";

const roots: Root[] = [];

async function renderGroup(visible: VisibleGroup): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => {
    root.render(
      <TokenGroup
        visible={visible}
        showMissing={false}
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
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
});

// A kind with a visual demo and a kind with none (the old rawTable path).
const demoGroup: VisibleGroup = {
  group: { id: "spacing", label: "Spacing", kind: "length", tokens: [] },
  tokens: [{ name: "--space-1", value: "0.25rem" }],
  missing: [],
};
const flatGroup: VisibleGroup = {
  group: { id: "component-button", label: "Component / Button", kind: "raw", tokens: [] },
  tokens: [{ name: "--button-height-md", value: "2.5rem" }],
  missing: [],
};

describe("one token row renderer (issue #118)", () => {
  it("draws a flat group and a demo group through the same row component", async () => {
    for (const visible of [demoGroup, flatGroup]) {
      const el = await renderGroup(visible);
      expect(el.querySelector("table.tok-raw")).toBeNull();
      const rows = el.querySelectorAll(".tok-row");
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row.children).toHaveLength(4);
      expect(row.querySelector(".tok-row-name")?.textContent).toBe(visible.tokens[0].name);
      expect(row.querySelector(".tok-row-value")?.textContent).toContain(visible.tokens[0].value);
      expect(row.querySelector(".tok-row-demo")).not.toBeNull();
      expect(row.querySelector(".tok-row-action .tok-update")).not.toBeNull();
    }
  });

  it("carries the demo/flat distinction on the demo slot, not a second layout", async () => {
    const demoEl = await renderGroup(demoGroup);
    expect(demoEl.querySelector(".tok-row-demo")?.children).toHaveLength(1);
    const flatEl = await renderGroup(flatGroup);
    expect(flatEl.querySelector(".tok-row-demo")?.children).toHaveLength(0);
  });
});

// The offset invariant, read from rows.css: one grid with fixed name/value/
// demo/action tracks (so the value column and action cannot drift between
// groups) and one muted value treatment.
const rowsCss = readFileSync(resolve(process.cwd(), "src/tokens/rows.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function declarationsFor(selector: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(rowsCss); m !== null; m = re.exec(rowsCss)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.includes(selector)) bodies.push(m[2]);
  }
  return bodies;
}

describe("token row column contract (issue #118)", () => {
  it("lays every row out as one grid, not a flex label/demo pair", () => {
    const row = declarationsFor(".tok-row").join("\n");
    expect(row).toMatch(/display:\s*grid\b/);
    expect(row).toMatch(/grid-template-columns:/);
    expect(declarationsFor(".tok-row-label")).toEqual([]);
  });

  it("draws the value at one muted emphasis, not full-strength in flat rows", () => {
    const value = declarationsFor(".tok-row-value").join("\n");
    expect(value).toMatch(/color:\s*var\(--color-text-muted\)/);
  });
});
