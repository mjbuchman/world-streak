import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ROTATION, localToolsEnabled, runLocalTool } from "./localTools";

type Result = { data: unknown; error: { message: string } | null };

/** A client whose calls answer `results` in order, recording each call and its builder steps. */
function fakeDb(results: Result[]) {
  const calls: unknown[][][] = [];
  const builder = (log: unknown[][]): object => {
    const result = results.shift();
    const query: object = new Proxy(
      {},
      {
        get(_, method) {
          if (method === "then") return (resolve: (value: unknown) => void) => resolve(result);
          return (...args: unknown[]) => {
            log.push([method, ...args]);
            return query;
          };
        },
      },
    );
    return query;
  };
  const start = (first: unknown[]) => {
    const log: unknown[][] = [first];
    calls.push(log);
    return builder(log);
  };
  const db = {
    from: (table: string) => start(["from", table]),
    rpc: (name: string, args?: unknown) => start(args === undefined ? ["rpc", name] : ["rpc", name, args]),
  } as unknown as SupabaseClient;
  return { db, calls, results };
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
const OPEN = ok({ closed_at: null });
const CLOSED = ok({ closed_at: "2026-11-12T00:00:00Z" });
const NOBODY = ok({ attempts: 0 });

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321"));
afterEach(() => vi.unstubAllEnvs());

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
    expect(await runLocalTool(caller(), db, form({ tool: "restore-rotation" }), NOW)).toEqual({
      ok: false,
      message: "Local tools work only with the local Supabase.",
    });
    expect(calls).toEqual([]);
  });

  it("refuses a caller who is not an admin", async () => {
    const { db, calls } = fakeDb([]);
    expect(await runLocalTool(caller(false), db, form({ tool: "restore-rotation" }), NOW)).toEqual({
      ok: false,
      message: "Only admins can use local tools.",
    });
    expect(calls).toEqual([]);
  });

  it.each([
    [{ tool: "drop-tables" }],
    [{ tool: "set-challenge", gameDate: "2026-11-12", challenge: "chess" }],
    [{ tool: "reset-day", gameDate: "tomorrow" }],
  ])("refuses an unknown tool or bad input: %o", async (fields) => {
    const { db, calls } = fakeDb([]);
    expect((await runLocalTool(caller(), db, form(fields), NOW)).ok).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("set-challenge", () => {
  const setTo = (challenge: string) => form({ tool: "set-challenge", gameDate: "2026-11-13", challenge });

  it("gives an unstarted open day the challenge and its pass target, marked edited", async () => {
    const { db, calls } = fakeDb([ok(), OPEN, NOBODY, ok({ current: 4, best: 9 }), ok(15), ok()]);
    expect(await runLocalTool(caller(), db, setTo("flash-count"), NOW)).toEqual({ ok: true, message: "Nov 13, 2026 is now Swift Sum." });
    expect(calls[0]).toEqual([["rpc", "ensure_game_day", { d: "2026-11-13" }]]);
    expect(calls[4]).toEqual([["rpc", "pass_target_for", { challenge: "flash-count", d: "2026-11-13", streak: 4 }]]);
    expect(calls[5]).toEqual([
      ["from", "game_days"],
      ["update", { challenge_type: "flash-count", pass_target: 15, edited: true }],
      ["eq", "game_date", "2026-11-13"],
      ["is", "closed_at", null],
    ]);
  });

  it("refuses a started day, so no attempt is left on another challenge", async () => {
    const { db, calls } = fakeDb([ok(), OPEN, ok({ attempts: 2 })]);
    expect(await runLocalTool(caller(), db, setTo("stacking"), NOW)).toEqual({
      ok: false,
      message: "Nov 13, 2026 has started. Reset it first, then change its challenge.",
    });
    expect(calls).toHaveLength(3);
  });

  it("refuses a closed day", async () => {
    const { db } = fakeDb([ok(), CLOSED, NOBODY]);
    expect((await runLocalTool(caller(), db, setTo("stacking"), NOW)).message).toBe("Nov 13, 2026 has closed, so its challenge can no longer change.");
  });

  it("refuses a day that does not exist", async () => {
    const { db } = fakeDb([ok(), ok(null), ok(null)]);
    expect(await runLocalTool(caller(), db, setTo("stacking"), NOW)).toEqual({ ok: false, message: "Unknown game day." });
  });

  it("throws when the database fails, rather than claiming success", async () => {
    const { db } = fakeDb([{ data: null, error: { message: "boom" } }]);
    await expect(runLocalTool(caller(), db, setTo("stacking"), NOW)).rejects.toThrow("Preparing the game day failed: boom");
  });
});

describe("clear-my-attempt", () => {
  const clear = form({ tool: "clear-my-attempt" });
  const counters = ok({ attempts: 5, passes: 3, weighted_attempts: "4.5", weighted_passes: "2.5" });

  it("deletes the caller's attempt today and takes a pass back out of the counters", async () => {
    const { db, calls } = fakeDb([ok({ id: "a-1", passed: true, counted_weight: "0.5" }), counters, ok(), ok()]);
    expect(await runLocalTool(caller(), db, clear, NOW)).toEqual({ ok: true, message: "Your attempt today is gone. You can play again." });
    expect(calls[0]).toEqual([
      ["from", "attempts"],
      ["select", "id, passed, counted_weight"],
      ["eq", "user_id", "user-1"],
      ["eq", "game_date", "2026-11-12"],
      ["maybeSingle"],
    ]);
    expect(calls[2]).toEqual([["from", "attempts"], ["delete"], ["eq", "id", "a-1"]]);
    expect(calls[3]).toEqual([
      ["from", "game_day_counters"],
      ["update", { attempts: 4, passes: 2, weighted_attempts: 4, weighted_passes: 2 }],
      ["eq", "game_date", "2026-11-12"],
    ]);
  });

  it("takes only the attempt back for a fail or an unfinished run", async () => {
    const { db, calls } = fakeDb([ok({ id: "a-1", passed: null, counted_weight: 1 }), counters, ok(), ok()]);
    await runLocalTool(caller(), db, clear, NOW);
    expect(calls[3][1]).toEqual(["update", { attempts: 4, passes: 3, weighted_attempts: 3.5, weighted_passes: 2.5 }]);
  });

  it("says so when there is nothing to clear", async () => {
    const { db, calls } = fakeDb([ok(null)]);
    expect(await runLocalTool(caller(), db, clear, NOW)).toEqual({ ok: false, message: "You have no attempt today." });
    expect(calls).toHaveLength(1);
  });

  it("asks a caller whose session has gone to sign in again", async () => {
    const { db, calls } = fakeDb([]);
    expect((await runLocalTool(caller(true, null), db, clear, NOW)).ok).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("reset-day", () => {
  const reset = form({ tool: "reset-day", gameDate: "2026-11-12" });

  it("deletes the day's attempts, zeroes its counters and puts it back on the rotation", async () => {
    const { db, calls } = fakeDb([OPEN, ok({ attempts: 7 }), ok(), ok(), ok(), ok()]);
    expect(await runLocalTool(caller(), db, reset, NOW)).toEqual({
      ok: true,
      message: "Nov 12, 2026 is reset: no attempts, and it follows the rotation again.",
    });
    expect(calls.slice(2)).toEqual([
      [["from", "attempts"], ["delete"], ["eq", "game_date", "2026-11-12"]],
      [["from", "game_day_counters"], ["update", { attempts: 0, passes: 0, weighted_attempts: 0, weighted_passes: 0 }], ["eq", "game_date", "2026-11-12"]],
      [["from", "game_days"], ["update", { edited: false }], ["eq", "game_date", "2026-11-12"], ["is", "closed_at", null]],
      [["rpc", "ensure_game_day", { d: "2026-11-12" }]],
    ]);
  });

  it("refuses a closed day, which the streak already counts", async () => {
    const { db, calls } = fakeDb([CLOSED, NOBODY]);
    expect(await runLocalTool(caller(), db, reset, NOW)).toEqual({
      ok: false,
      message: "Nov 12, 2026 has closed and the streak counts it, so it cannot be reset.",
    });
    expect(calls).toHaveLength(2);
  });
});

describe("restore-rotation", () => {
  it("puts every challenge back in turn", async () => {
    const { db, calls } = fakeDb([ok()]);
    expect(await runLocalTool(caller(), db, form({ tool: "restore-rotation" }), NOW)).toEqual({
      ok: true,
      message: "The rotation is back to Teetering Tower, Second Sense, Swift Sum.",
    });
    expect(calls[0]).toEqual([["from", "game_settings"], ["update", { rotation: DEFAULT_ROTATION }], ["eq", "id", true]]);
    expect(DEFAULT_ROTATION).toEqual(["stacking", "inner-clock", "flash-count"]);
  });
});
