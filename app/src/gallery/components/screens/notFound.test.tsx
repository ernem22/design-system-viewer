// @vitest-environment happy-dom
// Issue #117: the shell owns the document's single <h1> ("Design System Viewer").
// The 404 screen renders inside the Preview gallery, so its big "404" must be a
// sub-section heading (h3 under the section's h2), never an <h1> — otherwise a
// mounted Preview section adds a second h1 to the page.
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import NotFoundBody from "./notFound.tsx";

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

describe("404 screen heading level", () => {
  it("renders the 404 as a sub-heading, never an h1", async () => {
    const { createRoot } = await import("react-dom/client");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(<NotFoundBody />);
    });
    expect(host.querySelectorAll("h1")).toHaveLength(0);
    expect(host.querySelector("h3")?.textContent).toBe("404");
  });
});
