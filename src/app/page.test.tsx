// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The meter, the prize and the streak panel have their own tests; here they are stand-ins.
vi.mock("@/components/WorldStreak", () => ({ WorldStreak: () => <section aria-label="World streak" /> }));
vi.mock("@/components/PrizeCycle", () => ({ PrizeCycle: () => <section aria-label="Prize" /> }));
vi.mock("@/components/Meter", () => ({ Meter: () => <section aria-label="Today's meter" /> }));
const m = vi.hoisted(() => ({ getClaims: vi.fn(), todaysLineup: vi.fn(), todaysDay: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({ auth: { getClaims: m.getClaims } })) }));
vi.mock("@/lib/attempts/today", () => ({ todaysLineup: m.todaysLineup, todaysDay: m.todaysDay, DEFAULT_CHALLENGE: "stacking" }));

import Home from "./page";

const lineup = ["stacking", "flash-count", "inner-clock"];
const game = (position: number, status: string, score?: number) => ({
  position,
  challengeType: lineup[position - 1],
  passTarget: 5,
  status,
  ...(score === undefined ? {} : { score }),
});

/** Each listed game's name and status, in order. */
const listed = () =>
  within(screen.getByRole("region", { name: "Today's three games" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  m.getClaims.mockResolvedValue({ data: null });
  m.todaysLineup.mockResolvedValue(lineup);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("Home", () => {
  it("has the game name as its heading and the countdown in its header, before the meter", async () => {
    const { container } = render(await Home());
    expect(screen.getByRole("heading", { level: 1, name: "World Streak" })).toBeTruthy();
    const header = container.querySelector("main > header");
    expect(header?.querySelector('[role="timer"]')).toBeTruthy();
    expect(header?.nextElementSibling?.getAttribute("aria-label")).toBe("Today's meter");
  });

  it("puts the meter first, then today's games, the prize and the world streak", async () => {
    render(await Home());
    const order = screen.getAllByRole("region").map((region) => region.getAttribute("aria-label") ?? region.textContent);
    expect(order).toEqual(["Today's meter", expect.stringContaining("Today's three games"), "Prize", "World streak"]);
  });

  it("lists today's three games in order, all to play, for a visitor", async () => {
    render(await Home());
    expect(listed()).toEqual(["Teetering TowerTo play", "Swift SumTo play", "Second SenseTo play"]);
    expect(m.todaysDay).not.toHaveBeenCalled();
  });

  it("shows the signed-in player's progress, a game left unfinished as lost", async () => {
    m.getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    m.todaysDay.mockResolvedValue({ games: [game(1, "won", 12), game(2, "in-progress"), game(3, "not-started")] });
    render(await Home());
    expect(listed()).toEqual(["Teetering TowerWon", "Swift SumLost", "Second SenseTo play"]);
    expect(m.todaysDay).toHaveBeenCalledWith(expect.anything(), "u1", expect.any(Date));
    expect(m.todaysLineup).not.toHaveBeenCalled();
  });

  it("falls back to the lineup rule when the signed-in player's day does not exist yet", async () => {
    m.getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    m.todaysDay.mockResolvedValue({ games: [] });
    render(await Home());
    expect(listed()).toEqual(["Teetering TowerTo play", "Swift SumTo play", "Second SenseTo play"]);
  });

  it("shows the default game, not an error page, when today's cannot be read", async () => {
    m.todaysLineup.mockRejectedValue(new Error("down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    render(await Home());
    expect(listed()).toEqual(["Teetering TowerTo play"]);
    expect(logged).toHaveBeenCalledWith(new Error("down"));
    logged.mockRestore();
  });

  it("has an ad slot at the end of the page (T44)", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADS_PLACEHOLDER", "true");
    vi.stubEnv("NODE_ENV", "development");
    const { container } = render(await Home());
    expect(container.querySelector("main")?.lastElementChild?.getAttribute("data-ad-slot")).toBe("home");
  });
});
