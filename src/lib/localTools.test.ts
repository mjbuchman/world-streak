import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, type FakeResult as Result } from "@/lib/testing/fakeSupabase";
import { DEFAULT_POOL, localToolsEnabled, MAX_SEED_PLAYERS, runLocalTool, type DevData } from "./localTools";

/** A client whose calls answer `results` in order, recording each call and its builder steps. */
function fakeDb(results: Result[]) {
  const { db, queries } = fakeSupabase(results);
  return { db, calls: queries, results };
}

const ok = (data: unknown = null): Result => ({ data, error: null });

/** The signed-in caller: their admin answer and their user. */
function caller(admin = true, userId: string | null = "user-1") {
  const { db } = fakeDb([ok(admin)]);
  return Object.assign(db, {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) },
  }) as unknown as SupabaseClient;
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

const NOW = new Date("2026-11-12T15:00:00Z");

/** The fake-data steps, answering as the real ones would. */
function fakeData(over: Partial<DevData> = {}): DevData {
  return {
    seed: vi.fn(async () => "Seeded 10 players for 2026-11-12: 7 passed, 3 did not."),
    closeDay: vi.fn(async () => "2026-11-11 survived. World streak: 3 (best 5)."),
    removeFakePlayers: vi.fn(async () => 42),
    ...over,
  };
}
const OPEN = ok({ closed_at: null });
const CLOSED = ok({ closed_at: "2026-11-12T00:00:00Z" });
const NOBODY = ok({ attempts: 0 });

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321"));
afterEach(() => vi.unstubAllEnvs());

describe("every tool shows a failed step as a refusal (T120)", () => {
  const boom = { data: null, error: { message: "boom" } };
  it.each([
    ["clear-my-day", {}, "Deleting your games failed: boom"],
    ["reset-day", { gameDate: "2026-11-12" }, "Game day lookup failed: boom"],
    ["restore-pool", {}, "Saving the pool failed: boom"],
  ])("%s", async (tool, fields, message) => {
    const { db } = fakeDb([boom, boom]);
    expect(await runLocalTool(caller(), db, form({ tool, ...fields }), NOW, fakeData())).toEqual({ ok: false, message });
  });

  it("remove-fake-players", async () => {
    const data = fakeData({ removeFakePlayers: vi.fn(async () => Promise.reject(new Error("Listing users failed: boom"))) });
    expect(await runLocalTool(caller(), fakeDb([]).db, form({ tool: "remove-fake-players" }), NOW, data)).toEqual({
      ok: false,
      message: "Listing users failed: boom",
    });
    const plain = fakeData({ removeFakePlayers: vi.fn(async () => Promise.reject("plain")) });
    expect(await runLocalTool(caller(), fakeDb([]).db, form({ tool: "remove-fake-players" }), NOW, plain)).toEqual({ ok: false, message: "plain" });
  });
});

describe("localToolsEnabled", () => {
  it("is on only for the local Supabase", () => {
    expect(localToolsEnabled("http://127.0.0.1:54321")).toBe(true);
    expect(localToolsEnabled("http://localhost:54321")).toBe(true);
    expect(localToolsEnabled("https://abc.supabase.co")).toBe(false);
    expect(localToolsEnabled("")).toBe(false);
  });

  it("reads the app's own Supabase URL by default", () => {
    expect(localToolsEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    expect(localToolsEnabled()).toBe(false);
  });
});

describe("runLocalTool guards", () => {
  it("refuses with a real project, before checking anything else or touching data", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    const { db, calls } = fakeDb([]);
    expect(await runLocalTool(caller(), db, form({ tool: "restore-pool" }), NOW, fakeData())).toEqual({
      ok: false,
      message: "Local tools work only with the local Supabase.",
    });
    expect(calls).toEqual([]);
  });

  it("refuses a caller who is not an admin", async () => {
    const { db, calls } = fakeDb([]);
    expect(await runLocalTool(caller(false), db, form({ tool: "restore-pool" }), NOW, fakeData())).toEqual({
      ok: false,
      message: "Only admins can use local tools.",
    });
    expect(calls).toEqual([]);
  });

  it.each([
    [{ tool: "drop-tables" }],
    [{ tool: "set-lineup", gameDate: "2026-11-12", game1: "chess", game2: "echo-path", game3: "fair-split" }],
    [{ tool: "set-challenge", gameDate: "2026-11-12", challenge: "stacking" }],
    [{ tool: "reset-day", gameDate: "tomorrow" }],
  ])("refuses an unknown tool or bad input: %o", async (fields) => {
    const { db, calls } = fakeDb([]);
    expect((await runLocalTool(caller(), db, form(fields), NOW, fakeData())).ok).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("set-lineup", () => {
  const setTo = (game1: string, game2 = "echo-path", game3 = "fair-split") =>
    form({ tool: "set-lineup", gameDate: "2026-11-13", game1, game2, game3 });
  const OPEN_DAY = ok({ closed_at: null, survival_threshold: "0.65" });

  it("gives an unstarted open day the three games with their pass targets, through the admin save", async () => {
    const { db, calls } = fakeDb([ok(), OPEN_DAY, NOBODY, ok({ current: 4, best: 9 }), ok(15), ok("6"), ok(7), ok(true)]);
    expect(await runLocalTool(caller(), db, setTo("flash-count"), NOW, fakeData())).toEqual({
      ok: true,
      message: "Nov 13, 2026 is now Swift Sum, Trail Trace, Clean Cut.",
    });
    expect(calls[0]).toEqual([["rpc", "ensure_game_day", { d: "2026-11-13" }]]);
    expect(calls.slice(4, 7)).toEqual([
      [["rpc", "pass_target_for", { challenge: "flash-count", d: "2026-11-13", streak: 4 }]],
      [["rpc", "pass_target_for", { challenge: "echo-path", d: "2026-11-13", streak: 4 }]],
      [["rpc", "pass_target_for", { challenge: "fair-split", d: "2026-11-13", streak: 4 }]],
    ]);
    // save_game_day keeps the day's threshold and marks it edited, so the lineup rule leaves it alone.
    expect(calls[7]).toEqual([
      ["rpc", "save_game_day", { d: "2026-11-13", games: ["flash-count", "echo-path", "fair-split"], targets: [15, 6, 7], threshold: 0.65 }],
    ]);
    expect(calls).toHaveLength(8);
  });

  it("refuses the same game twice before touching anything", async () => {
    const { db, calls } = fakeDb([]);
    expect(await runLocalTool(caller(), db, setTo("echo-path"), NOW, fakeData())).toEqual({
      ok: false,
      message: "Pick three different games.",
    });
    expect(calls).toEqual([]);
  });

  it("refuses a started day, so no game is left on another challenge", async () => {
    const { db, calls } = fakeDb([ok(), OPEN_DAY, ok({ attempts: 2 })]);
    expect(await runLocalTool(caller(), db, setTo("stacking"), NOW, fakeData())).toEqual({
      ok: false,
      message: "Nov 13, 2026 has started. Reset it first, then change its lineup.",
    });
    expect(calls).toHaveLength(3);
  });

  it("refuses a closed day", async () => {
    const { db } = fakeDb([ok(), CLOSED, NOBODY]);
    expect((await runLocalTool(caller(), db, setTo("stacking"), NOW, fakeData())).message).toBe(
      "Nov 13, 2026 has closed, so its lineup can no longer change.",
    );
  });

  it("refuses a day that does not exist", async () => {
    const { db } = fakeDb([ok(), ok(null), ok(null)]);
    expect(await runLocalTool(caller(), db, setTo("stacking"), NOW, fakeData())).toEqual({ ok: false, message: "Unknown game day." });
  });

  it("says so when the save changed nothing (the day closed meanwhile)", async () => {
    const { db } = fakeDb([ok(), OPEN_DAY, NOBODY, ok({ current: 0, best: 0 }), ok(10), ok(6), ok(7), ok(false)]);
    expect(await runLocalTool(caller(), db, setTo("stacking"), NOW, fakeData())).toEqual({
      ok: false,
      message: "Nov 13, 2026 could not be saved; it may have closed.",
    });
  });

  it("shows a database failure as a refusal, rather than claiming success", async () => {
    const { db } = fakeDb([{ data: null, error: { message: "boom" } }]);
    expect(await runLocalTool(caller(), db, setTo("stacking"), NOW, fakeData())).toEqual({
      ok: false,
      message: "Preparing the game day failed: boom",
    });
  });
});

describe("clear-my-day", () => {
  const clear = form({ tool: "clear-my-day" });

  it("deletes all the caller's games today (their day result goes with them) and recounts the day", async () => {
    const { db, calls } = fakeDb([ok([{ id: "a-1" }, { id: "a-2" }, { id: "a-3" }]), ok()]);
    expect(await runLocalTool(caller(), db, clear, NOW, fakeData())).toEqual({
      ok: true,
      message: "Your day is cleared (3 games). You can play it again.",
    });
    expect(calls).toEqual([
      [["from", "attempts"], ["delete"], ["eq", "user_id", "user-1"], ["eq", "game_date", "2026-11-12"], ["select", "id"]],
      [["rpc", "recount_game_day", { d: "2026-11-12" }]],
    ]);
  });

  it("counts a single game in the singular", async () => {
    const { db } = fakeDb([ok([{ id: "a-1" }]), ok()]);
    expect((await runLocalTool(caller(), db, clear, NOW, fakeData())).message).toBe("Your day is cleared (1 game). You can play it again.");
  });

  it("says so when there is nothing to clear, without recounting", async () => {
    const { db, calls } = fakeDb([ok([])]);
    expect(await runLocalTool(caller(), db, clear, NOW, fakeData())).toEqual({ ok: false, message: "You have not played today." });
    expect(calls).toHaveLength(1);
  });

  it("asks a caller whose session has gone to sign in again", async () => {
    const { db, calls } = fakeDb([]);
    expect((await runLocalTool(caller(true, null), db, clear, NOW, fakeData())).ok).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("reset-day", () => {
  const reset = form({ tool: "reset-day", gameDate: "2026-11-12" });

  it("deletes the day's attempts (and day results), recounts it to zero and puts it back on the lineup rule", async () => {
    const { db, calls } = fakeDb([OPEN, ok({ attempts: 7 }), ok(), ok(), ok(), ok()]);
    expect(await runLocalTool(caller(), db, reset, NOW, fakeData())).toEqual({
      ok: true,
      message: "Nov 12, 2026 is reset: no attempts, and it follows the lineup rule again.",
    });
    expect(calls.slice(2)).toEqual([
      [["from", "attempts"], ["delete"], ["eq", "game_date", "2026-11-12"]],
      [["rpc", "recount_game_day", { d: "2026-11-12" }]],
      [["from", "game_days"], ["update", { edited: false }], ["eq", "game_date", "2026-11-12"], ["is", "closed_at", null]],
      [["rpc", "ensure_game_day", { d: "2026-11-12" }]],
    ]);
  });

  it("refuses a closed day, which the streak already counts", async () => {
    const { db, calls } = fakeDb([CLOSED, NOBODY]);
    expect(await runLocalTool(caller(), db, reset, NOW, fakeData())).toEqual({
      ok: false,
      message: "Nov 12, 2026 has closed and the streak counts it, so it cannot be reset.",
    });
    expect(calls).toHaveLength(2);
  });
});

describe("restore-pool", () => {
  it("puts every game back in the pool", async () => {
    const { db, calls } = fakeDb([ok()]);
    expect(await runLocalTool(caller(), db, form({ tool: "restore-pool" }), NOW, fakeData())).toEqual({
      ok: true,
      message: "The pool is back to Teetering Tower, Second Sense, Swift Sum, Trail Trace, Clean Cut.",
    });
    expect(calls[0]).toEqual([["from", "game_settings"], ["update", { pool: [...DEFAULT_POOL] }], ["eq", "id", true]]);
    expect(DEFAULT_POOL).toEqual(["stacking", "inner-clock", "flash-count", "echo-path", "fair-split"]);
  });
});

describe("seed", () => {
  const seed = (fields: Record<string, string> = {}) =>
    form({ tool: "seed", gameDate: "2026-11-12", players: "10", passPercent: "70", ...fields });

  it("seeds the players with the pass rate as a fraction and says what it did", async () => {
    const data = fakeData();
    const { db, calls } = fakeDb([]);
    expect(await runLocalTool(caller(), db, seed(), NOW, data)).toEqual({
      ok: true,
      message: "Seeded 10 players for 2026-11-12: 7 passed, 3 did not.",
    });
    expect(data.seed).toHaveBeenCalledExactlyOnceWith({ players: 10, passRate: 0.7, date: "2026-11-12" });
    expect(calls).toEqual([]);
  });

  it.each([
    [{ players: "0" }, `Players must be from 1 to ${MAX_SEED_PLAYERS}.`],
    [{ players: String(MAX_SEED_PLAYERS + 1) }, `Players must be from 1 to ${MAX_SEED_PLAYERS}.`],
    [{ players: "2.5" }, "Players must be a whole number."],
    [{ passPercent: "101" }, "The pass rate must be from 0% to 100%."],
    [{ passPercent: "-1" }, "The pass rate must be from 0% to 100%."],
  ])("refuses %o before seeding anything", async (fields, message) => {
    const data = fakeData();
    expect(await runLocalTool(caller(), fakeDb([]).db, seed(fields), NOW, data)).toEqual({ ok: false, message });
    expect(data.seed).not.toHaveBeenCalled();
  });

  it("shows the seed's own refusal, for example a closed day", async () => {
    const data = fakeData({ seed: vi.fn(async () => Promise.reject(new Error("Game day 2026-11-12 is already closed; seed an open day instead."))) });
    expect(await runLocalTool(caller(), fakeDb([]).db, seed(), NOW, data)).toEqual({
      ok: false,
      message: "Game day 2026-11-12 is already closed; seed an open day instead.",
    });
  });
});

describe("close-day", () => {
  it("closes a day past its deadline and shows the outcome and streak", async () => {
    const data = fakeData();
    expect(await runLocalTool(caller(), fakeDb([]).db, form({ tool: "close-day", gameDate: "2026-11-11" }), NOW, data)).toEqual({
      ok: true,
      message: "2026-11-11 survived. World streak: 3 (best 5).",
    });
    expect(data.closeDay).toHaveBeenCalledExactlyOnceWith("2026-11-11");
  });

  it.each(["2026-11-12", "2026-11-13"])("refuses %s, which has not reached its deadline", async (gameDate) => {
    const data = fakeData();
    expect(await runLocalTool(caller(), fakeDb([]).db, form({ tool: "close-day", gameDate }), NOW, data)).toEqual({
      ok: false,
      message: expect.stringMatching(/has not reached its deadline yet, so it cannot close\.$/),
    });
    expect(data.closeDay).not.toHaveBeenCalled();
  });

  it("shows the database's refusal, for example an earlier day still open", async () => {
    const data = fakeData({ closeDay: vi.fn(async () => Promise.reject(new Error("Close failed: an earlier game day is still open; close days in order"))) });
    expect((await runLocalTool(caller(), fakeDb([]).db, form({ tool: "close-day", gameDate: "2026-11-11" }), NOW, data)).message).toBe(
      "Close failed: an earlier game day is still open; close days in order",
    );
  });
});

describe("remove-fake-players", () => {
  it("removes them and says how many", async () => {
    const data = fakeData();
    expect(await runLocalTool(caller(), fakeDb([]).db, form({ tool: "remove-fake-players" }), NOW, data)).toEqual({
      ok: true,
      message: "Removed 42 fake players.",
    });
    expect(data.removeFakePlayers).toHaveBeenCalledOnce();
  });
});
