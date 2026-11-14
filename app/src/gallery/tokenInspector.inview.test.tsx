// @vitest-environment happy-dom
// Issue #318 RED: with nothing selected, the Preview's right panel shows only
// "Properties / No component selected" plus "Click a component's token count
// badge to inspect its tokens here." — a 300 px empty column while the user
// scrolls through 93 sections. The panel must offer the section in view: its
// label, its token count, and an "Inspect tokens" button that opens exactly
// the scope the section's own badge opens.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import {
  clearAll,
  getInspectorState,
  selectScope,
} from "../lib/tokenOverrides.ts";
import { tokensForEntry } from "../lib/tokenUsage.ts";
import type { DesignSystem } from "../systems/store.ts";
import { PreviewProps } from "../preview/PreviewProps.tsx";
import { ScopePanel } from "./tokenInspector.tsx";

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function mount(node: React.ReactNode): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(node);
  });
}

function inspectButton(): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === "Inspect tokens",
  );
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => selectScope(null));
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  act(() => {
    selectScope(null);
    clearAll();
  });
  document.body.innerHTML = "";
});

describe("ScopePanel In view (issue #318 RED)", () => {
  it("offers the section in view with an Inspect tokens button that selects its scope", async () => {
    await mount(
      <ScopePanel
        valueOf={() => "#111111"}
        inView={{ id: "forms", title: "Forms", tokens: ["--color-accent"] }}
      />,
    );
    // On the parent commit this fails: no "In view" block renders at all.
    expect(document.body.textContent).toMatch(/In view/);
    expect(document.body.textContent).toMatch(/Forms/);
    const button = inspectButton();
    expect(button, "Inspect tokens button renders").not.toBeUndefined();
    await act(async () => {
      button!.click();
    });
    // The button opens exactly the scope the section's own badge opens.
    expect(getInspectorState().selected?.id).toBe("forms");
    expect(getInspectorState().selected?.title).toBe("Forms");
  });

  it("keeps the badge hint under the In view block", async () => {
    await mount(
      <ScopePanel
        valueOf={() => "#111111"}
        inView={{ id: "forms", title: "Forms", tokens: ["--color-accent"] }}
      />,
    );
    expect(document.body.textContent).toMatch(/token count badge/);
  });
});

const system = {
  slug: "inview",
  name: "Inview",
  css: ":root { --color-accent: #111111; }",
  groups: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as DesignSystem;

function stubRect(top: number): DOMRect {
  return {
    top,
    bottom: top,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as unknown as DOMRect;
}

describe("PreviewProps In view integration (issue #318)", () => {
  it("shows the section in view and inspects its entry tokens", async () => {
    // The shell frame scrollspy measures against, plus the one listed
    // section present in the DOM — every other COMPONENT_ENTRIES id is
    // absent, so the scan resolves to it regardless of geometry.
    // screen-dashboard (not forms): its tokens are inline var() references
    // in the Body source, so tokensForEntry resolves them even in Vitest,
    // where the ?raw CSS glob the class-based scan needs comes back empty.
    const scroller = document.createElement("div");
    scroller.className = "app-main";
    scroller.getBoundingClientRect = () => stubRect(0);
    document.body.appendChild(scroller);
    const section = document.createElement("section");
    section.id = "screen-dashboard";
    section.getBoundingClientRect = () => stubRect(0);
    document.body.appendChild(section);

    await mount(<PreviewProps system={system} />);
    // Flush the scrollspy's rAF-throttled scan.
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    });

    expect(document.body.textContent).toMatch(/In view/);
    expect(document.body.textContent).toMatch(/Dashboard/);
    const button = inspectButton();
    expect(button, "Inspect tokens button renders").not.toBeUndefined();
    await act(async () => {
      button!.click();
    });
    // Same scope the Dashboard section badge opens: entry id, entry label,
    // and the entry's own token list.
    expect(getInspectorState().selected?.id).toBe("screen-dashboard");
    expect(getInspectorState().selected?.title).toBe("Dashboard");
    expect(getInspectorState().selected?.tokens).toEqual(tokensForEntry("screen-dashboard"));
  });
});
