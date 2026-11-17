import { describe, expect, it } from "vitest";
import { fakeSupabase, type FakeResult as Result } from "@/lib/testing/fakeSupabase";
import { ADMIN_DAYS_AHEAD, isAdmin, readAdminDays } from "./admin";

/** A client whose calls answer `results` in order, recording each call and its builder steps. */
function fakeDb(results: Result[]) {
  const { db, queries } = fakeSupabase(results);
  return { db, calls: queries };
}

describe("isAdmin", () => {
  it("asks the database, as the signed-in caller, whether they are an admin", async () => {
    const { db, calls } = fakeDb([{ data: true, error: null }]);
    expect(await isAdmin(db)).toBe(true);
    expect(calls).toEqual([[["rpc", "is_admin"]]]);
  });

  it.each([false, null, "true", 1])("is not an admin unless the answer is exactly true (%j)", async (data) => {
    const { db } = fakeDb([{ data, error: null }]);
    expect(await isAdmin(db)).toBe(false);
  });

  it("throws when the check fails, so the page errors instead of guessing", async () => {
    const { db } = fakeDb([{ data: null, error: { message: "down" } }]);
    await expect(isAdmin(db)).rejects.toThrow("Admin check failed: down");
  });
});

describe("readAdminDays", () => {
  const ok = { data: null, error: null };
  // The lineup out of position order, as an embed may return it.
  const row = (gameDate: string, closedAt: string | null = null) => ({
    game_date: gameDate,
    survival_threshold: "0.60",
    closed_at: closedAt,
    game_day_games: [
      { position: 3, challenge_type: "flash-count", pass_target: 15 },
      { position: 1, challenge_type: "stacking", pass_target: "10" },
      { position: 2, challenge_type: "inner-clock", pass_target: "0.5" },
    ],
  });
  const lineup = (started: [boolean, boolean, boolean] = [false, false, false]) => [
    { position: 1, challengeType: "stacking", passTarget: 10, started: started[0] },
    { position: 2, challengeType: "inner-clock", passTarget: 0.5, started: started[1] },
    { position: 3, challengeType: "flash-count", passTarget: 15, started: started[2] },
  ];

  const ensured = Array.from({ length: 8 }, () => ok);
  const noneStarted = { data: [], error: null };

  it("makes sure today and the next 7 days exist, then reads them in date order", async () => {
    const days = Array.from({ length: ADMIN_DAYS_AHEAD + 1 }, (_, i) => row(`2026-11-${String(11 + i).padStart(2, "0")}`));
    const { db, calls } = fakeDb([...ensured, { data: days, error: null }, noneStarted]);
    const result = await readAdminDays(db, new Date("2026-11-11T09:00:00Z"));

    expect(calls.slice(0, 8).map(([first]) => first)).toEqual(
      ["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18"].map((d) => [
        "rpc",
        "ensure_game_day",
        { d },
      ]),
    );
    expect(calls[8]).toEqual([
      ["from", "game_days"],
      ["select", "game_date, survival_threshold, closed_at, game_day_games(position, challenge_type, pass_target)"],
      ["gte", "game_date", "2026-11-11"],
      ["lte", "game_date", "2026-11-18"],
      ["order", "game_date", { ascending: true }],
    ]);
    expect(calls[9]).toEqual([["rpc", "started_games", { first_day: "2026-11-11", last_day: "2026-11-18" }]]);
    expect(result).toHaveLength(8);
    expect(result[0]).toEqual({
      gameDate: "2026-11-11",
      games: lineup(),
      threshold: 0.6,
      closed: false,
      started: false,
    });
  });

  it.each([
    ["2026-11-11T23:59:59Z", "2026-11-11"],
    ["2026-11-12T00:00:00Z", "2026-11-12"],
  ])("starts from the game day being played at %s, not the server's calendar date", async (now, first) => {
    const { db, calls } = fakeDb([...ensured, { data: [], error: null }, noneStarted]);
    await readAdminDays(db, new Date(now));
    expect(calls[0]).toEqual([["rpc", "ensure_game_day", { d: first }]]);
  });

  it("marks a closed day", async () => {
    const { db } = fakeDb([...ensured, { data: [row("2026-11-11", "2026-11-12T00:00:05Z")], error: null }, noneStarted]);
    expect((await readAdminDays(db, new Date("2026-11-11T09:00:00Z")))[0].closed).toBe(true);
  });

  it("marks only the games, and so the days, somebody has started", async () => {
    const days = [row("2026-11-11"), row("2026-11-12"), row("2026-11-13")];
    const starts = [
      { game_date: "2026-11-12", game_position: 1 },
      { game_date: "2026-11-12", game_position: 2 },
      { game_date: "2026-11-13", game_position: 3 },
    ];
    const { db } = fakeDb([...ensured, { data: days, error: null }, { data: starts, error: null }]);
    const result = await readAdminDays(db, new Date("2026-11-11T09:00:00Z"));
    expect(result.map((day) => day.started)).toEqual([false, true, true]);
    expect(result.map((day) => day.games)).toEqual([lineup(), lineup([true, true, false]), lineup([false, false, true])]);
  });

  it("throws when a day cannot be prepared or read, or a number is malformed", async () => {
    const failsEnsure = fakeDb([{ data: null, error: { message: "no settings" } }, ...ensured.slice(1)]);
    await expect(readAdminDays(failsEnsure.db, new Date())).rejects.toThrow("Preparing game days failed: no settings");

    const failsRead = fakeDb([...ensured, { data: null, error: { message: "down" } }, noneStarted]);
    await expect(readAdminDays(failsRead.db, new Date())).rejects.toThrow("Game day lookup failed: down");

    const failsStarts = fakeDb([...ensured, { data: [row("2026-11-11")], error: null }, { data: null, error: { message: "denied" } }]);
    await expect(readAdminDays(failsStarts.db, new Date())).rejects.toThrow("Start lookup failed: denied");

    const badTarget = { ...row("2026-11-11"), game_day_games: [{ position: 1, challenge_type: "stacking", pass_target: "x" }] };
    const malformed = fakeDb([...ensured, { data: [badTarget], error: null }, noneStarted]);
    await expect(readAdminDays(malformed.db, new Date())).rejects.toThrow(/pass_target/);

    const badGame = { ...row("2026-11-11"), game_day_games: [{ position: 1, challenge_type: "chess", pass_target: 1 }] };
    const unknown = fakeDb([...ensured, { data: [badGame], error: null }, noneStarted]);
    await expect(readAdminDays(unknown.db, new Date())).rejects.toThrow();
  });
});
