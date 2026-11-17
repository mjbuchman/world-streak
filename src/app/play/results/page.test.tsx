import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getClaims: vi.fn(),
  todaysDay: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getClaims: m.getClaims } }) }));
vi.mock("@/lib/attempts/today", () => ({ todaysDay: m.todaysDay }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
// Stand-ins that show what they were given; the meter and share card fetch on their own.
vi.mock("@/components/Meter", () => ({ Meter: () => <section data-meter /> }));
vi.mock("@/components/ShareCard", () => ({ ShareCard: ({ passed }: { passed: boolean }) => <section data-share={String(passed)} /> }));
vi.mock("@/components/AdSlot", () => ({ AdSlot: ({ name }: { name: string }) => <div data-ad-slot={name} /> }));

import ResultsPage from "./page";

const render = async () => renderToStaticMarkup(await ResultsPage());
const lineup = [
  { position: 1, challengeType: "stacking", passTarget: 10 },
  { position: 2, challengeType: "flash-count", passTarget: 5 },
  { position: 3, challengeType: "inner-clock", passTarget: 4 },
];
const passedDay = {
  gameDate: "2026-11-08",
  games: [
    { ...lineup[0], status: "won", score: 12 },
    { ...lineup[1], status: "won", score: 6 },
    { ...lineup[2], status: "not-started" },
  ],
  wins: 2,
  losses: 0,
  outcome: "passed",
  nextPosition: 3,
};
const failedDay = {
  ...passedDay,
  games: [
    { ...lineup[0], status: "lost", score: 3 },
    { ...lineup[1], status: "in-progress" },
    { ...lineup[2], status: "won", score: 7 },
  ],
  wins: 1,
  losses: 2,
  outcome: "failed",
  nextPosition: null,
};

/** The text of each game row, in order. */
const rows = (html: string) =>
  [...html.matchAll(/<li[^>]*data-status="([^"]+)"[^>]*>(.*?)<\/li>/g)].map(([, status, inner]) => ({
    status,
    text: inner.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim(),
  }));

beforeEach(() => {
  vi.clearAllMocks();
  m.getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
  m.todaysDay.mockResolvedValue(passedDay);
});

describe("ResultsPage", () => {
  it("asks a signed-out visitor to sign in, without looking up a day", async () => {
    m.getClaims.mockResolvedValueOnce({ data: null });
    const html = await render();
    expect(html).toContain("Sign in to see your results for today.");
    expect(html).toContain('href="/signin"');
    expect(m.todaysDay).not.toHaveBeenCalled();
    expect(html).not.toContain("data-ad-slot");
  });

  it("sends a player whose day is not decided yet back to /play", async () => {
    m.todaysDay.mockResolvedValueOnce({ ...passedDay, wins: 1, outcome: null });
    await expect(ResultsPage()).rejects.toThrow(/^NEXT_REDIRECT \/play$/);
    expect(m.todaysDay).toHaveBeenCalledWith(expect.anything(), "u1", expect.any(Date));
  });

  it("shows a passed day's verdict and each game in order with its score, target and status", async () => {
    const html = await render();
    expect(html).toContain("You passed today: two wins");
    expect(rows(html)).toEqual([
      { status: "won", text: "Game 1: Teetering Tower Won You reached row 12. Today's target was row 10." },
      { status: "won", text: "Game 2: Swift Sum Won You scored 6 levels. Today's target was 5 levels." },
      { status: "not-started", text: "Game 3: Second Sense Not played Today's target was 4 rounds." },
    ]);
    // The remaining game is still offered.
    expect(html).toContain('href="/play"');
  });

  it("shows a failed day, with a game left unfinished as lost, and no game left to play", async () => {
    m.todaysDay.mockResolvedValueOnce(failedDay);
    const html = await render();
    expect(html).toContain("Not today: two losses");
    expect(html).toContain("1 win, 2 losses.");
    expect(rows(html).map((row) => row.text)).toEqual([
      "Game 1: Teetering Tower Lost You reached row 3. Today's target was row 10.",
      "Game 2: Swift Sum Lost Left before finishing. Today's target was 5 levels.",
      "Game 3: Second Sense Won You scored 7 rounds. Today's target was 4 rounds.",
    ]);
    expect(html).not.toContain('href="/play"');
  });

  it.each([
    [passedDay, "true"],
    [failedDay, "false"],
  ])("offers the share card for the day's outcome, then the meter, then the ad slot below everything", async (day, passed) => {
    m.todaysDay.mockResolvedValueOnce(day);
    const html = await render();
    expect(html).toContain(`data-share="${passed}"`);
    const [verdict, share, meter, ad] = ["<h2", "data-share", "data-meter", 'data-ad-slot="play-result"'].map((mark) => html.indexOf(mark));
    expect(verdict).toBeGreaterThanOrEqual(0);
    expect(verdict < share && share < meter && meter < ad).toBe(true);
  });
});
