// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DesignSystem } from "../systems/store.ts";
import type { PushToast } from "../lib/toasts.ts";
import { SchemaView } from "./SchemaView.tsx";
import { useTokensView } from "./useTokensView.ts";

// Legacy schemaView (src/viewer/app.js:534) put `data-token` on *every* row,
// present or missing, and the delegated copy handler (app.js:682-692) copied
// `${name}: ${value ?? ""};`. The port gated onClick on `hit`, so a missing
// row's title promised "missing — Add to create" but clicking it copied
// nothing (issue #28). This suite renders the real hook + SchemaView so the
// click exercises production copyToken, not a stand-in formatter.

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let writeText: ReturnType<typeof vi.fn>;

function Harness({ system, push }: { system: DesignSystem; push: PushToast }) {
  const view = useTokensView(system, push);
  return (
    <SchemaView
      view={view}
      onPick={view.copyToken}
      editingName={view.editingName}
      onEdit={view.onEdit}
      onSave={() => {}}
    />
  );
}

async function mount(system: DesignSystem, push: PushToast): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Harness system={system} push={push} />);
  });
  return host;
}

function click(el: Element): void {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

const system = {
  slug: "demo",
  name: "Demo",
  css: ":root { --color-accent: #4f46e5; }",
} as unknown as DesignSystem;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

describe("SchemaView row clicks", () => {
  it("copies `name: ;` when a missing row is clicked", async () => {
    const el = await mount(system, vi.fn());
    const missing = el.querySelector('[data-token="--color-accent-hover"]');
    expect(missing).not.toBeNull();

    click(missing!);

    expect(writeText).toHaveBeenCalledWith("--color-accent-hover: ;");
  });

  it("still copies `name: value;` from a present row", async () => {
    const el = await mount(system, vi.fn());
    const present = el.querySelector('[data-token="--color-accent"]');

    click(present!);

    expect(writeText).toHaveBeenCalledWith("--color-accent: #4f46e5;");
  });
});

// Issue #312: every schema group rendered its own auto-layout table, so each
// table sized its columns from its own longest name and the value column's
// left edge shifted group to group (654, 726, 711, 778px across the first
// four groups at 1440x900). Every table now declares the same column
// template and the stylesheet fixes it.
//
// happy-dom has no layout engine, so the shared-template invariant is read
// from the DOM declarations plus the stylesheet text (rows.type.test.tsx
// precedent) — the browser Tester's ±1px measurement is the layout proof.
describe("SchemaView shared column template", () => {
  const expectedTracks = ["tok-schema-col-name", "tok-schema-col-value", "tok-schema-col-actions"];

  it("declares the same colgroup in every schema table", async () => {
    const el = await mount(system, vi.fn());
    const tables = [...el.querySelectorAll("table.tok-raw")];
    expect(tables.length, "more than one schema group renders").toBeGreaterThan(1);
    for (const table of tables) {
      const tracks = [...table.querySelectorAll("colgroup col")].map(
        (c) => c.getAttribute("class") ?? "",
      );
      expect(tracks, "every table declares all three column tracks").toEqual(expectedTracks);
    }
  });

  it("fixes the shared tracks from tokens without ellipsizing names", async () => {
    const css = readFileSync(resolve(process.cwd(), "src/tokens/SchemaView.css"), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    expect(css, "schema tables use fixed layout").toMatch(/table-layout\s*:\s*fixed/);
    expect(css, "column widths resolve from the token layer").toMatch(/width\s*:\s*var\(--/);
    expect(css, "no literal px/rem column sizes").not.toMatch(/width\s*:[^;]*\d(px|rem)/);
    expect(css, "name cells never ellipsize").not.toMatch(/text-overflow\s*:\s*ellipsis/);
  });
});
