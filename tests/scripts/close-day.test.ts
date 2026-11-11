import { spawnSync } from "node:child_process";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { main, parseCloseDayArgs, runCloseDay, supabaseCloseDayDeps, type CloseDayDeps } from "../../scripts/close-day.mts";

const local = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SERVICE_ROLE_KEY: "key" };

describe("parseCloseDayArgs", () => {
  it("reads --date", () => {
    expect(parseCloseDayArgs(["--date", "2026-11-10"])).toBe("2026-11-10");
  });

  it.each([[[]], [["--date", "2026-02-30"]], [["--date", "11/10/2026"]], [["--day", "2026-11-10"]]])("refuses %j", (args) => {
    expect(() => parseCloseDayArgs(args)).toThrow();
  });
});

describe("runCloseDay", () => {
  it("closes the day and reports its outcome and the world streak", async () => {
    const deps: CloseDayDeps = {
      closeDay: vi.fn(async () => "survived"),
      worldStreak: vi.fn(async () => ({ current: 3, best: 5 })),
    };
    expect(await runCloseDay("2026-11-10", deps)).toBe("2026-11-10 survived. World streak: 3 (best 5).");
    expect(deps.closeDay).toHaveBeenCalledWith("2026-11-10");
  });
});

/** A client whose rpc calls answer `replies` in order, recording each call. */
function fakeClient(replies: { data: unknown; error: { message: string } | null }[]) {
  const calls: unknown[][] = [];
  const reply = () => replies.shift();
  const db = {
    rpc: (name: string, params?: unknown) => {
      calls.push(params === undefined ? [name] : [name, params]);
      const result = reply();
      return { single: async () => result, then: (resolve: (value: unknown) => void) => resolve(result) };
    },
  } as unknown as SupabaseClient;
  return { db, deps: supabaseCloseDayDeps(db), calls };
}

describe("supabaseCloseDayDeps", () => {
  it("calls close_game_day with the date, then reads world_streak", async () => {
    const { deps, calls } = fakeClient([
      { data: "broken", error: null },
      { data: { current: 0, best: 4, current_start_date: null }, error: null },
    ]);
    expect(await deps.closeDay("2026-11-10")).toBe("broken");
    expect(await deps.worldStreak()).toEqual({ current: 0, best: 4 });
    expect(calls).toEqual([["close_game_day", { d: "2026-11-10" }], ["world_streak"]]);
  });

  it("passes the database's refusal on, for example a day before its deadline", async () => {
    const { deps } = fakeClient([{ data: null, error: { message: "game day 2026-11-11 has not reached its deadline" } }]);
    await expect(deps.closeDay("2026-11-11")).rejects.toThrow("Close failed: game day 2026-11-11 has not reached its deadline");
  });

  it.each([null, "survived?"])("refuses an unexpected outcome (%j)", async (outcome) => {
    const { deps } = fakeClient([{ data: outcome, error: null }]);
    await expect(deps.closeDay("2026-11-10")).rejects.toThrow(/outcome/);
  });

  it("refuses a malformed streak", async () => {
    const { deps } = fakeClient([{ data: { current: 1.5, best: 4 }, error: null }]);
    await expect(deps.worldStreak()).rejects.toThrow(/current/);
  });
});

describe("main", () => {
  const args = ["--date", "2026-11-10"];

  it("refuses a non-local URL before it reads the key or makes any client", async () => {
    const makeClient = vi.fn();
    await expect(main({ ...local, NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co" }, args, makeClient)).rejects.toThrow(
      /Refusing to close a game day/,
    );
    // With no key either, the URL is still what it refuses first.
    await expect(main({ NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co" }, args, makeClient)).rejects.toThrow(
      /Refusing to close a game day/,
    );
    expect(makeClient).not.toHaveBeenCalled();
  });

  it("refuses to start without the service-role key or with bad arguments", async () => {
    const makeClient = vi.fn();
    await expect(main({ NEXT_PUBLIC_SUPABASE_URL: local.NEXT_PUBLIC_SUPABASE_URL }, args, makeClient)).rejects.toThrow(
      /SUPABASE_SERVICE_ROLE_KEY is missing/,
    );
    await expect(main(local, ["--date", "soon"], makeClient)).rejects.toThrow(/--date/);
    expect(makeClient).not.toHaveBeenCalled();
  });

  it("closes the day on the local database and prints one result line", async () => {
    const { db, calls } = fakeClient([
      { data: "survived", error: null },
      { data: { current: 1, best: 1, current_start_date: "2026-11-10" }, error: null },
    ]);
    const makeClient = vi.fn(() => db);
    const log = vi.fn();
    await main(local, args, makeClient, log);
    expect(makeClient).toHaveBeenCalledWith(local.NEXT_PUBLIC_SUPABASE_URL, "key");
    expect(calls[0]).toEqual(["close_game_day", { d: "2026-11-10" }]);
    expect(log.mock.calls).toEqual([["2026-11-10 survived. World streak: 1 (best 1)."]]);
  });

  it("exits non-zero with a one-line message when run against a real project", () => {
    const run = spawnSync(process.execPath, ["scripts/close-day.mts", ...args], {
      encoding: "utf8",
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "key" },
    });
    expect(run.status).toBe(1);
    expect(run.stderr.trim()).toMatch(/^Refusing to close a game day: NEXT_PUBLIC_SUPABASE_URL must be localhost/);
  });
});
