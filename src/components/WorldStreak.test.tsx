// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StreakSummary } from "@/lib/streak/streak";

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

describe("StreakPanel", () => {
  it("shows the streak, the best run and yesterday's result, with a link to every day", () => {
    render(<StreakPanel summary={{ current: 1, best: 4, yesterday: { outcome: "survived", finalPassRate: 0.74 } }} />);
    expect(within(region()).getByText("World streak: 1 day")).toBeTruthy();
    expect(within(region()).getByText("Best: 4")).toBeTruthy();
    expect(within(region()).getByText("Yesterday the world survived with 74% passing")).toBeTruthy();
    expect(within(region()).getByRole("link", { name: "Every day so far" }).getAttribute("href")).toBe("/history");
  });

  it("leaves out yesterday until it has closed", () => {
    render(<StreakPanel summary={{ current: 0, best: 0, yesterday: null }} />);
    expect(region().textContent).not.toMatch(/Yesterday/);
  });

  it("says when the streak cannot be read", () => {
    render(<StreakPanel summary={null} />);
    expect(within(region()).getByText("The world streak is unavailable right now.")).toBeTruthy();
  });
});

describe("WorldStreak", () => {
  it("reads the streak on the server", async () => {
    readStreakSummary.mockResolvedValue({ current: 0, best: 2, yesterday: { outcome: "broken", finalPassRate: 0.52 } });
    render(await WorldStreak());
    expect(screen.getByText("World streak: 0 days")).toBeTruthy();
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
