import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { supabaseAttemptStore, supabaseSubmitStore } from "./store";

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
  const client = db as unknown as SupabaseClient;
  return { store: supabaseAttemptStore(client), submitStore: supabaseSubmitStore(client), calls };
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

  it("gameDayFor reads the day's challenge type and pass target (numeric arrives as a string)", async () => {
    const { store, calls } = fakeDb({ data: { challenge_type: "stacking", pass_target: "10" }, error: null });
    expect(await store.gameDayFor("2026-11-08")).toEqual({ challengeType: "stacking", passTarget: 10 });
    expect(calls).toEqual([
      ["from", "game_days"],
      ["select", "challenge_type, pass_target"],
      ["eq", "game_date", "2026-11-08"],
      ["single"],
    ]);
  });

  it("findAttempt reports whether the player's attempt that day was submitted", async () => {
    const open = fakeDb({ data: { submitted_at: null }, error: null });
    expect(await open.store.findAttempt("u1", "2026-11-08")).toEqual({ submitted: false });
    expect(open.calls).toEqual([
      ["from", "attempts"],
      ["select", "submitted_at"],
      ["eq", "user_id", "u1"],
      ["eq", "game_date", "2026-11-08"],
      ["maybeSingle"],
    ]);
    expect(await fakeDb({ data: { submitted_at: "2026-11-08T10:00:00Z" }, error: null }).store.findAttempt("u1", "2026-11-08")).toEqual({
      submitted: true,
    });
    expect(await fakeDb({ data: null, error: null }).store.findAttempt("u1", "2026-11-08")).toBeNull();
  });

  it("insertAttempt stores the seed and returns the new id", async () => {
    const { store, calls } = fakeDb({ data: { id: "attempt-1" }, error: null });
    expect(await store.insertAttempt({ userId: "u1", gameDate: "2026-11-08", seed: 42 })).toEqual({ id: "attempt-1" });
    expect(calls).toEqual([
      ["from", "attempts"],
      ["insert", { user_id: "u1", game_date: "2026-11-08", seed: 42 }],
      ["select", "id"],
      ["single"],
    ]);
  });

  it("insertAttempt reports a unique violation as a duplicate", async () => {
    const { store } = fakeDb({ data: null, error: { code: "23505", message: "duplicate key" } });
    expect(await store.insertAttempt({ userId: "u1", gameDate: "2026-11-08", seed: 42 })).toBe("duplicate");
  });

  it("throws on any other database error, so the endpoint answers 500", async () => {
    const { store } = fakeDb(failure);
    await expect(store.hasProfile("u1")).rejects.toThrow(/connection refused/);
    await expect(store.ensureGameDay("2026-11-08")).rejects.toThrow(/connection refused/);
    await expect(store.gameDayFor("2026-11-08")).rejects.toThrow(/connection refused/);
    await expect(store.findAttempt("u1", "2026-11-08")).rejects.toThrow(/connection refused/);
    await expect(store.insertAttempt({ userId: "u1", gameDate: "2026-11-08", seed: 1 })).rejects.toThrow(/connection refused/);
  });
});

describe("supabaseSubmitStore", () => {
  it("findAttempt reads the attempt's owner, day, seed, start time and submission state", async () => {
    const row = { user_id: "u1", game_date: "2026-11-08", seed: 42, started_at: "2026-11-08T12:00:00+00:00", submitted_at: null };
    const { submitStore, calls } = fakeDb({ data: row, error: null });
    expect(await submitStore.findAttempt("a1")).toEqual({
      userId: "u1",
      gameDate: "2026-11-08",
      seed: 42,
      startedAt: new Date("2026-11-08T12:00:00Z"),
      submitted: false,
    });
    expect(calls).toEqual([
      ["from", "attempts"],
      ["select", "user_id, game_date, seed, started_at, submitted_at"],
      ["eq", "id", "a1"],
      ["maybeSingle"],
    ]);

    const submitted = fakeDb({ data: { ...row, submitted_at: "2026-11-08T12:01:00+00:00" }, error: null });
    expect((await submitted.submitStore.findAttempt("a1"))?.submitted).toBe(true);
    expect(await fakeDb({ data: null, error: null }).submitStore.findAttempt("a1")).toBeNull();
  });

  it("gameDay reads the challenge, the target as a number, and whether the day is closed", async () => {
    // PostgREST returns numeric columns as JSON numbers or strings depending on size.
    const open = fakeDb({ data: { challenge_type: "stacking", pass_target: "10", closed_at: null }, error: null });
    expect(await open.submitStore.gameDay("2026-11-08")).toEqual({ challengeType: "stacking", passTarget: 10, closed: false });
    expect(open.calls).toEqual([
      ["from", "game_days"],
      ["select", "challenge_type, pass_target, closed_at"],
      ["eq", "game_date", "2026-11-08"],
      ["single"],
    ]);
    const closed = fakeDb({ data: { challenge_type: "stacking", pass_target: 7.5, closed_at: "2026-11-09T00:00:05+00:00" }, error: null });
    expect(await closed.submitStore.gameDay("2026-11-08")).toEqual({ challengeType: "stacking", passTarget: 7.5, closed: true });
  });

  it("recordResult calls record_attempt_result and returns its status", async () => {
    const { submitStore, calls } = fakeDb({ data: "recorded", error: null });
    const result = { attemptId: "a1", inputs: { tapsMs: [900] }, score: 3, passed: false };
    expect(await submitStore.recordResult(result)).toBe("recorded");
    expect(calls).toEqual([
      ["rpc", "record_attempt_result", { p_attempt_id: "a1", p_inputs: { tapsMs: [900] }, p_score: 3, p_passed: false }],
    ]);
  });

  it("refuses a status word it does not know, rather than guessing", async () => {
    const { submitStore } = fakeDb({ data: "maybe", error: null });
    await expect(submitStore.recordResult({ attemptId: "a1", inputs: {}, score: 0, passed: false })).rejects.toThrow(/maybe/);
  });

  it("throws on database errors, so the endpoint answers 500", async () => {
    const { submitStore } = fakeDb(failure);
    await expect(submitStore.findAttempt("a1")).rejects.toThrow(/connection refused/);
    await expect(submitStore.gameDay("2026-11-08")).rejects.toThrow(/connection refused/);
    await expect(submitStore.recordResult({ attemptId: "a1", inputs: {}, score: 0, passed: false })).rejects.toThrow(
      /connection refused/,
    );
  });
});
