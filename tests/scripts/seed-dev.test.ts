import { describe, expect, it, vi } from "vitest";
// TypeScript maps the .mjs specifier to the .mts source.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertLocalSupabaseUrl,
  parseSeedArgs,
  passingIndices,
  runSeed,
  supabaseSeedDeps,
  type SeedDeps,
} from "../../scripts/seed-dev.mjs";

describe("assertLocalSupabaseUrl", () => {
  it.each(["http://127.0.0.1:54321", "http://localhost:54321"])("accepts %s", (url) => {
    expect(() => assertLocalSupabaseUrl(url)).not.toThrow();
  });

  it.each([
    "https://abcdefgh.supabase.co",
    "http://127.0.0.1.example.com:54321",
    "http://localhost.evil.test",
    "not a url",
    undefined,
    "",
  ])("refuses %s", (url) => {
    expect(() => assertLocalSupabaseUrl(url)).toThrow(/localhost|127\.0\.0\.1/);
  });
});

describe("parseSeedArgs", () => {
  it("reads players, pass rate and date", () => {
    expect(parseSeedArgs(["--players", "200", "--pass-rate", "0.7", "--date", "2026-11-07"])).toEqual({
      players: 200,
      passRate: 0.7,
      date: "2026-11-07",
    });
  });

  it("leaves the date for the database to fill in (today's game date) when it is not given", () => {
    expect(parseSeedArgs(["--players", "5", "--pass-rate", "1"])).toEqual({ players: 5, passRate: 1, date: null });
  });

  it.each([
    [["--pass-rate", "0.7"], /--players/],
    [["--players", "0", "--pass-rate", "0.7"], /--players/],
    [["--players", "2.5", "--pass-rate", "0.7"], /--players/],
    [["--players", "10001", "--pass-rate", "0.7"], /--players/],
    [["--players", "5"], /--pass-rate/],
    [["--players", "5", "--pass-rate", "1.2"], /--pass-rate/],
    [["--players", "5", "--pass-rate", "x"], /--pass-rate/],
    [["--players", "5", "--pass-rate", "0.5", "--date", "2026-13-01"], /--date/],
    [["--players", "5", "--pass-rate", "0.5", "--color", "red"], /color/],
  ])("refuses %j", (args, message) => {
    expect(() => parseSeedArgs(args)).toThrow(message);
  });
});

describe("passingIndices", () => {
  it("passes exactly round(players × rate) players", () => {
    expect(passingIndices(200, 0.7).size).toBe(140);
    expect(passingIndices(3, 0.5).size).toBe(2);
    expect(passingIndices(10, 0).size).toBe(0);
    expect(passingIndices(10, 1).size).toBe(10);
  });

  it("spreads the passes through the batch instead of bunching them at the start", () => {
    const passing = passingIndices(10, 0.5);
    expect([...passing].sort((a, b) => a - b)).toEqual([0, 2, 4, 6, 8]);
  });
});

function fakeDeps(overrides: Partial<SeedDeps> = {}): SeedDeps & { calls: string[] } {
  const calls: string[] = [];
  let users = 0;
  let attempts = 0;
  return {
    calls,
    todayGameDate: vi.fn(async () => "2026-11-08"),
    ensureGameDay: vi.fn(async (date: string) => void calls.push(`ensure ${date}`)),
    passTarget: vi.fn(async () => 10),
    createPlayer: vi.fn(async (email: string) => {
      calls.push(`player ${email}`);
      return `user-${++users}`;
    }),
    startAttempt: vi.fn(async (userId: string, date: string) => {
      calls.push(`start ${userId} ${date}`);
      return `attempt-${++attempts}`;
    }),
    recordResult: vi.fn(async (attemptId: string, score: number, passed: boolean) => {
      calls.push(`record ${attemptId} ${score} ${passed}`);
      return "recorded";
    }),
    writePastResult: vi.fn(async (attemptId: string, score: number, passed: boolean) => {
      calls.push(`write ${attemptId} ${score} ${passed}`);
    }),
    addPastPasses: vi.fn(async (date: string, passes: number) => void calls.push(`add ${date} ${passes}`)),
    log: vi.fn(),
    ...overrides,
  };
}

describe("runSeed", () => {
  it("creates fresh players with profiles and records today's results through record_attempt_result", async () => {
    const deps = fakeDeps();
    await runSeed({ players: 4, passRate: 0.5, date: null }, "run1", deps);

    expect(deps.calls[0]).toBe("ensure 2026-11-08");
    expect(deps.calls.filter((call) => call.startsWith("player "))).toEqual([
      "player seed-run1-1@example.test",
      "player seed-run1-2@example.test",
      "player seed-run1-3@example.test",
      "player seed-run1-4@example.test",
    ]);
    // Passing players score above the day's target of 10, the others below it.
    expect(deps.calls.filter((call) => call.startsWith("record "))).toEqual([
      "record attempt-1 11 true",
      "record attempt-2 9 false",
      "record attempt-3 11 true",
      "record attempt-4 9 false",
    ]);
    expect(deps.writePastResult).not.toHaveBeenCalled();
    expect(deps.addPastPasses).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenLastCalledWith("Seeded 4 players for 2026-11-08: 2 passed, 2 did not.");
  });

  it("writes another day's results directly and adds its passes to the counters once", async () => {
    // record_attempt_result only accepts today's game date, so a past day takes the direct path.
    const deps = fakeDeps();
    await runSeed({ players: 3, passRate: 1, date: "2026-11-07" }, "run2", deps);
    expect(deps.recordResult).not.toHaveBeenCalled();
    expect(deps.calls.filter((call) => call.startsWith("write "))).toHaveLength(3);
    expect(deps.calls.at(-1)).toBe("add 2026-11-07 3");
  });

  it("scores a fail at 0 rather than below it when the target is 0", async () => {
    const deps = fakeDeps({ passTarget: vi.fn(async () => 0) });
    await runSeed({ players: 1, passRate: 0, date: "2026-11-08" }, "run3", deps);
    expect(deps.recordResult).toHaveBeenCalledWith("attempt-1", 0, false);
  });

  it("uses the database's own game date when no date is given, and the given one otherwise", async () => {
    const today = fakeDeps();
    await runSeed({ players: 1, passRate: 1, date: null }, "run5", today);
    expect(today.ensureGameDay).toHaveBeenCalledWith("2026-11-08");
    expect(today.recordResult).toHaveBeenCalled();
  });

  it("stops with a clear error if a result is refused", async () => {
    const deps = fakeDeps({ recordResult: vi.fn(async () => "day-closed") });
    await expect(runSeed({ players: 2, passRate: 1, date: "2026-11-08" }, "run4", deps)).rejects.toThrow(
      /record_attempt_result answered "day-closed"/,
    );
  });
});

type Result = { data: unknown; error: { message: string } | null };

/** Records every client call; each query or rpc resolves to the next queued result. */
function fakeClient(results: Result[]) {
  const calls: unknown[][] = [];
  const next = () => results.shift() ?? { data: null, error: null };
  const query = (): object =>
    new Proxy(
      {},
      {
        get(_, method) {
          if (method === "then") {
            const result = next();
            return (resolve: (value: Result) => void) => resolve(result);
          }
          return (...args: unknown[]) => {
            calls.push([method, ...args]);
            return proxy;
          };
        },
      },
    );
  const proxy = query();
  const createUser = vi.fn(async (attributes: unknown) => {
    calls.push(["createUser", attributes]);
    return next();
  });
  const db = {
    from: (table: string) => {
      calls.push(["from", table]);
      return proxy;
    },
    rpc: async (name: string, args: unknown) => {
      calls.push(["rpc", name, args]);
      return next();
    },
    auth: { admin: { createUser } },
  };
  return { deps: supabaseSeedDeps(db as unknown as SupabaseClient), calls };
}

describe("supabaseSeedDeps", () => {
  it("asks the database for today's game date", async () => {
    const { deps, calls } = fakeClient([{ data: "2026-11-08", error: null }]);
    expect(await deps.todayGameDate()).toBe("2026-11-08");
    expect(calls[0]).toEqual(["rpc", "game_date_at", { ts: expect.any(String) }]);
  });

  it("creates the game day and reads its pass target as a number", async () => {
    const { deps, calls } = fakeClient([{ data: null, error: null }, { data: { pass_target: "10" }, error: null }]);
    await deps.ensureGameDay("2026-11-08");
    expect(await deps.passTarget("2026-11-08")).toBe(10);
    expect(calls).toContainEqual(["rpc", "ensure_game_day", { d: "2026-11-08" }]);
    expect(calls).toContainEqual(["eq", "game_date", "2026-11-08"]);
  });

  it("creates a confirmed account with a random password, then its eligible profile", async () => {
    const { deps, calls } = fakeClient([{ data: { user: { id: "u1" } }, error: null }, { data: null, error: null }]);
    expect(await deps.createPlayer("seed-x-1@example.test")).toBe("u1");
    expect(calls[0]).toEqual([
      "createUser",
      { email: "seed-x-1@example.test", password: expect.any(String), email_confirm: true },
    ]);
    expect(calls).toContainEqual(["insert", { id: "u1", birth_date: "1990-01-01", country: "US" }]);
  });

  it("inserts an attempt with an unsigned 32-bit seed and returns its id", async () => {
    const { deps, calls } = fakeClient([{ data: { id: "a1" }, error: null }]);
    expect(await deps.startAttempt("u1", "2026-11-08")).toBe("a1");
    const insert = calls.find(([method]) => method === "insert")![1] as { user_id: string; game_date: string; seed: number };
    expect(insert).toMatchObject({ user_id: "u1", game_date: "2026-11-08" });
    expect(Number.isInteger(insert.seed) && insert.seed >= 0 && insert.seed <= 0xffffffff).toBe(true);
  });

  it("records today's result through record_attempt_result", async () => {
    const { deps, calls } = fakeClient([{ data: "recorded", error: null }]);
    expect(await deps.recordResult("a1", 11, true)).toBe("recorded");
    expect(calls[0]).toEqual([
      "rpc",
      "record_attempt_result",
      { p_attempt_id: "a1", p_inputs: { seeded: true }, p_score: 11, p_passed: true },
    ]);
  });

  it("writes another day's result directly and adds its passes to that day's counters", async () => {
    const { deps, calls } = fakeClient([
      { data: null, error: null },
      { data: { passes: 4, weighted_passes: "4" }, error: null },
      { data: null, error: null },
    ]);
    await deps.writePastResult("a1", 9, false);
    expect(calls).toContainEqual(["update", expect.objectContaining({ score: 9, passed: false, inputs: { seeded: true } })]);
    await deps.addPastPasses("2026-11-07", 3);
    expect(calls).toContainEqual(["update", { passes: 7, weighted_passes: 7 }]);
  });

  it("names the step that failed", async () => {
    const failure = { data: null, error: { message: "connection refused" } };
    await expect(fakeClient([failure]).deps.todayGameDate()).rejects.toThrow("game_date_at failed: connection refused");
    await expect(fakeClient([failure]).deps.createPlayer("x@example.test")).rejects.toThrow(
      "Creating x@example.test failed: connection refused",
    );
    await expect(fakeClient([failure]).deps.startAttempt("u1", "2026-11-08")).rejects.toThrow("Attempt insert failed");
  });
});
