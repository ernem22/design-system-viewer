// @vitest-environment happy-dom
// T04: a Field's hint/error text must be programmatically associated with the
// control, not just visually adjacent, and an error must announce assertively.
import { act } from "react";
import type { ReactNode } from "react";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { Field } from "./ui.tsx";

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function mount(node: ReactNode): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(node);
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

describe("Field accessibility", () => {
  it("associates a hint with the control via aria-describedby", async () => {
    const el = await mount(
      <Field label="Email" id="f-email" hint="Use work address">
        <input id="f-email" />
      </Field>,
    );
    const input = el.querySelector("input")!;
    const hint = el.querySelector(".dsv-hint")!;
    expect(hint.id).toBe("f-email-msg");
    expect(input.getAttribute("aria-describedby")).toBe("f-email-msg");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toBe(hint);
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });

  it("renders the error assertively, sets aria-invalid, and wins over hint", async () => {
    const el = await mount(
      <Field label="Password" id="f-pass" hint="ignored" error="At least 8 characters">
        <input id="f-pass" />
      </Field>,
    );
    const input = el.querySelector("input")!;
    const alert = el.querySelector('[role="alert"]')!;
    expect(alert.textContent).toBe("At least 8 characters");
    expect(alert.id).toBe("f-pass-msg");
    expect(input.getAttribute("aria-describedby")).toBe("f-pass-msg");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(el.querySelector(".dsv-hint:not(.dsv-hint--err)")).toBeNull();
  });

  it("merges an existing aria-describedby instead of replacing it", async () => {
    const el = await mount(
      <Field label="Domain" id="f-dom" hint="18 / 30">
        <input id="f-dom" aria-describedby="counter" />
      </Field>,
    );
    expect(el.querySelector("input")!.getAttribute("aria-describedby")).toBe("counter f-dom-msg");
  });

  it("leaves non-single-element children untouched without crashing", async () => {
    const el = await mount(
      <Field label="Amount" id="f-amt" hint="0.00">
        <input id="f-amt" />
        <span className="adorn">₺</span>
      </Field>,
    );
    expect(el.querySelector("input")!.hasAttribute("aria-describedby")).toBe(false);
    expect(el.querySelector(".dsv-hint")!.id).toBe("f-amt-msg");
  });
});
