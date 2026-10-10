// @vitest-environment happy-dom
// Issue #309: `TypeRow` renders "Aa Bb Cc — sample text 0123" at every size
// inside `.tok-typespec` (`white-space: nowrap; text-overflow: ellipsis`), so
// large sizes are cut ("Aa B…", "A…") and clamp()/vw display values hide the
// size they resolve to. The specimen must never ellipsize (fall back to "Ag"
// when the sentence overflows, picked by measuring) and each font-size value
// must show its computed px size as `≈ Npx` (recomputed on resize), with the
// full raw value kept as `title` on the value cell.
//
// happy-dom has no layout engine, so the no-ellipsis invariant is read from
// the stylesheet text (like rows.single.test.tsx) and the resolved px size is
// read through a stubbed getComputedStyle().fontSize, as the issue prescribes.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TypeRow } from "./rows.tsx";

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let getComputedStyleSpy: ReturnType<typeof vi.spyOn> | null = null;

async function renderTypeRow(): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  // The resolved-size label reads getComputedStyle(specimen).fontSize; stub
  // the resolved size since happy-dom computes no layout.
  const original = window.getComputedStyle.bind(window);
  getComputedStyleSpy = vi
    .spyOn(window, "getComputedStyle")
    .mockImplementation(((el: Element) => {
      const real = original(el);
      return new Proxy(real, {
        get(t, p, r) {
          if (p === "fontSize") return "128px";
          const v = Reflect.get(t, p, r);
          return typeof v === "function" ? v.bind(t) : v;
        },
      });
    }) as typeof window.getComputedStyle);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <TypeRow
        tokens={[{ name: "--font-size-display-xl", value: "clamp(4.5rem, 10vw, 8rem)" }]}
        selectedName={null}
        onPick={() => {}}
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
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  getComputedStyleSpy?.mockRestore();
  getComputedStyleSpy = null;
});

// Stylesheet-text invariant (rows.single.test.tsx precedent): the specimen's
// own classes must not carry `text-overflow: ellipsis`, otherwise large sizes
// render as "Aa B…" / "A…" in the browser.
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

describe("type specimen never ellipsizes and shows its resolved size (issue #309 RED)", () => {
  it("styles the specimen without text-overflow: ellipsis", async () => {
    const el = await renderTypeRow();
    const specimen = el.querySelector<HTMLElement>(".tok-row-demo div");
    expect(specimen, "TypeRow renders a specimen in the demo cell").not.toBeNull();
    const css = [...specimen!.classList]
      .flatMap((c) => declarationsFor(`.${c}`))
      .join("\n");
    expect(css, "specimen classes must not ellipsize").not.toMatch(
      /text-overflow\s*:\s*ellipsis/,
    );
  });

  it("shows the computed px size as ≈ Npx", async () => {
    const el = await renderTypeRow();
    const labels = [...el.querySelectorAll("*")].filter((n) =>
      /≈ \d+px/.test(n.textContent ?? ""),
    );
    expect(labels, "a resolved-size element matching /≈ \\d+px/ exists").not.toHaveLength(0);
  });

  it("keeps the full raw value as title on the value cell", async () => {
    const el = await renderTypeRow();
    expect(el.querySelector(".tok-row-value")?.getAttribute("title")).toBe(
      "clamp(4.5rem, 10vw, 8rem)",
    );
  });
});
