import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getClaims: vi.fn(),
  landingPath: vi.fn(),
  todaysDay: vi.fn(),
  todaysChallenge: vi.fn(),
  playToday: vi.fn<(props: unknown) => void>(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getClaims: m.getClaims } }) }));
vi.mock("@/lib/profiles", () => ({ landingPath: m.landingPath }));
vi.mock("@/lib/attempts/today", () => ({ todaysDay: m.todaysDay, todaysChallenge: m.todaysChallenge }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("./PlayToday", () => ({
  PlayToday: (props: unknown) => {
    m.playToday(props);
    return <div data-play-today />;
  },
}));

import PlayPage from "./page";

const render = async () => renderToStaticMarkup(await PlayPage());
const day = { gameDate: "2026-11-08", games: [], wins: 0, losses: 0, outcome: null, nextPosition: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  m.getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
  m.todaysChallenge.mockResolvedValue("stacking");
  m.landingPath.mockResolvedValue("/");
  m.todaysDay.mockResolvedValue(day);
});

describe("PlayPage", () => {
  it("asks a signed-out visitor to sign in, or to practice the first game, without looking up a day", async () => {
    m.getClaims.mockResolvedValueOnce({ data: null });
    const html = await render();
    expect(html).toContain("Sign in to play today&#x27;s three games.");
    expect(html).toContain('href="/signin"');
    expect(html).toContain('href="/practice/stacking"');
    expect(m.landingPath).not.toHaveBeenCalled();
    expect(m.todaysDay).not.toHaveBeenCalled();
    expect(html).not.toContain("data-play-today");
  });

  it("sends a signed-in player without a profile to complete it, before any day lookup", async () => {
    m.landingPath.mockResolvedValueOnce("/complete-profile");
    await expect(PlayPage()).rejects.toThrow(/^NEXT_REDIRECT \/complete-profile$/);
    expect(m.landingPath).toHaveBeenCalledWith(expect.anything(), "u1");
    expect(m.todaysDay).not.toHaveBeenCalled();
  });

  it("looks up the player's day and hands it, with the lineup's first game, to PlayToday", async () => {
    const decided = { ...day, wins: 2, outcome: "passed", nextPosition: 3 };
    m.todaysDay.mockResolvedValueOnce(decided);
    const html = await render();
    expect(m.todaysDay).toHaveBeenCalledWith(expect.anything(), "u1", expect.any(Date));
    expect(m.playToday).toHaveBeenCalledWith({ firstGame: "stacking", initial: decided });
    expect(html).toContain("data-play-today");
  });

  it("lets a failed day lookup reach the error page rather than hiding it", async () => {
    m.todaysDay.mockRejectedValueOnce(new Error("Day attempts lookup failed: timeout"));
    await expect(PlayPage()).rejects.toThrow("Day attempts lookup failed: timeout");
  });
});
