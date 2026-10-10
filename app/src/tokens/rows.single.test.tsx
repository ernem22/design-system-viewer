// @vitest-environment happy-dom
// Issue #118: the Tokens tab rendered the same row twice — a `.tok-raw` table
// for "flat" kinds and the `.tok-row` flex layout for demo kinds — so adjacent
// groups disagreed about the value/action columns and about the value's
// emphasis. One row component must draw both, with the distinction carried by
// props. happy-dom has no layout engine, so the geometry invariant is read from
// the stylesheet text (like shell/shellContract.test.ts) and the DOM is checked
// structurally: every group renders `.tok-row`, never a table, with the same
// three cells (name/value/demo).
//
// Issue #307: the gallery no longer edits in place — the per-row Update
// button and its grid track are gone, and editing happens in the Token
// inspector. A group renders zero Update buttons; double-click selects the
// token and asks the inspector to focus (via onEdit).
import { afterEach, describe, expect, it, vi } from "vitest";
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
const colorGroup: VisibleGroup = {
  group: { id: "color", label: "Color", kind: "color", tokens: [] },
  tokens: [{ name: "--color-brand-500", value: "#ff0000" }],
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
      expect(row.children).toHaveLength(3);
      expect(row.querySelector(".tok-row-name")?.textContent).toBe(visible.tokens[0].name);
      expect(row.querySelector(".tok-row-value")?.textContent).toContain(visible.tokens[0].value);
      expect(row.querySelector(".tok-row-demo")).not.toBeNull();
    }
  });

  it("carries the demo/flat distinction on the demo slot, not a second layout", async () => {
    const demoEl = await renderGroup(demoGroup);
    expect(demoEl.querySelector(".tok-row-demo")?.children).toHaveLength(1);
    const flatEl = await renderGroup(flatGroup);
    expect(flatEl.querySelector(".tok-row-demo")?.children).toHaveLength(0);
  });
});

describe("gallery has no per-row edit buttons (issue #307 RED)", () => {
  it("renders no button named Update inside .tok-rows or .tok-swatches", async () => {
    for (const visible of [demoGroup, flatGroup, colorGroup]) {
      const el = await renderGroup(visible);
      const updates = [...el.querySelectorAll(".tok-rows button, .tok-swatches button")].filter(
        (b) => b.textContent === "Update",
      );
      expect(updates, `${visible.group.id} renders no Update button`).toHaveLength(0);
      expect(
        el.querySelector(".tok-row-action"),
        `${visible.group.id} has no action track`,
      ).toBeNull();
      expect(el.querySelector(".tok-update"), `${visible.group.id} has no update control`).toBeNull();
    }
  });

  it("double-click selects the token and asks the inspector to focus it", async () => {
    const { createRoot } = await import("react-dom/client");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    roots.push(root);
    const onPick = vi.fn();
    const onEdit = vi.fn();
    await act(async () => {
      root.render(
        <TokenGroup
          visible={demoGroup}
          showMissing={false}
          selectedName={null}
          onPick={onPick}
          editingName={null}
          onEdit={onEdit}
          onSave={() => {}}
        />,
      );
    });
    const row = host.querySelector<HTMLElement>(".tok-row")!;
    act(() => {
      row.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    expect(onPick, "double-click selects the token").toHaveBeenCalledWith(demoGroup.tokens[0]);
    expect(onEdit, "double-click targets the inspector focus").toHaveBeenCalledWith(
      demoGroup.tokens[0],
    );
  });

  it("points the row title at the new behaviour", async () => {
    const el = await renderGroup(demoGroup);
    const row = el.querySelector(".tok-row")!;
    expect(row.getAttribute("title")).toBe("click to copy — double-click to edit");
    const swatches = await renderGroup(colorGroup);
    expect(swatches.querySelector(".tok-swatch")!.getAttribute("title")).toBe(
      "click to copy — double-click to edit",
    );
  });
});

// The offset invariant, read from rows.css: one grid with fixed name/value/
// demo tracks (so the value column cannot drift between groups) and one
// muted value treatment.
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

  it("has no action track: the per-row edit button is gone (issue #307)", () => {
    expect(declarationsFor(".tok-row-action"), ".tok-row-action rule is gone").toEqual([]);
    const row = declarationsFor(".tok-row").join("\n");
    expect(row, "no max-content action track").not.toMatch(/max-content/);
  });

  it("draws the value at one muted emphasis, not full-strength in flat rows", () => {
    const value = declarationsFor(".tok-row-value").join("\n");
    expect(value).toMatch(/color:\s*var\(--color-text-muted\)/);
  });
});
