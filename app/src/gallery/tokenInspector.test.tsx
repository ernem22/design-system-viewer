// @vitest-environment happy-dom
import { useState } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DesignSystem } from "../systems/store.ts";
import {
  clearAll,
  getInspectorState,
  selectScope,
  setMobileOpen,
} from "../lib/tokenOverrides.ts";
import { AddSystemDialog } from "../systems/AddSystemDialog.tsx";
import { SectionScopeTrigger } from "./tokenInspector.tsx";
import { PreviewProps, PreviewScopeDialog } from "../preview/PreviewProps.tsx";

// Issue #119: the docked inspector is opened by the section/Demo token badge
// but was only closable by tabbing to its "Close panel" button. Escape is the
// app's overlay convention (the delete-system AlertDialog and Add System
// dialog both close on Escape), so the docked panel must too — and, like a
// real dialog, return focus to whatever opened it instead of dropping it on
// <body>. These tests drive the real badge + the real docked panel.

const TOKEN = "--color-accent";

const system = {
  slug: "escape",
  name: "Escape",
  css: `:root { ${TOKEN}: #111111; }`,
  groups: [
    {
      id: "color-accent",
      label: "Accent",
      kind: "color",
      tokens: [{ name: TOKEN, value: "#111111" }],
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as DesignSystem;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

/** The docked panel plus the badge that opens it — the real entry point.
    `active` mirrors App's "this panel is the open surface" state. */
function Docked({ active = true }: { active?: boolean } = {}) {
  return (
    <>
      <SectionScopeTrigger id="demo" title="Demo" tokens={[TOKEN]} />
      <PreviewProps system={system} active={active} />
    </>
  );
}

/** The real Add System dialog stacked on top of the docked panel. */
function Stacked({ onClosed }: { onClosed: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <AddSystemDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClosed();
      }}
      onAdd={() => {}}
      onToast={() => {}}
      onSaved={() => {}}
    />
  );
}

async function mount(node: React.ReactNode): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(node);
  });
}

async function escape(): Promise<void> {
  // Real Escape comes from the focused element and bubbles to the document-
  // level listeners (ours, and Radix's capture-phase DismissableLayer).
  const target = document.activeElement ?? document.body;
  await act(async () => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  act(() => {
    selectScope(null);
    setMobileOpen(false);
    clearAll();
  });
  document.body.innerHTML = "";
});

describe("docked inspector Escape dismissal (#119)", () => {
  it("closes the docked inspector on Escape and returns focus to the badge", async () => {
    await mount(<Docked />);
    const badge = document.querySelector<HTMLButtonElement>(".dsv-token-drawer-trigger")!;
    // The badge is clicked without first focusing it, so the pre-open element
    // can't be an artefact of the test: the fix must record the opener itself.
    await act(async () => {
      badge.click();
    });
    expect(getInspectorState().selected).not.toBeNull();

    // Opening does not steal focus; a keyboard user may then Tab into the
    // panel's own controls before dismissing it.
    const panelControl = document.querySelector<HTMLButtonElement>(".dsv-drawer-head button")!;
    await act(async () => panelControl.focus());
    expect(document.activeElement).toBe(panelControl);

    await escape();

    // On the parent commit this fails: the panel stays selected (open).
    expect(getInspectorState().selected).toBeNull();
    // And focus is back on the element that opened it, not the removed control
    // and not <body>. On the parent commit the effect read activeElement after
    // the selection change, so (without the old badge.focus()) focus landed on
    // <body> — this assertion is what catches that wrong restore.
    expect(document.activeElement).toBe(badge);
  });

  it("ignores Escape while the docked inspector is not the active surface", async () => {
    // Tokens tab: Shell force-mounts the Preview props panel, but it is not the
    // open surface, so its document Escape listener must not even be installed.
    await mount(<Docked active={false} />);
    const badge = document.querySelector<HTMLButtonElement>(".dsv-token-drawer-trigger")!;
    await act(async () => {
      badge.click();
    });
    expect(getInspectorState().selected).not.toBeNull();

    await escape();

    // On the parent commit the global listener closed the hidden panel.
    expect(getInspectorState().selected).not.toBeNull();
  });

  it("leaves the docked inspector open while a stacked modal owns Escape", async () => {
    let stackedClosed = false;
    await mount(
      <>
        <Docked />
        <Stacked onClosed={() => (stackedClosed = true)} />
      </>,
    );
    const badge = document.querySelector<HTMLButtonElement>(".dsv-token-drawer-trigger")!;
    await act(async () => {
      badge.focus();
      badge.click();
    });
    expect(getInspectorState().selected).not.toBeNull();
    expect(document.querySelector(".app-import-dialog")).not.toBeNull();

    await escape();

    // The Add System dialog consumes Escape (Radix preventDefaults it); the
    // docked inspector must not also close.
    expect(stackedClosed).toBe(true);
    expect(document.querySelector(".app-import-dialog")).toBeNull();
    expect(getInspectorState().selected).not.toBeNull();
  });

  it("does not close while a nested editor consumes Escape", async () => {
    await mount(<Docked />);
    const badge = document.querySelector<HTMLButtonElement>(".dsv-token-drawer-trigger")!;
    await act(async () => {
      badge.focus();
      badge.click();
    });
    const edit = [...document.querySelectorAll<HTMLButtonElement>(".dsv-token-row-actions button")].find(
      (b) => b.textContent === "Edit value",
    )!;
    await act(async () => edit.click());
    const input = document.querySelector<HTMLInputElement>(".dsv-token-value-input")!;
    await act(async () => input.focus());

    await escape();

    // The editor's own Escape (cancel + blur) preventDefaults the event, so the
    // docked panel stays open — the same guard the stacked overlay uses.
    expect(getInspectorState().selected).not.toBeNull();
  });

  it("already closes the mobile scope dialog on Escape (the path being matched)", async () => {
    await act(async () => {
      selectScope({ id: "demo", title: "Demo", tokens: [TOKEN] });
      setMobileOpen(true);
    });
    await mount(<PreviewScopeDialog system={system} />);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    await escape();

    expect(getInspectorState().mobileOpen).toBe(false);
  });
});
