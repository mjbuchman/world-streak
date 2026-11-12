// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrizeSummary } from "@/lib/prize";

const readPrizeSummary = vi.hoisted(() => vi.fn<(db: unknown, now: Date, signedIn: boolean) => Promise<PrizeSummary | null>>());
const getClaims = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({ auth: { getClaims } })) }));
vi.mock("@/lib/prize", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/prize")>()), readPrizeSummary }));

import { PrizeCycle, PrizePanel } from "./PrizeCycle";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  readPrizeSummary.mockReset();
  getClaims.mockReset();
});

const region = () => screen.getByRole("region", { name: "Prize" });
const cycle = (over: Partial<Extract<PrizeSummary, { kind: "cycle" }>> = {}): PrizeSummary => ({
  kind: "cycle",
  number: 1,
  day: 10,
  length: 60,
  prizeCents: 20_000,
  rolloverInCents: 0,
  goalReachedOn: null,
  entries: null,
  ...over,
});

describe("PrizePanel", () => {
  it("shows this cycle's prize, the day and the goal", () => {
    render(<PrizePanel summary={cycle()} />);
    expect(region().textContent).toBe("Prize this cycle: $200Day 10 of 60Goal: a 30-day world streak");
  });

  it("names the rollover inside the prize, and the player's entries when signed in", () => {
    render(<PrizePanel summary={cycle({ prizeCents: 40_000, rolloverInCents: 20_000, entries: 4 })} />);
    expect(screen.getByText("Prize this cycle: $400, including $200 rolled over")).toBeTruthy();
    expect(screen.getByText("Your entries this cycle: 4")).toBeTruthy();
  });

  it("says when the goal was reached and that a winner comes after the cycle, instead of the goal", () => {
    render(<PrizePanel summary={cycle({ goalReachedOn: "2027-01-30" })} />);
    expect(screen.getByText("Goal reached on Jan 30, 2027. A winner will be drawn after the cycle ends.")).toBeTruthy();
    expect(screen.queryByText("Goal: a 30-day world streak")).toBeNull();
  });

  it("before the first cycle, says when it starts and the prize", () => {
    render(<PrizePanel summary={{ kind: "preseason", firstStart: "2027-01-01", prizeCents: 20_000 }} />);
    expect(region().textContent).toBe("The first cycle starts January 1, 2027. Prize: $200.");
  });

  it("shows nothing between cycles or after a failed read", () => {
    const { container } = render(<PrizePanel summary={null} />);
    expect(container.textContent).toBe("");
  });
});

describe("PrizeCycle", () => {
  it("reads the summary for a signed-in player, with their entries", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });
    readPrizeSummary.mockResolvedValue(cycle({ entries: 2 }));
    render(await PrizeCycle());
    expect(readPrizeSummary).toHaveBeenCalledWith(expect.anything(), expect.any(Date), true);
    expect(screen.getByText("Your entries this cycle: 2")).toBeTruthy();
  });

  it("reads it signed out without entries", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    readPrizeSummary.mockResolvedValue(cycle());
    render(await PrizeCycle());
    expect(readPrizeSummary).toHaveBeenCalledWith(expect.anything(), expect.any(Date), false);
  });

  it("shows nothing, rather than an error page, when the read fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getClaims.mockResolvedValue({ data: null, error: null });
    readPrizeSummary.mockRejectedValue(new Error("down"));
    const { container } = render(await PrizeCycle());
    expect(container.textContent).toBe("");
    expect(console.error).toHaveBeenCalled();
  });
});
