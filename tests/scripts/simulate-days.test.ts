import { spawnSync } from "node:child_process";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { main, parseSimulateArgs, runSimulation, supabaseSimulateDeps, type SimulateDeps } from "../../scripts/simulate-days.mts";

const local = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SERVICE_ROLE_KEY: "key" };
const args = ["--from", "2027-01-01", "--days", "30", "--players", "50", "--pass-rate", "0.8"];

describe("parseSimulateArgs", () => {
  it("reads the four options", () => {
    expect(parseSimulateArgs(args)).toEqual({ from: "2027-01-01", days: 30, players: 50, passRate: 0.8 });
  });

  it.each([
    [["--days", "30", "--players", "50", "--pass-rate", "0.8"], /--from/],
    [["--from", "2027-02-30", "--days", "30", "--players", "50", "--pass-rate", "0.8"], /--from/],
    [["--from", "2027-01-01", "--days", "0", "--players", "50", "--pass-rate", "0.8"], /--days/],
    [["--from", "2027-01-01", "--days", "367", "--players", "50", "--pass-rate", "0.8"], /--days/],
    [["--from", "2027-01-01", "--days", "30", "--players", "1.5", "--pass-rate", "0.8"], /--players/],
    [["--from", "2027-01-01", "--days", "30", "--players", "1001", "--pass-rate", "0.8"], /--players/],
    [["--from", "2027-01-01", "--days", "30", "--players", "50"], /--pass-rate/],
    [["--from", "2027-01-01", "--days", "30", "--players", "50", "--pass-rate", "1.2"], /--pass-rate/],
    [[...args, "--date", "2027-01-01"], /Unknown option/],
  ])("refuses %j", (argv, message) => {
    expect(() => parseSimulateArgs(argv)).toThrow(message);
  });
});

/** An in-memory database: open and closed days, attempts per day and every call made. */
function fakeDeps(state: { open: Record<string, number>; closed: string[] }) {
  const calls: string[] = [];
  const log = vi.fn();
  let attempt = 0;
  const addDay = (date: string) => {
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString().slice(0, 10);
  };
  const deps: SimulateDeps = {
    earliestOpenBefore: async (date) => {
      const open = Object.keys(state.open).filter((d) => d < date).sort()[0];
      return open ? { date: open, attempts: state.open[open] } : null;
    },
    firstClosedFrom: async (date) => state.closed.filter((d) => d >= date).sort()[0] ?? null,
    ensureGameDay: async (date) => {
      state.open[date] ??= 0;
    },
    passTarget: async () => 10,
    createPlayer: async (email) => {
      calls.push(`player ${email}`);
      return email;
    },
    startAttempt: async (userId, date) => {
      state.open[date] += 1;
      return `${userId}/${date}/${++attempt}`;
    },
    recordResult: async (id, score, passed) => {
      calls.push(`result ${id.split("/")[1]} ${score} ${passed}`);
      return "recorded";
    },
    closeDay: async (date) => {
      calls.push(`close ${date}`);
      const outcome = state.open[date] > 0 ? "survived" : "broken";
      delete state.open[date];
      state.closed.push(date);
      state.open[addDay(date)] ??= 0;
      return outcome;
    },
    worldStreak: async () => ({ current: 30, best: 30 }),
    log,
  };
  return { deps, calls, log };
}

describe("runSimulation", () => {
  it("closes the empty days before --from, then plays and closes each day in order with the same players", async () => {
    const { deps, calls, log } = fakeDeps({ open: { "2026-12-30": 0 }, closed: [] });
    await runSimulation({ from: "2027-01-01", days: 3, players: 4, passRate: 0.5 }, "r", deps);

    expect(calls.filter((c) => c.startsWith("close"))).toEqual([
      "close 2026-12-30",
      "close 2026-12-31",
      "close 2027-01-01",
      "close 2027-01-02",
      "close 2027-01-03",
    ]);
    expect(calls.filter((c) => c.startsWith("player"))).toEqual([1, 2, 3, 4].map((n) => `player seed-r-${n}@example.test`));
    // Two of four pass each day, just over the target; the others just under.
    expect(calls.filter((c) => c.startsWith("result 2027-01-02"))).toEqual([
      "result 2027-01-02 11 true",
      "result 2027-01-02 9 false",
      "result 2027-01-02 11 true",
      "result 2027-01-02 9 false",
    ]);
    // Every day's results come before its close.
    expect(calls.indexOf("close 2027-01-02")).toBeGreaterThan(calls.lastIndexOf("result 2027-01-02 9 false"));
    expect(log.mock.calls).toEqual([
      ["Closed 2 empty days before 2027-01-01 (broken)."],
      ["2027-01-01 survived."],
      ["2027-01-02 survived."],
      ["2027-01-03 survived."],
      ["Simulated 3 days with 4 players. World streak: 30 (best 30)."],
    ]);
  });

  it("refuses an open day before --from that someone played, before changing anything", async () => {
    const { deps, calls } = fakeDeps({ open: { "2026-11-12": 1 }, closed: [] });
    await expect(runSimulation({ from: "2027-01-01", days: 1, players: 1, passRate: 1 }, "r", deps)).rejects.toThrow(
      "Game day 2026-11-12 is open and has attempts; run `npm run db:reset` first",
    );
    expect(calls).toEqual([]);
  });

  it("refuses when a day on or after --from is already closed", async () => {
    const { deps, calls } = fakeDeps({ open: {}, closed: ["2027-01-05"] });
    await expect(runSimulation({ from: "2027-01-01", days: 1, players: 1, passRate: 1 }, "r", deps)).rejects.toThrow(
      "Game day 2027-01-05 is already closed",
    );
    expect(calls).toEqual([]);
  });

  it("stops when a result is not recorded", async () => {
    const { deps } = fakeDeps({ open: {}, closed: [] });
    deps.recordResult = async () => "day-closed";
    await expect(runSimulation({ from: "2027-01-01", days: 1, players: 1, passRate: 1 }, "r", deps)).rejects.toThrow(
      'The result for player 1 on 2027-01-01 answered "day-closed".',
    );
  });
});

/** A client that answers each query or rpc with `replies` in order, recording each call. */
function fakeClient(replies: { data?: unknown; count?: number; error: { message: string } | null }[]) {
  const calls: unknown[][] = [];
  const query = (name: string): unknown =>
    new Proxy(
      {},
      {
        get: (_, key: string) => {
          if (key === "then") return (resolve: (value: unknown) => void) => resolve(replies.shift());
          return (...params: unknown[]) => {
            calls.push([name, key, ...params]);
            return query(name);
          };
        },
      },
    );
  const db = {
    from: (table: string) => query(table),
    rpc: (name: string, params: unknown) => {
      calls.push(["rpc", name, params]);
      return query(name);
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

describe("supabaseSimulateDeps", () => {
  it("finds the earliest open day before a date and counts its attempts", async () => {
    const { db, calls } = fakeClient([{ data: [{ game_date: "2026-11-12" }], error: null }, { count: 2, error: null }]);
    expect(await supabaseSimulateDeps(db).earliestOpenBefore("2027-01-01")).toEqual({ date: "2026-11-12", attempts: 2 });
    expect(calls).toContainEqual(["game_days", "lt", "game_date", "2027-01-01"]);
    expect(calls).toContainEqual(["attempts", "eq", "game_date", "2026-11-12"]);
  });

  it("answers null when no day is open, and finds the first closed day", async () => {
    const { db, calls } = fakeClient([
      { data: [], error: null },
      { data: [{ game_date: "2027-01-05" }], error: null },
      { data: [], error: null },
    ]);
    const deps = supabaseSimulateDeps(db);
    expect(await deps.earliestOpenBefore("2027-01-01")).toBeNull();
    expect(await deps.firstClosedFrom("2027-01-01")).toBe("2027-01-05");
    expect(await deps.firstClosedFrom("2027-01-06")).toBeNull();
    expect(calls).toContainEqual(["game_days", "gte", "game_date", "2027-01-01"]);
  });

  it("records and closes through the unchecked functions", async () => {
    const { db, calls } = fakeClient([
      { data: "recorded", error: null },
      { data: "survived", error: null },
    ]);
    const deps = supabaseSimulateDeps(db);
    expect(await deps.recordResult("a1", 11, true)).toBe("recorded");
    expect(await deps.closeDay("2027-01-01")).toBe("survived");
    expect(calls).toEqual([
      ["rpc", "record_attempt_result_unchecked", { p_attempt_id: "a1", p_inputs: { seeded: true }, p_score: 11, p_passed: true }],
      ["rpc", "close_game_day_unchecked", { d: "2027-01-01" }],
    ]);
  });

  it("passes database errors and unexpected outcomes on", async () => {
    const { db } = fakeClient([
      { data: null, error: { message: "an earlier game day is still open; close days in order" } },
      { data: "maybe", error: null },
      { count: undefined, data: null, error: { message: "boom" } },
    ]);
    const deps = supabaseSimulateDeps(db);
    await expect(deps.closeDay("2027-01-02")).rejects.toThrow("Close failed: an earlier game day is still open");
    await expect(deps.closeDay("2027-01-02")).rejects.toThrow(/Unexpected outcome/);
    await expect(deps.earliestOpenBefore("2027-01-01")).rejects.toThrow("Open day lookup failed: boom");
  });
});

describe("main", () => {
  it("refuses a non-local URL before it reads the key or makes any client", async () => {
    const makeClient = vi.fn();
    await expect(main({ NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co" }, args, makeClient)).rejects.toThrow(
      /Refusing to simulate game days/,
    );
    expect(makeClient).not.toHaveBeenCalled();
  });

  it("refuses to start without the service-role key or with bad arguments", async () => {
    const makeClient = vi.fn();
    await expect(main({ NEXT_PUBLIC_SUPABASE_URL: local.NEXT_PUBLIC_SUPABASE_URL }, args, makeClient)).rejects.toThrow(
      /SUPABASE_SERVICE_ROLE_KEY is missing/,
    );
    await expect(main(local, ["--from", "soon"], makeClient)).rejects.toThrow(/--from/);
    expect(makeClient).not.toHaveBeenCalled();
  });

  it("exits non-zero with a one-line message when run against a real project", () => {
    const run = spawnSync(process.execPath, ["scripts/simulate-days.mts", ...args], {
      encoding: "utf8",
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "key" },
    });
    expect(run.status).toBe(1);
    expect(run.stderr.trim()).toMatch(/^Refusing to simulate game days: NEXT_PUBLIC_SUPABASE_URL must be localhost/);
  });
});
