// @vitest-environment happy-dom
/**
 * RED for issue #319: Preview avatars load from pravatar.cc and fall back
 * to numbers like "22" instead of initials.
 *
 * Fails on the parent where `Avat` renders an `<Avatar.Image>` pointing at
 * `https://i.pravatar.cc/...` with a `String(n).slice(0, 2)` fallback, so
 * the Team screen shows avatars labelled "13", "22", "31".
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { act } from "react";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import ChatBody from "./chat.tsx";
import DashboardBody from "./dashboard.tsx";
import KanbanBody from "./kanban.tsx";
import ProfileBody from "./profile.tsx";
import { Avat } from "./screenBits.tsx";
import TeamBody from "./team.tsx";

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

describe("issue #319: avatars are self-contained initials", () => {
  it("has no pravatar.cc URL in the avatar files", () => {
    const sources: [string, string][] = [
      ["screenBits", read("./screenBits.tsx")],
      ["team", read("./team.tsx")],
      ["kanban", read("./kanban.tsx")],
      ["dashboard", read("./dashboard.tsx")],
      ["chat", read("./chat.tsx")],
      ["profile", read("./profile.tsx")],
      ["patterns", read("../patterns.tsx")],
      ["layout", read("../layout.tsx")],
    ];
    for (const [name, src] of sources) {
      expect(src, `${name} has no pravatar.cc URL`).not.toContain("pravatar.cc");
    }
  });

  it('shows initials "AL" in the Team member row for "Ada Lovelace"', async () => {
    const el = await mount(<TeamBody />);
    const row = [...el.querySelectorAll("tbody tr")].find((tr) =>
      tr.textContent?.includes("Ada Lovelace"),
    );
    expect(row, "Ada Lovelace row renders").toBeDefined();
    expect(row?.textContent, "row shows initials AL").toContain("AL");
  });

  it("renders initials from the name with a chart-palette background", async () => {
    const el = await mount(<Avat name="Ada Lovelace" />);
    const avatar = el.querySelector(".dsv-avatar");
    expect(avatar?.textContent, "initials render").toContain("AL");
    expect(avatar?.getAttribute("style"), "chart palette background").toMatch(
      /--color-chart-[1-8]/,
    );
    expect(el.querySelector("img"), "no remote image").toBeNull();
  });

  it("shows initials, not numbers, on every screen with an avatar", async () => {
    const cases: [string, React.ReactNode, string[]][] = [
      ["team", <TeamBody />, ["AL", "GH", "AT"]],
      ["chat", <ChatBody />, ["GH"]],
      ["kanban", <KanbanBody />, ["AL"]],
      ["profile", <ProfileBody />, ["AL"]],
      ["dashboard", <DashboardBody />, ["AL", "GH", "AT"]],
    ];
    for (const [name, node, initials] of cases) {
      const el = await mount(node);
      expect(el.querySelector("img[src*='pravatar']"), `${name} has no pravatar image`).toBeNull();
      for (const text of initials) {
        expect(el.textContent, `${name} shows ${text}`).toContain(text);
      }
      const numericFallbacks = [...el.querySelectorAll(".dsv-avatar")].filter((slot) => {
        const label = slot.textContent?.trim() ?? "";
        return /^\d+$/.test(label) && !slot.classList.contains("dsv-avatar-more");
      });
      expect(numericFallbacks, `${name} has no numeric avatar`).toHaveLength(0);
      act(() => root?.unmount());
      root = null;
      host?.remove();
      host = null;
    }
  });
});
