// @vitest-environment happy-dom
/**
 * RED for issue #320: Preview demos load Unsplash photos and still say
 * "192 tokens" (the schema has 432).
 *
 * Fails on the parent where `layout.tsx` and `marketing.tsx` embed an
 * `images.unsplash.com` photo and the Search screen hardcodes 192.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { act } from "react";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { REFERENCE_TOKEN_COUNT } from "../../../../../src/core/schema.js";
import SearchBody from "./search.tsx";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function mount(node: React.ReactNode): Promise<HTMLDivElement> {
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
  document.body.innerHTML = "";
});

describe("issue #320: demos are self-contained and counts track the schema", () => {
  it("has no unsplash.com photo in the layout or marketing demos", () => {
    expect(read("../layout.tsx"), "layout has no unsplash.com").not.toContain(
      "unsplash.com",
    );
    expect(read("./marketing.tsx"), "marketing has no unsplash.com").not.toContain(
      "unsplash.com",
    );
  });

  it("renders the live token count on the Search screen, not 192", async () => {
    const el = await mount(<SearchBody />);
    expect(el.textContent, "live token count renders").toContain(
      String(REFERENCE_TOKEN_COUNT),
    );
    expect(el.textContent, "stale 192 is gone").not.toContain("192");
  });
});
