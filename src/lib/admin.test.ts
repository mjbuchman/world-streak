import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { ADMIN_DAYS_AHEAD, isAdmin, readAdminDays } from "./admin";

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
    rpc: (...args: unknown[]) => start(["rpc", ...args]),
  } as unknown as SupabaseClient;
  return { db, calls };
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
  const row = (gameDate: string, closedAt: string | null = null) => ({
    game_date: gameDate,
    challenge_type: "stacking",
    pass_target: "10",
    survival_threshold: "0.60",
    closed_at: closedAt,
  });

  it("makes sure today and the next 7 days exist, then reads them in date order", async () => {
    const days = Array.from({ length: ADMIN_DAYS_AHEAD + 1 }, (_, i) => row(`2026-11-${String(11 + i).padStart(2, "0")}`));
    const { db, calls } = fakeDb([...Array.from({ length: 8 }, () => ok), { data: days, error: null }]);
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
      ["select", "game_date, challenge_type, pass_target, survival_threshold, closed_at"],
      ["gte", "game_date", "2026-11-11"],
      ["lte", "game_date", "2026-11-18"],
      ["order", "game_date", { ascending: true }],
    ]);
    expect(result).toHaveLength(8);
    expect(result[0]).toEqual({ gameDate: "2026-11-11", challengeType: "stacking", passTarget: 10, threshold: 0.6, closed: false });
  });

  it("marks a closed day", async () => {
    const { db } = fakeDb([...Array.from({ length: 8 }, () => ok), { data: [row("2026-11-11", "2026-11-12T00:00:05Z")], error: null }]);
    expect((await readAdminDays(db, new Date("2026-11-11T09:00:00Z")))[0].closed).toBe(true);
  });

  it("throws when a day cannot be prepared or read, or a number is malformed", async () => {
    const failsEnsure = fakeDb([{ data: null, error: { message: "no settings" } }, ...Array.from({ length: 7 }, () => ok)]);
    await expect(readAdminDays(failsEnsure.db, new Date())).rejects.toThrow("Preparing game days failed: no settings");

    const failsRead = fakeDb([...Array.from({ length: 8 }, () => ok), { data: null, error: { message: "down" } }]);
    await expect(readAdminDays(failsRead.db, new Date())).rejects.toThrow("Game day lookup failed: down");

    const malformed = fakeDb([...Array.from({ length: 8 }, () => ok), { data: [{ ...row("2026-11-11"), pass_target: "x" }], error: null }]);
    await expect(readAdminDays(malformed.db, new Date())).rejects.toThrow(/pass_target/);
  });
});
