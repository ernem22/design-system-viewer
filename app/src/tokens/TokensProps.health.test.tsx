// @vitest-environment happy-dom
// Issue #314 RED: with nothing selected the Tokens right panel shows only
// the coverage ring plus "Click a token in the gallery to inspect it here."
// — about 80% of the panel is empty. It must show a Health summary under
// Coverage: Contrast (N of M pairs pass AA, same pairs + probe measurement
// as ContrastSection), value warnings count, fonts, and tokens-by-kind.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
import type { DesignSystem, TokenGroup } from "../systems/store.ts";
import type { TokensViewModel } from "./useTokensView.ts";
import { useTokensView } from "./useTokensView.ts";
import { TokensProps } from "./TokensProps.tsx";
import { CONTRAST_SECTION_ID } from "./useContrastRows.ts";

interface SystemJson {
  slug: string;
  name: string;
  css: string;
  groups: TokenGroup[];
  createdAt: string;
  updatedAt: string;
}

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

function perpUltraV2(): DesignSystem {
  const json = JSON.parse(read("../../../systems/perp-ultra-v2.json")) as SystemJson;
  return {
    slug: json.slug,
    name: json.name,
    css: json.css,
    groups: json.groups,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

const noop = () => {};

function Harness({ system }: { system: DesignSystem }) {
  const view = useTokensView(system, noop);
  return <TokensProps view={view} onPatch={noop} />;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function renderSystem(): Promise<HTMLElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Harness system={perpUltraV2()} />);
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

describe("TokensProps health summary (issue #314 RED)", () => {
  it("shows a Contrast row with N of M pairs passing AA when nothing is selected", async () => {
    const el = await renderSystem();
    const contrast = [...el.querySelectorAll(".tok-health-row")].find((row) =>
      row.textContent?.includes("Contrast"),
    );
    expect(contrast, "Health block shows a Contrast row").not.toBeUndefined();
    expect(contrast!.textContent).toMatch(/\d+ of \d+ pairs pass AA/);
  });

  it("shows a Fonts row containing the system's first family when nothing is selected", async () => {
    const el = await renderSystem();
    const fonts = [...el.querySelectorAll(".tok-health-row")].find((row) =>
      row.textContent?.includes("Fonts"),
    );
    expect(fonts, "Health block shows a Fonts row").not.toBeUndefined();
    expect(fonts!.textContent).toContain("Satoshi");
  });

  it("shows a Tokens by kind row with per-kind counts", async () => {
    const el = await renderSystem();
    const kinds = [...el.querySelectorAll(".tok-health-row")].find((row) =>
      row.textContent?.includes("Tokens by kind"),
    );
    expect(kinds, "Health block shows a Tokens by kind row").not.toBeUndefined();
    expect(kinds!.textContent).toMatch(/\d+ color/);
    expect(kinds!.textContent).toMatch(/other/);
  });
});

function stubView(overrides: Record<string, unknown> = {}): TokensViewModel {
  return {
    cov: { groups: [], extra: [], expected: 2, present: 1, missing: 1, extraCount: 0 },
    selected: null,
    warnings: [],
    tokens: [],
    valueMap: new Map<string, string>(),
    copyToken: () => {},
    editingName: null,
    onEdit: () => {},
    pushToast: () => {},
    ...overrides,
  } as unknown as TokensViewModel;
}

async function renderView(view: TokensViewModel): Promise<HTMLElement> {
  const { createRoot } = await import("react-dom/client");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<TokensProps view={view} onPatch={noop} />);
  });
  return host;
}

/** Minimal shell frame: a topbar plus the one shared content scroller. */
function shellWith({ contrast = false, warns = false }: { contrast?: boolean; warns?: boolean }) {
  const topbar = document.createElement("div");
  topbar.className = "app-topbar";
  document.body.appendChild(topbar);
  const scroller = document.createElement("div");
  scroller.className = "app-main";
  document.body.appendChild(scroller);
  if (contrast) {
    const section = document.createElement("section");
    section.id = CONTRAST_SECTION_ID;
    scroller.appendChild(section);
  }
  if (warns) {
    const details = document.createElement("details");
    details.className = "tok-warns";
    scroller.appendChild(details);
  }
  const scrollTo = vi.fn();
  (scroller as unknown as { scrollTo: (opts: unknown) => void }).scrollTo = scrollTo;
  return { topbar, scroller, scrollTo };
}

function healthButton(el: HTMLElement, label: string): HTMLButtonElement {
  const row = [...el.querySelectorAll(".tok-health-row")].find((r) =>
    r.textContent?.includes(label),
  );
  expect(row, `${label} row renders`).not.toBeUndefined();
  const button = row!.querySelector("button");
  expect(button, `${label} row is clickable`).not.toBeNull();
  return button as HTMLButtonElement;
}

describe("TokensProps health navigation (issue #314)", () => {
  it("clicking Contrast scrolls the content region, leaving the topbar unmoved", async () => {
    const { topbar, scrollTo } = shellWith({ contrast: true });
    const before = topbar.getBoundingClientRect().top;
    const el = await renderView(stubView());
    await act(async () => {
      healthButton(el, "Contrast").click();
    });
    expect(scrollTo, "content scroller scrolls to the Contrast section").toHaveBeenCalledOnce();
    const [opts] = scrollTo.mock.calls[0] as [{ top: number }];
    expect(typeof opts.top).toBe("number");
    expect(Number.isNaN(opts.top)).toBe(false);
    expect(topbar.getBoundingClientRect().top, "topbar stays put").toBe(before);
  });

  it("the warnings count links to the gallery warnings details", async () => {
    const { scrollTo } = shellWith({ warns: true });
    const el = await renderView(
      stubView({ warnings: [{ name: "--color-bg", value: "#zzz", msg: "suspicious value" }] }),
    );
    await act(async () => {
      healthButton(el, "Value warnings").click();
    });
    expect(scrollTo, "content scroller scrolls to the warnings").toHaveBeenCalledOnce();
  });

  it("with a token selected the inspector stays on top and Health is folded", async () => {
    const el = await renderView(
      stubView({ selected: { name: "--space-1", value: "0.25rem" } }),
    );
    expect(el.querySelector(".tok-inspector"), "inspector renders").not.toBeNull();
    const folded = el.querySelector("details.tok-health-fold");
    expect(folded, "Health folds into a collapsed details").not.toBeNull();
    expect(folded!.hasAttribute("open"), "Health starts collapsed").toBe(false);
    // The inspector block precedes the folded Health block in the panel.
    const order = [...el.querySelectorAll(".tok-props-block h3, details.tok-health-fold")].map(
      (n) => n.textContent?.trim().split("\n")[0],
    );
    expect(order[0]).toBe("Coverage");
    expect(order[1]).toBe("Token");
  });
});
