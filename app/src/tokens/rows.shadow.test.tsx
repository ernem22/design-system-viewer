// @vitest-environment happy-dom
// Issue #310: Shadow and glow specimens are invisible — 40px dark squares on
// a dark page. RED on the parent: ShadowRow renders the specimen with inline
// boxShadow var(--shadow-md), inside a stage, with a group-level stage toggle
// whose accessible name contains "light". The parent has no stage or toggle,
// so the last two assertions fail there.
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

describe("ShadowRow stage (issue #310)", () => {
  it("renders the live token, a stage, and a light-stage toggle", async () => {
    const el = await renderShadow();
    // Parent uses .tok-shadowbox; the fix uses .tok-shadowcard. Accept either
    // so the boxShadow assertion passes on both and the RED fails on the
    // stage/toggle, which the parent lacks.
    const specimen = el.querySelector<HTMLElement>(".tok-shadowcard, .tok-shadowbox")!;
    expect(specimen.style.boxShadow).toBe("var(--shadow-md)");
    expect(el.querySelector(".tok-shadowstage"), "stage element exists").not.toBeNull();
    const toggle =
      [...el.querySelectorAll<HTMLElement>("button")].find((b) => /light/i.test(b.textContent ?? "")) ?? null;
    expect(toggle, "stage toggle exists").not.toBeNull();
    expect(toggle?.textContent ?? "", "toggle name contains light").toMatch(/light/i);
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
          editingName={null}
          onEdit={() => {}}
          onSave={() => {}}
        />,
      );
    });
    const buttons = [...multi.querySelectorAll("button")].filter((b) => /light|page/i.test(b.textContent ?? ""));
    expect(buttons, "one group-level toggle").toHaveLength(2);
    expect(multi.querySelectorAll(".tok-shadowstage")).toHaveLength(3);
    const stages = () => [...multi.querySelectorAll<HTMLElement>(".tok-shadowstage")];
    expect(stages().map((s) => s.dataset.stage), "defaults to the page ground").toEqual([
      "page",
      "page",
      "page",
    ]);
    const light = buttons.find((b) => /light/i.test(b.textContent ?? ""))!;
    act(() => {
      light.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(stages().map((s) => s.dataset.stage), "one toggle flips every stage").toEqual([
      "light",
      "light",
      "light",
    ]);
    act(() => multiRoot.unmount());
    multi.remove();
  });
});
