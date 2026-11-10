import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { todaysAttempt } from "./today";

type Result = { data: unknown; error: { message: string } | null };

/** Records the query and resolves it to `result` (same approach as store.test.ts). */
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
    // The player's own client must only read; no database function runs on it.
    rpc: () => {
      throw new Error("todaysAttempt must not call an rpc");
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const userId = "u1";
// 23:30 UTC on Nov 8 is still game date Nov 8.
const now = new Date("2026-11-08T23:30:00Z");

describe("todaysAttempt", () => {
  it("is ready when the player has no attempt for today's game date", async () => {
    const { db, calls } = fakeDb({ data: null, error: null });
    expect(await todaysAttempt(db, userId, now)).toEqual({ kind: "ready" });
    expect(calls).toEqual([
      ["from", "attempts"],
      ["select", "score, passed, submitted_at, game_days(pass_target)"],
      ["eq", "user_id", userId],
      ["eq", "game_date", "2026-11-08"],
      ["maybeSingle"],
    ]);
  });

  it("gives the stored result, and the day's target, once the attempt was submitted", async () => {
    const row = { score: 7, passed: false, submitted_at: "2026-11-08T12:00:00+00:00", game_days: { pass_target: "10" } };
    const { db } = fakeDb({ data: row, error: null });
    expect(await todaysAttempt(db, userId, now)).toEqual({ kind: "submitted", score: 7, passed: false, passTarget: 10 });
  });

  it("keeps a stored pass as a pass", async () => {
    const row = { score: 12, passed: true, submitted_at: "2026-11-08T12:00:00+00:00", game_days: { pass_target: 10 } };
    const { db } = fakeDb({ data: row, error: null });
    expect(await todaysAttempt(db, userId, now)).toEqual({ kind: "submitted", score: 12, passed: true, passTarget: 10 });
  });

  it("looks up the game date at the deadline, not the calendar date", async () => {
    // One ms before the midnight UTC deadline is still Nov 8; the deadline itself is Nov 9.
    const before = fakeDb({ data: null, error: null });
    await todaysAttempt(before.db, userId, new Date("2026-11-08T23:59:59.999Z"));
    expect(before.calls).toContainEqual(["eq", "game_date", "2026-11-08"]);
    const at = fakeDb({ data: null, error: null });
    await todaysAttempt(at.db, userId, new Date("2026-11-09T00:00:00.000Z"));
    expect(at.calls).toContainEqual(["eq", "game_date", "2026-11-09"]);
  });

  it("is abandoned when the attempt was started but never submitted", async () => {
    const row = { score: null, passed: null, submitted_at: null, game_days: { pass_target: 10 } };
    const { db } = fakeDb({ data: row, error: null });
    expect(await todaysAttempt(db, userId, now)).toEqual({ kind: "abandoned" });
  });

  it("throws on a database error, rather than offering a Start that would fail", async () => {
    const { db } = fakeDb({ data: null, error: { message: "connection refused" } });
    await expect(todaysAttempt(db, userId, now)).rejects.toThrow(/connection refused/);
  });
});
