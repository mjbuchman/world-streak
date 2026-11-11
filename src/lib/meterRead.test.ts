import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { readMeter } from "./meterRead";

// Game date 2026-11-08 closes at midnight UTC on Nov 9; the meter hides from 21:00 UTC.
const open = new Date("2026-11-08T20:59:59Z");
const closesAt = "2026-11-09T00:00:00.000Z";

type Result = { data: unknown; error: { message: string } | null };

/** Records every query-builder call and resolves the query to `result`. */
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
  } as unknown as SupabaseClient;
  return { db, calls };
}

describe("readMeter", () => {
  it("reads the day and its counters in one query, never the attempts table", async () => {
    const data = {
      survival_threshold: "0.60",
      game_day_counters: { attempts: 4, weighted_attempts: "4", weighted_passes: "3" },
    };
    const { db, calls } = fakeDb({ data, error: null });
    expect(await readMeter(db, open)).toEqual({
      gameDate: "2026-11-08",
      status: "open",
      passRate: 0.75,
      attempts: 4,
      threshold: 0.6,
      closesAt,
      streak: null,
    });
    expect(calls).toEqual([
      ["from", "game_days"],
      ["select", "survival_threshold, game_day_counters(attempts, weighted_attempts, weighted_passes)"],
      ["eq", "game_date", "2026-11-08"],
      ["maybeSingle"],
    ]);
    expect(calls.filter(([method]) => method === "from")).toEqual([["from", "game_days"]]);
  });

  it("opens the next day's meter at the deadline", async () => {
    // A millisecond before midnight UTC is the hidden end of Nov 8; midnight is the open start of Nov 9.
    const before = fakeDb({ data: null, error: null });
    expect(await readMeter(before.db, new Date("2026-11-08T23:59:59.999Z"))).toMatchObject({
      gameDate: "2026-11-08",
      status: "hidden",
      closesAt: "2026-11-09T00:00:00.000Z",
    });
    expect(before.calls).toContainEqual(["eq", "game_date", "2026-11-08"]);

    const at = fakeDb({ data: null, error: null });
    expect(await readMeter(at.db, new Date("2026-11-09T00:00:00Z"))).toMatchObject({
      gameDate: "2026-11-09",
      status: "open",
      closesAt: "2026-11-10T00:00:00.000Z",
    });
    expect(at.calls).toContainEqual(["eq", "game_date", "2026-11-09"]);
  });

  it("reads the counters whether they come back as an object or a one-element array", async () => {
    const counters = { attempts: 4, weighted_attempts: 4, weighted_passes: 3 };
    const asArray = fakeDb({ data: { survival_threshold: 0.6, game_day_counters: [counters] }, error: null });
    expect(await readMeter(asArray.db, open)).toMatchObject({ passRate: 0.75, attempts: 4 });
    const empty = fakeDb({ data: { survival_threshold: 0.6, game_day_counters: [] }, error: null });
    expect(await readMeter(empty.db, open)).toMatchObject({ passRate: null, attempts: 0 });
  });

  it("shows no attempts yet when the day has no counters row", async () => {
    const { db } = fakeDb({ data: { survival_threshold: 0.6, game_day_counters: null }, error: null });
    expect(await readMeter(db, open)).toMatchObject({ status: "open", passRate: null, attempts: 0, threshold: 0.6 });
  });

  it("has no threshold to show before today's game day exists", async () => {
    const { db } = fakeDb({ data: null, error: null });
    expect(await readMeter(db, open)).toMatchObject({ status: "open", passRate: null, attempts: 0, threshold: null });
  });

  it.each([
    ["threshold", { survival_threshold: null, game_day_counters: null }, /survival_threshold/],
    ["threshold", { survival_threshold: "x", game_day_counters: null }, /survival_threshold/],
    [
      "weighted attempts",
      { survival_threshold: 0.6, game_day_counters: { attempts: 4, weighted_attempts: null, weighted_passes: 3 } },
      /weighted_attempts/,
    ],
    [
      "weighted passes",
      { survival_threshold: 0.6, game_day_counters: { attempts: 4, weighted_attempts: 4, weighted_passes: null } },
      /weighted_passes/,
    ],
    [
      "attempt count",
      { survival_threshold: 0.6, game_day_counters: { attempts: 1.5, weighted_attempts: 4, weighted_passes: 3 } },
      /for attempts,/,
    ],
  ])("throws on a malformed %s instead of showing NaN or 0", async (_, data, message) => {
    const { db } = fakeDb({ data, error: null });
    await expect(readMeter(db, open)).rejects.toThrow(message);
  });

  it("throws on a database error, so the endpoint answers 500", async () => {
    const { db } = fakeDb({ data: null, error: { message: "connection refused" } });
    await expect(readMeter(db, open)).rejects.toThrow("Meter lookup failed: connection refused");
  });
});
