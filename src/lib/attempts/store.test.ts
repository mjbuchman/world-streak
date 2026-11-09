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

  it("challengeTypeFor reads the day's challenge type", async () => {
    const { store, calls } = fakeDb({ data: { challenge_type: "stacking" }, error: null });
    expect(await store.challengeTypeFor("2026-11-08")).toBe("stacking");
    expect(calls).toEqual([
      ["from", "game_days"],
      ["select", "challenge_type"],
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
    await expect(store.challengeTypeFor("2026-11-08")).rejects.toThrow(/connection refused/);
    await expect(store.findAttempt("u1", "2026-11-08")).rejects.toThrow(/connection refused/);
    await expect(store.insertAttempt({ userId: "u1", gameDate: "2026-11-08", seed: 1 })).rejects.toThrow(/connection refused/);
  });
});
