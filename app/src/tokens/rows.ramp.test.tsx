// @vitest-environment happy-dom
// Issue #308: "Brand Scale (primitive)" (--color-brand-50 … --color-brand-900)
// rendered as ten separate cards in a 4-column swatch grid (4 + 4 + 2), so the
// steps wrapped across three rows with 200+ px between them — a scale you
// cannot read as a scale. A color group where 3+ tokens share a numeric-step
// prefix must render as one continuous ramp: a single strip of equal-width
// cells in ascending step order with no gaps, each cell showing its step, its
// value and its WCAG ratio against --color-bg. Non-scale color groups keep
// the swatch grid.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TokenGroup } from "./TokenGroup.tsx";
import type { VisibleGroup } from "./useTokensView.ts";
import type { TokenGroup as TokenGroupData } from "../systems/store.ts";

interface RawToken {
  name: string;
  value: string;
}
interface RawGroup {
  id: string;
  label: string;
  kind: string;
  tokens: RawToken[];
}

const systemJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "../systems/perp-ultra-v2.json"), "utf8"),
) as { groups: RawGroup[] };

function groupOf(id: string): VisibleGroup {
  const found = systemJson.groups.find((g) => g.id === id);
  if (!found) throw new Error(`group ${id} missing from fixture`);
  return {
    group: { id: found.id, label: found.label, kind: found.kind, tokens: [] } as TokenGroupData,
    tokens: found.tokens.map((t) => ({ name: t.name, value: t.value })),
    missing: [],
  };
}

const brandGroup = groupOf("color-brand");
const EXPECTED_ORDER = [
  "--color-brand-50",
  "--color-brand-100",
  "--color-brand-200",
  "--color-brand-300",
  "--color-brand-400",
  "--color-brand-500",
  "--color-brand-600",
  "--color-brand-700",
  "--color-brand-800",
  "--color-brand-900",
];

const roots: Root[] = [];

async function renderGroup(
  visible: VisibleGroup,
  opts?: { onPick?: (t: RawToken) => void },
): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  // The ramp measures contrast against --color-bg through a probe element, so
  // the background token must resolve at the root like App.tsx applies it.
  document.documentElement.style.setProperty("--color-bg", "#151715");
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
        onPick={opts?.onPick ?? (() => {})}
        editingName={null}
        onEdit={() => {}}
        onSave={() => {}}
      />,
    );
  });
  await act(async () => {});
  return host;
}

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
  document.documentElement.style.removeProperty("--color-bg");
});

describe("color scale ramp (issue #308 RED)", () => {
  it("renders Brand Scale as exactly one ramp of 10 cells in step order", async () => {
    const el = await renderGroup(brandGroup);
    const ramps = el.querySelectorAll(".tok-ramp");
    expect(ramps, "one continuous strip, not ten cards").toHaveLength(1);
    const cells = [...ramps[0].querySelectorAll(".tok-ramp-cell")];
    expect(cells.map((c) => c.getAttribute("data-token"))).toEqual(EXPECTED_ORDER);
  });

  it("shows a contrast label in every ramp cell", async () => {
    const el = await renderGroup(brandGroup);
    const cells = [...el.querySelectorAll(".tok-ramp-cell")];
    expect(cells).toHaveLength(10);
    for (const cell of cells) {
      const label = cell.querySelector(".tok-ramp-ratio");
      expect(label, `${cell.getAttribute("data-token")} has a ratio label`).not.toBeNull();
      expect(label!.textContent!.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps the swatch picking behaviour on ramp cells", async () => {
    const onPick = vi.fn();
    const el = await renderGroup(brandGroup, { onPick });
    const cell = el.querySelector<HTMLElement>('.tok-ramp-cell[data-token="--color-brand-500"]')!;
    expect(cell.getAttribute("role")).toBe("option");
    act(() => {
      cell.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onPick).toHaveBeenCalledWith({ name: "--color-brand-500", value: "#c26a51" });
  });

  it("keeps non-scale color groups on the swatch grid", async () => {
    const el = await renderGroup(groupOf("color-text"));
    expect(el.querySelector(".tok-ramp")).toBeNull();
    expect(el.querySelectorAll(".tok-swatch").length).toBeGreaterThan(0);
  });
});
