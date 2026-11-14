// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary.tsx";

const RAW_MESSAGE = "SECRET_INTERNAL_42";

function Thrower(): never {
  throw new Error(RAW_MESSAGE);
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let reload: ReturnType<typeof vi.spyOn>;

async function mount(): Promise<HTMLDivElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    );
  });
  return host;
}

beforeEach(() => {
  // React reports caught render errors to console.error; keep the test quiet.
  vi.spyOn(console, "error").mockImplementation(() => {});
  reload = vi.spyOn(window.location, "reload").mockImplementation(() => {});
  window.history.replaceState(null, "", "/?tab=compare&sys=bad#section");
  localStorage.clear();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("ErrorBoundary recovery surface", () => {
  it("shows user-safe copy and never the raw error message", async () => {
    const el = await mount();
    expect(el.textContent).toContain("Something went wrong");
    expect(el.textContent).toContain("Reload the page");
    expect(el.textContent).not.toContain(RAW_MESSAGE);
    expect(el.textContent).not.toContain("SECRET");
  });

  it("announces the failure exactly once", async () => {
    const el = await mount();
    expect(el.querySelectorAll('[role="alert"]')).toHaveLength(1);
  });

  it("moves focus to the fallback card", async () => {
    const el = await mount();
    const card = el.querySelector(".app-error-card");
    expect(card).not.toBeNull();
    expect(document.activeElement).toBe(card);
  });

  it("reloads from the Reload action", async () => {
    const el = await mount();
    const button = [...el.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Reload"),
    );
    await act(async () => button?.click());
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("clears the persisted selection and URL state before reloading", async () => {
    localStorage.setItem("dsv.app.active", "corrupt-system");
    const el = await mount();
    const button = [...el.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Reset to a safe view"),
    );
    await act(async () => button?.click());
    expect(localStorage.getItem("dsv.app.active")).toBeNull();
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("styles the fallback from viewer-private tokens, not themed colors", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src", "shell", "ErrorBoundary.css"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).toContain("var(--app-error-");
    expect(css).not.toMatch(/var\(--color-(?!white|neutral-1000)/);
    expect(css).not.toMatch(/var\(--(space|radius|font-size)-/);
  });
});
