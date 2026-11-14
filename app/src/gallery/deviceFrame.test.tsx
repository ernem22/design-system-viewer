// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GallerySection } from "./ui.tsx";
import InboxBody from "./components/screens/inbox.tsx";

// Issue #321: screen-* sections render at one width only. Each gets a
// Desktop / Tablet / Phone frame-width control around its Body, and the
// screens.css width rules follow the frame via container queries.

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function renderInbox(): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <GallerySection
        id="screen-inbox"
        label="Inbox"
        desc="List + reading pane."
        Body={InboxBody}
      />,
    );
  });
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

describe("screen frame width control", () => {
  it("shows a Frame width group with Desktop, Tablet and Phone", async () => {
    await renderInbox();
    const group = document.querySelector('[aria-label="Frame width"]');
    expect(group, 'a group named "Frame width" exists').not.toBeNull();
    expect(group!.getAttribute("role"), "group role").toMatch(/^(group|radiogroup)$/);
    const labels = [...group!.querySelectorAll("button")].map((b) => b.textContent?.trim());
    expect(labels).toEqual(["Desktop", "Tablet", "Phone"]);
  });

  it("choosing Phone sets the frame max-width to 390px", async () => {
    await renderInbox();
    const group = document.querySelector('[aria-label="Frame width"]')!;
    const phone = [...group.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Phone",
    ) as HTMLButtonElement;
    expect(phone, "Phone item renders").toBeDefined();
    await act(async () => {
      phone.click();
    });
    const frame = document.querySelector<HTMLElement>(".dsv-screen-frame");
    expect(frame, "screen frame renders").not.toBeNull();
    expect(frame!.style.maxWidth, "Phone frame max-width").toBe("390px");
  });
});

describe("screens.css container queries", () => {
  // vitest runs with cwd = app/, so the co-located stylesheet resolves from there.
  const css = readFileSync(resolve(process.cwd(), "src/gallery/components/screens/screens.css"), "utf8");

  it("uses @container for the width rules and no width @media", () => {
    expect(css, "container queries present").toContain("@container");
    expect(css, "no width media queries").not.toContain("@media (max-width");
  });
});
