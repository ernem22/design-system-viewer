// @vitest-environment happy-dom
/**
 * RED on the parent for issue #226 (a11y slice of audit #127): gallery
 * screen demos — table headers, labels, progress names, locale formatting.
 *
 * Fails on the parent commit where `Progress.Root` has no accessible name
 * (dashboard, files, onboarding, upload), `<th>` cells have no `scope`
 * (analytics, billing, table, team) and the settings `Switch`es are
 * unlabelled. Companion assertions pin the rest of the issue's findings
 * (chat label + curly apostrophe, checkout cc-* autocomplete, dashboard
 * hover trigger focusability, inbox listbox, login/signup autocomplete +
 * spellcheck, marketing img dimensions + labelled group, settings delete
 * confirm, viz chart name) and the shown values the Intl.* formatting must
 * keep.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { act } from "react";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import AnalyticsBody from "./analytics.tsx";
import BillingBody from "./billing.tsx";
import ChatBody from "./chat.tsx";
import CheckoutBody from "./checkout.tsx";
import DashboardBody from "./dashboard.tsx";
import FilesBody from "./files.tsx";
import InboxBody from "./inbox.tsx";
import LoginBody from "./login.tsx";
import MarketingBody from "./marketing.tsx";
import OnboardingBody from "./onboarding.tsx";
import PricingBody from "./pricing.tsx";
import ScheduleBody from "./schedule.tsx";
import SettingsBody from "./settings.tsx";
import SignupBody from "./signup.tsx";
import TableBody from "./table.tsx";
import TeamBody from "./team.tsx";
import UploadBody from "./upload.tsx";
import VizBody from "./viz.tsx";

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

async function click(el: Element | null) {
  expect(el, "click target renders").not.toBeNull();
  await act(async () => {
    (el as HTMLElement).click();
  });
}

function progressNames(el: Element): (string | null)[] {
  return [...el.querySelectorAll('[role="progressbar"]')].map((p) =>
    p.getAttribute("aria-label") ?? p.getAttribute("aria-labelledby"),
  );
}

function switchNames(el: Element): (string | null)[] {
  return [...el.querySelectorAll('[role="switch"]')].map(
    (s) => s.getAttribute("aria-label") ?? s.getAttribute("aria-labelledby") ?? s.textContent,
  );
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  document.body.innerHTML = "";
});

describe("issue #226 RED: progress names, header scope, switch names", () => {
  it("names every Progress.Root", async () => {
    for (const [name, node] of [
      ["dashboard", <DashboardBody />],
      ["files", <FilesBody />],
      ["onboarding", <OnboardingBody />],
      ["upload", <UploadBody />],
    ] as const) {
      const el = await mount(node);
      const bars = el.querySelectorAll('[role="progressbar"]');
      expect(bars.length, `${name} renders a progressbar`).toBeGreaterThan(0);
      for (const label of progressNames(el)) {
        expect(label, `${name} progressbar has an accessible name`).toBeTruthy();
      }
      act(() => root?.unmount());
      root = null;
      host?.remove();
      host = null;
    }
  });

  it("gives every demo table header a scope", async () => {
    for (const [name, node] of [
      ["analytics", <AnalyticsBody />],
      ["billing", <BillingBody />],
      ["table", <TableBody />],
      ["team", <TeamBody />],
    ] as const) {
      const el = await mount(node);
      const headers = el.querySelectorAll("th");
      expect(headers.length, `${name} renders headers`).toBeGreaterThan(0);
      for (const th of headers) {
        expect(th.getAttribute("scope"), `${name} <th> has scope`).toBeTruthy();
      }
      act(() => root?.unmount());
      root = null;
      host?.remove();
      host = null;
    }
  });

  it("labels every settings Switch on every tab", async () => {
    const el = await mount(<SettingsBody />);
    const tabs = ["General", "Notifications", "Appearance"] as const;
    for (const tab of tabs) {
      const trigger = [...el.querySelectorAll('[role="tab"]')].find(
        (t) => t.textContent?.trim() === tab,
      );
      await click(trigger ?? null);
      const switches = el.querySelectorAll('[role="switch"]');
      expect(switches.length, `${tab} tab renders a switch`).toBeGreaterThan(0);
      for (const label of switchNames(el)) {
        expect((label ?? "").trim(), `${tab} switch has an accessible name`).toBeTruthy();
      }
    }
  });
});

describe("issue #226: labels, autocomplete, grouping, confirm, chart name", () => {
  it("labels the chat composer and uses a curly apostrophe", async () => {
    const el = await mount(<ChatBody />);
    const input = el.querySelector("input[placeholder]");
    expect(input?.getAttribute("aria-label"), "chat input has a label").toBeTruthy();
    expect(el.textContent, "curly apostrophe").toContain("Let’s");
  });

  it("uses payment autocomplete on checkout", async () => {
    const el = await mount(<CheckoutBody />);
    expect(el.querySelector("#c-name")?.getAttribute("autocomplete"), "cc-name").toBe("cc-name");
    expect(el.querySelector("#c-num")?.getAttribute("autocomplete"), "cc-number").toBe(
      "cc-number",
    );
  });

  it("makes the dashboard hover trigger focusable", async () => {
    const el = await mount(<DashboardBody />);
    const trigger = el.querySelector("button[aria-label^='Contributor']");
    expect(trigger, "hover trigger is a labelled button").not.toBeNull();
  });

  it("puts inbox options inside a listbox", async () => {
    const el = await mount(<InboxBody />);
    const options = el.querySelectorAll('[role="listbox"] [role="option"]');
    expect(options.length, "options inside a listbox").toBeGreaterThan(0);
  });

  it("sets login autocomplete and spellcheck", async () => {
    const el = await mount(<LoginBody />);
    const email = el.querySelector("#l-email") as HTMLInputElement | null;
    const pass = el.querySelector("#l-pass");
    expect(email?.getAttribute("autocomplete"), "email autocomplete").toBe("email");
    expect(email?.getAttribute("spellcheck"), "email spellcheck off").toBe("false");
    expect(pass?.getAttribute("autocomplete"), "password autocomplete").toBeTruthy();
  });

  it("sizes the marketing hero img and labels the logo group", async () => {
    const el = await mount(<MarketingBody />);
    const img = el.querySelector(".dsv-hero-img img");
    expect(img?.getAttribute("width"), "hero img width").toBeTruthy();
    expect(img?.getAttribute("height"), "hero img height").toBeTruthy();
    const group = el.querySelector('[aria-label="Trusted by"]');
    expect(group?.getAttribute("role"), "trusted-by has a landmark role").toBeTruthy();
    expect(group?.querySelectorAll('[role="listitem"]').length, "four logos").toBe(4);
  });

  it("confirms the settings workspace delete", async () => {
    const el = await mount(<SettingsBody />);
    await click([...el.querySelectorAll("button")].find((b) => b.textContent === "Delete…") ?? null);
    expect(
      el.querySelector("button") && [...el.querySelectorAll("button")].some((b) =>
        /confirm/i.test(b.textContent ?? ""),
      ),
      "a confirm step appears",
    ).toBe(true);
  });

  it("sets signup invite spellcheck and autocomplete", async () => {
    const el = await mount(<SignupBody />);
    const input = el.querySelector("#s-inv");
    expect(input?.getAttribute("spellcheck"), "invite spellcheck off").toBe("false");
    expect(input?.getAttribute("autocomplete"), "invite autocomplete off").toBe("off");
  });

  it("names the viz chart instead of title-only values", async () => {
    const el = await mount(<VizBody />);
    const chart = el.querySelector('[role="img"]');
    expect(chart?.getAttribute("aria-label"), "chart has an accessible name").toBeTruthy();
  });
});

describe("issue #226: Intl.* keeps the shown values", () => {
  it("keeps the rendered literals", async () => {
    const cases: [string, React.ReactNode, string[]] [] = [
      ["analytics", <AnalyticsBody />, ["128.402", "54.190", "2d 41s"]],
      ["billing", <BillingBody />, ["Due Jun 30", "₺264.00", "₺316.80"]],
      ["dashboard", <DashboardBody />, ["1.284"]],
      ["pricing", <PricingBody />, ["₺12"]],
      ["schedule", <ScheduleBody />, ["June 2026"]],
      ["table", <TableBody />, ["₺1.200"]],
    ];
    for (const [name, node, literals] of cases) {
      const el = await mount(node);
      for (const literal of literals) {
        expect(el.textContent, `${name} still shows ${literal}`).toContain(literal);
      }
      act(() => root?.unmount());
      root = null;
      host?.remove();
      host = null;
    }
  });

  it("formats the listed literals with Intl.*", () => {
    const sources: [string, string][] = [
      ["analytics", read("./analytics.tsx")],
      ["billing", read("./billing.tsx")],
      ["dashboard", read("./dashboard.tsx")],
      ["pricing", read("./pricing.tsx")],
      ["schedule", read("./schedule.tsx")],
      ["table", read("./table.tsx")],
    ];
    for (const [name, src] of sources) {
      expect(src, `${name} uses Intl.*`).toContain("Intl.");
    }
  });
});
