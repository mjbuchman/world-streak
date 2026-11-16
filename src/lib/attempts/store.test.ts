import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { supabaseAttemptStore } from "./store";

type Result = { data: unknown; error: { code?: string; message: string } | null };

/**
 * A stand-in for the Supabase client: every query builder call is recorded, and awaiting the
 * query (or an rpc) resolves to the given result.
 */
function fakeDb(result: Result) {
  const calls: unknown[][] = [];
  const query: object = new Proxy(
    {},
    {
      get(_, method) {
        if (method === "then") return (resolve: (value: Result) => void) => resolve(result);
        return (...args: unknown[]) => {
          calls.push([method, ...args]);
          return query;
        };
      },
    },
  );
  const db = {
    from: (table: string) => {
      calls.push(["from", table]);
      return query;
    },
    rpc: async (name: string, args: unknown) => {
      calls.push(["rpc", name, args]);
      return result;
    },
  };
  return { store: supabaseAttemptStore(db as unknown as SupabaseClient), calls };
}

const failure: Result = { data: null, error: { message: "connection refused" } };

describe("supabaseAttemptStore", () => {
  it("hasProfile looks the player up by id", async () => {
    const found = fakeDb({ data: { id: "u1" }, error: null });
    expect(await found.store.hasProfile("u1")).toBe(true);
    expect(found.calls).toEqual([["from", "profiles"], ["select", "id"], ["eq", "id", "u1"], ["maybeSingle"]]);
    expect(await fakeDb({ data: null, error: null }).store.hasProfile("u1")).toBe(false);
  });

  it("ensureGameDay calls the ensure_game_day function", async () => {
    const { store, calls } = fakeDb({ data: null, error: null });
    await store.ensureGameDay("2026-11-08");
    expect(calls).toEqual([["rpc", "ensure_game_day", { d: "2026-11-08" }]]);
  });

  it("gameDay reads the lineup in order with each target as a number, and whether the day is closed", async () => {
    // PostgREST returns numeric columns as JSON numbers or strings depending on size; embedded
    // rows come in no particular order.
    const games = [
      { position: 2, challenge_type: "inner-clock", pass_target: "4" },
      { position: 1, challenge_type: "stacking", pass_target: 10 },
      { position: 3, challenge_type: "flash-count", pass_target: 7.5 },
    ];
    const open = fakeDb({ data: { closed_at: null, game_day_games: games }, error: null });
    expect(await open.store.gameDay("2026-11-08")).toEqual({
      closed: false,
      games: [
        { position: 1, challengeType: "stacking", passTarget: 10 },
        { position: 2, challengeType: "inner-clock", passTarget: 4 },
        { position: 3, challengeType: "flash-count", passTarget: 7.5 },
      ],
    });
    expect(open.calls).toEqual([
      ["from", "game_days"],
      ["select", "closed_at, game_day_games(position, challenge_type, pass_target)"],
      ["eq", "game_date", "2026-11-08"],
      ["maybeSingle"],
    ]);
    const closed = fakeDb({ data: { closed_at: "2026-11-09T00:00:05+00:00", game_day_games: [] }, error: null });
    expect(await closed.store.gameDay("2026-11-08")).toEqual({ closed: true, games: [] });
    expect(await fakeDb({ data: null, error: null }).store.gameDay("2026-11-08")).toBeNull();
  });

  it.each([null, "abc", ""])("gameDay throws on a malformed pass target (%j) instead of returning NaN or 0", async (passTarget) => {
    const games = [{ position: 1, challenge_type: "stacking", pass_target: passTarget }];
    const { store } = fakeDb({ data: { closed_at: null, game_day_games: games }, error: null });
    await expect(store.gameDay("2026-11-08")).rejects.toThrow(/pass_target/);
  });

  it("dayAttempts reads the player's attempts that day in order, with each stored result", async () => {
    const rows = [
      { position: 1, score: "7", passed: false, submitted_at: "2026-11-08T10:00:00Z" },
      { position: 2, score: 12, passed: true, submitted_at: "2026-11-08T10:05:00Z" },
      { position: 3, score: null, passed: null, submitted_at: null },
    ];
    const { store, calls } = fakeDb({ data: rows, error: null });
    expect(await store.dayAttempts("u1", "2026-11-08")).toEqual([
      { position: 1, submitted: true, score: 7, passed: false },
      { position: 2, submitted: true, score: 12, passed: true },
      { position: 3, submitted: false },
    ]);
    expect(calls).toEqual([
      ["from", "attempts"],
      ["select", "position, score, passed, submitted_at"],
      ["eq", "user_id", "u1"],
      ["eq", "game_date", "2026-11-08"],
      ["order", "position"],
    ]);
    expect(await fakeDb({ data: [], error: null }).store.dayAttempts("u1", "2026-11-08")).toEqual([]);
  });

  it("dayAttempts throws on a malformed stored score", async () => {
    const row = { position: 1, score: null, passed: true, submitted_at: "2026-11-08T10:00:00Z" };
    await expect(fakeDb({ data: [row], error: null }).store.dayAttempts("u1", "2026-11-08")).rejects.toThrow(/score/);
  });

  it("dayResult reads the player's day, or an empty one before their first start", async () => {
    const { store, calls } = fakeDb({ data: { wins: 2, losses: 1, outcome: "passed" }, error: null });
    expect(await store.dayResult("u1", "2026-11-08")).toEqual({ wins: 2, losses: 1, outcome: "passed" });
    expect(calls).toEqual([
      ["from", "day_results"],
      ["select", "wins, losses, outcome"],
      ["eq", "user_id", "u1"],
      ["eq", "game_date", "2026-11-08"],
      ["maybeSingle"],
    ]);
    const undecided = fakeDb({ data: { wins: 0, losses: 1, outcome: null }, error: null });
    expect(await undecided.store.dayResult("u1", "2026-11-08")).toEqual({ wins: 0, losses: 1, outcome: null });
    expect(await fakeDb({ data: null, error: null }).store.dayResult("u1", "2026-11-08")).toEqual({ wins: 0, losses: 0, outcome: null });
  });

  it("dayResult throws on an outcome it does not know", async () => {
    const { store } = fakeDb({ data: { wins: 2, losses: 0, outcome: "survived" }, error: null });
    await expect(store.dayResult("u1", "2026-11-08")).rejects.toThrow(/survived/);
  });

  it("findAttemptById throws on a seed that is not a whole number", async () => {
    const row = { user_id: "u1", game_date: "2026-11-08", position: 1, seed: "42", started_at: "2026-11-08T12:00:00+00:00", submitted_at: null };
    await expect(fakeDb({ data: row, error: null }).store.findAttemptById("a1")).rejects.toThrow(/seed/);
  });

  it("insertAttempt stores the game's position and the seed, and returns the new id", async () => {
    const { store, calls } = fakeDb({ data: { id: "attempt-1" }, error: null });
    expect(await store.insertAttempt({ userId: "u1", gameDate: "2026-11-08", position: 2, seed: 42 })).toEqual({ id: "attempt-1" });
    expect(calls).toEqual([
      ["from", "attempts"],
      ["insert", { user_id: "u1", game_date: "2026-11-08", position: 2, seed: 42 }],
      ["select", "id"],
      ["single"],
    ]);
  });

  it("insertAttempt reports a unique violation as a duplicate", async () => {
    const { store } = fakeDb({ data: null, error: { code: "23505", message: "duplicate key" } });
    expect(await store.insertAttempt({ userId: "u1", gameDate: "2026-11-08", position: 1, seed: 42 })).toBe("duplicate");
  });

  it("insertAttempt reports the database's closed-day refusal (WS001) as day-closed", async () => {
    const { store } = fakeDb({ data: null, error: { code: "WS001", message: "game day 2026-11-08 is closed" } });
    expect(await store.insertAttempt({ userId: "u1", gameDate: "2026-11-08", position: 1, seed: 42 })).toBe("day-closed");
  });

  it("findAttemptById reads the attempt's owner, day, game, seed, start time and submission state", async () => {
    const row = { user_id: "u1", game_date: "2026-11-08", position: 2, seed: 42, started_at: "2026-11-08T12:00:00+00:00", submitted_at: null };
    const { store, calls } = fakeDb({ data: row, error: null });
    expect(await store.findAttemptById("a1")).toEqual({
      userId: "u1",
      gameDate: "2026-11-08",
      position: 2,
      seed: 42,
      startedAt: new Date("2026-11-08T12:00:00Z"),
      submitted: false,
    });
    expect(calls).toEqual([
      ["from", "attempts"],
      ["select", "user_id, game_date, position, seed, started_at, submitted_at"],
      ["eq", "id", "a1"],
      ["maybeSingle"],
    ]);

    const submitted = fakeDb({ data: { ...row, submitted_at: "2026-11-08T12:01:00+00:00" }, error: null });
    expect((await submitted.store.findAttemptById("a1"))?.submitted).toBe(true);
    expect(await fakeDb({ data: null, error: null }).store.findAttemptById("a1")).toBeNull();
  });

  it("recordResult calls record_attempt_result and returns its status", async () => {
    const { store, calls } = fakeDb({ data: "recorded", error: null });
    const result = { attemptId: "a1", inputs: { tapsMs: [900] }, score: 3, passed: false };
    expect(await store.recordResult(result)).toBe("recorded");
    expect(calls).toEqual([
      ["rpc", "record_attempt_result", { p_attempt_id: "a1", p_inputs: { tapsMs: [900] }, p_score: 3, p_passed: false }],
    ]);
  });

  it("recentScores reads the player's scored attempts before that day, newest first, with their challenge", async () => {
    const { store, calls } = fakeDb({
      data: [
        { score: "0.004", challenge_type: "inner-clock" },
        { score: 7, challenge_type: "stacking" },
      ],
      error: null,
    });
    expect(await store.recentScores("u1", "2026-11-08")).toEqual([
      { challengeType: "inner-clock", score: 0.004 },
      { challengeType: "stacking", score: 7 },
    ]);
    expect(calls).toEqual([
      ["from", "attempts"],
      ["select", "score, challenge_type"],
      ["eq", "user_id", "u1"],
      ["lt", "game_date", "2026-11-08"],
      ["not", "score", "is", null],
      ["order", "game_date", { ascending: false }],
      ["limit", 20],
    ]);
  });

  it("recordFlags calls record_cheat_flags", async () => {
    const { store, calls } = fakeDb({ data: null, error: null });
    await store.recordFlags("a1", ["timing-mismatch"]);
    expect(calls).toEqual([["rpc", "record_cheat_flags", { p_attempt_id: "a1", p_reasons: ["timing-mismatch"] }]]);
  });

  it("refuses a status word it does not know, rather than guessing", async () => {
    const { store } = fakeDb({ data: "maybe", error: null });
    await expect(store.recordResult({ attemptId: "a1", inputs: {}, score: 0, passed: false })).rejects.toThrow(/maybe/);
  });

  it("throws on any other database error, naming the operation, so the endpoint answers 500", async () => {
    const { store } = fakeDb(failure);
    await expect(store.hasProfile("u1")).rejects.toThrow("Profile lookup failed: connection refused");
    await expect(store.ensureGameDay("2026-11-08")).rejects.toThrow("ensure_game_day failed: connection refused");
    await expect(store.gameDay("2026-11-08")).rejects.toThrow("Game day lookup failed: connection refused");
    await expect(store.dayAttempts("u1", "2026-11-08")).rejects.toThrow("Day attempts lookup failed: connection refused");
    await expect(store.dayResult("u1", "2026-11-08")).rejects.toThrow("Day result lookup failed: connection refused");
    await expect(store.insertAttempt({ userId: "u1", gameDate: "2026-11-08", position: 1, seed: 1 })).rejects.toThrow(
      "Attempt insert failed: connection refused",
    );
    await expect(store.findAttemptById("a1")).rejects.toThrow("Attempt lookup by id failed: connection refused");
    await expect(store.recordResult({ attemptId: "a1", inputs: {}, score: 0, passed: false })).rejects.toThrow(
      "record_attempt_result failed: connection refused",
    );
    await expect(store.recentScores("u1", "2026-11-08")).rejects.toThrow("Recent scores lookup failed: connection refused");
    await expect(store.recordFlags("a1", ["timing-mismatch"])).rejects.toThrow("record_cheat_flags failed: connection refused");
  });
});
