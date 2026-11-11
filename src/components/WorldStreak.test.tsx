// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecentDay, StreakSummary } from "@/lib/streak/streak";

const readStreakSummary = vi.hoisted(() => vi.fn<() => Promise<StreakSummary>>());
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/streak/streak", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/streak/streak")>()),
  readStreakSummary,
}));

import { StreakPanel, WorldStreak } from "./WorldStreak";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const region = () => screen.getByRole("region", { name: "World streak" });

// 14 days ending Nov 14: twelve with no result, a broken day, then a survived day in the run.
const empty = (d: number): RecentDay => ({ gameDate: `2026-11-${String(d).padStart(2, "0")}`, kind: "empty", passRate: null, threshold: null, outcome: null });
const recent: RecentDay[] = [
  ...Array.from({ length: 12 }, (_, i) => empty(i + 1)),
  { gameDate: "2026-11-13", kind: "broke", passRate: 0.52, threshold: 0.6, outcome: "broken" },
  { gameDate: "2026-11-14", kind: "streak", passRate: 0.74, threshold: 0.6, outcome: "survived" },
];
const summary: StreakSummary = { current: 1, best: 4, yesterday: { outcome: "survived", finalPassRate: 0.74 }, recent };

describe("StreakPanel", () => {
  it("shows the streak with its unit, the best run, yesterday's result and a link to every day", () => {
    render(<StreakPanel summary={summary} />);
    expect(within(region()).getByText("World streak")).toBeTruthy();
    expect(within(region()).getByText("1").parentElement?.textContent).toBe("1 day");
    expect(within(region()).getByText("Best").textContent).toBe("Best 4");
    expect(within(region()).getByText("Yesterday the world survived with 74% passing")).toBeTruthy();
    expect(within(region()).getByRole("link", { name: "Every day so far" }).getAttribute("href")).toBe("/history");
  });

  it("draws one bar slot per day, oldest first, with the pass rate as the height and the threshold as a line", () => {
    const { container } = render(<StreakPanel summary={summary} />);
    const slots = [...container.querySelectorAll<HTMLElement>("[data-kind]")];
    expect(slots.map((slot) => slot.dataset.kind)).toEqual([...Array(12).fill("empty"), "broke", "streak"]);
    expect(slots[13].querySelector<HTMLElement>("[data-bar]")?.style.height).toBe("74%");
    expect(slots[13].querySelector<HTMLElement>("[data-line]")?.style.bottom).toBe("60%");
    expect(slots[12].querySelector<HTMLElement>("[data-bar]")?.style.height).toBe("52%");
    expect(slots[0].querySelector("[data-bar]")).toBeNull();
    expect(slots[0].querySelector("[data-line]")).toBeNull();
    expect(within(region()).getByText("14 days ago")).toBeTruthy();
    expect(within(region()).getByText("Yesterday")).toBeTruthy();
  });

  it("lists the same days for screen readers, while the bars themselves are hidden from them", () => {
    const { container } = render(<StreakPanel summary={summary} />);
    const list = within(region()).getByRole("list", { name: "The last 14 days" });
    const items = within(list).getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toHaveLength(14);
    expect(items[0]).toBe("Nov 1, 2026: no result");
    expect(items.slice(12)).toEqual(["Nov 13, 2026: 52% passed, 60% needed, broke the streak", "Nov 14, 2026: 74% passed, 60% needed, survived"]);
    expect(container.querySelector("[data-kind]")?.closest("[aria-hidden='true']")).toBeTruthy();
  });

  it("colours the run mint, the breaking day light tangerine and other days muted, from tokens", () => {
    const css = readFileSync(path.join(import.meta.dirname, "WorldStreak.module.css"), "utf8");
    expect(css).toMatch(/\.bar \{[^}]*background: var\(--fs-bar-closed\);/);
    expect(css).toMatch(/\[data-kind="streak"\] \.bar \{\s*background: var\(--fs-gradient-mint\);/);
    expect(css).toMatch(/\[data-kind="broke"\] \.bar \{\s*background: var\(--fs-bar-broke\);/);
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b|rgba\(/i);
  });

  it("says days for any streak but one", () => {
    render(<StreakPanel summary={{ ...summary, current: 0, yesterday: null }} />);
    expect(within(region()).getByText("0").parentElement?.textContent).toBe("0 days");
  });

  it("leaves out yesterday until it has closed", () => {
    render(<StreakPanel summary={{ ...summary, yesterday: null }} />);
    expect(region().textContent).not.toMatch(/Yesterday the/);
  });

  it("says when the streak cannot be read", () => {
    render(<StreakPanel summary={null} />);
    expect(within(region()).getByText("The world streak is unavailable right now.")).toBeTruthy();
  });
});

describe("WorldStreak", () => {
  it("reads the streak on the server", async () => {
    readStreakSummary.mockResolvedValue({ ...summary, current: 0, best: 2, yesterday: { outcome: "broken", finalPassRate: 0.52 } });
    render(await WorldStreak());
    expect(screen.getByText("Best").textContent).toBe("Best 2");
    expect(screen.getByText("Yesterday the streak broke at 52%")).toBeTruthy();
  });

  it("shows the streak as unavailable, not an error page, when the read fails", async () => {
    readStreakSummary.mockRejectedValue(new Error("down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    render(await WorldStreak());
    expect(screen.getByText("The world streak is unavailable right now.")).toBeTruthy();
    expect(logged).toHaveBeenCalledWith(new Error("down"));
  });
});
