// @vitest-environment happy-dom
// Issue #310: Shadow and glow specimens are invisible — 40px dark squares on
// a dark page. RED on the parent: ShadowRow renders the specimen with inline
// boxShadow var(--shadow-md), inside a stage, with a group-level stage toggle.
// The parent has no stage or toggle, so the last two assertions fail there.
//
// T22 update: the toggle's old "Light" label lied — it applied
// --color-surface-inverse, which is dark in the light theme. The control is
// now named "Inverse"; this test previously pinned the wrong label.
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { ShadowRow } from "./rows.tsx";

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function renderShadow(): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <ShadowRow
        tokens={[{ name: "--shadow-md", value: "0 4px 6px" }]}
        selectedName={null}
        onPick={() => {}}
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

describe("ShadowRow stage (issue #310)", () => {
  it("renders the live token, a stage, and an inverse-stage toggle", async () => {
    const el = await renderShadow();
    // Parent uses .tok-shadowbox; the fix uses .tok-shadowcard. Accept either
    // so the boxShadow assertion passes on both and the RED fails on the
    // stage/toggle, which the parent lacks.
    const specimen = el.querySelector<HTMLElement>(".tok-shadowcard, .tok-shadowbox")!;
    expect(specimen.style.boxShadow).toBe("var(--shadow-md)");
    expect(el.querySelector(".tok-shadowstage"), "stage element exists").not.toBeNull();
    const toggle =
      [...el.querySelectorAll<HTMLElement>("button")].find((b) => /inverse/i.test(b.textContent ?? "")) ?? null;
    expect(toggle, "stage toggle exists").not.toBeNull();
    expect(toggle?.textContent ?? "", "toggle name contains inverse").toMatch(/inverse/i);
  });

  it("shares one toggle across the whole group, not one per row", async () => {
    const { createRoot } = await import("react-dom/client");
    const multi = document.createElement("div");
    document.body.appendChild(multi);
    const multiRoot = createRoot(multi);
    await act(async () => {
      multiRoot.render(
        <ShadowRow
          tokens={[
            { name: "--shadow-xs", value: "0 1px 2px" },
            { name: "--shadow-md", value: "0 4px 6px" },
            { name: "--shadow-2xl", value: "0 25px 50px" },
          ]}
          selectedName={null}
          onPick={() => {}}
        />,
      );
    });
    const buttons = [...multi.querySelectorAll("button")].filter((b) => /inverse|page/i.test(b.textContent ?? ""));
    expect(buttons, "one group-level toggle").toHaveLength(2);
    expect(multi.querySelectorAll(".tok-shadowstage")).toHaveLength(3);
    const stages = () => [...multi.querySelectorAll<HTMLElement>(".tok-shadowstage")];
    expect(stages().map((s) => s.dataset.stage), "defaults to the page ground").toEqual([
      "page",
      "page",
      "page",
    ]);
    const inverse = buttons.find((b) => /inverse/i.test(b.textContent ?? ""))!;
    act(() => {
      inverse.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(stages().map((s) => s.dataset.stage), "one toggle flips every stage").toEqual([
      "inverse",
      "inverse",
      "inverse",
    ]);
    act(() => multiRoot.unmount());
    multi.remove();
  });
});
