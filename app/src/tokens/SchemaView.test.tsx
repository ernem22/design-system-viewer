// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
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
