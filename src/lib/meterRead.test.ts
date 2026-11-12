import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, type FakeResult as Result } from "@/lib/testing/fakeSupabase";
import { readMeter } from "./meterRead";

// The setting is 0 (shown until the deadline, T103); the hidden-window test switches on 3 hours.
const config = vi.hoisted(() => ({ hideHours: 0 }));
vi.mock("@/config/meter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/config/meter")>()),
  get METER_HIDE_HOURS() {
    return config.hideHours;
  },
}));
beforeEach(() => {
  config.hideHours = 0;
});

// Game date 2026-11-08 closes at midnight UTC on Nov 9; with a 3-hour window it would hide from 21:00 UTC.
const open = new Date("2026-11-08T20:59:59Z");
const closesAt = "2026-11-09T00:00:00.000Z";

const STREAK_OK: Result = { data: { current: 4, best: 9, current_start_date: "2026-11-05" }, error: null };

/**
 * Records every query-builder call. The day query resolves to `day`, the world_streak call to
 * `streak`; each records its calls separately, since the two run side by side.
 */
function fakeDb(day: Result, streak: Result = STREAK_OK) {
  // When each read starts and when it is first awaited, across both reads.
  const order: string[] = [];
  const name = (first: unknown[]) => (first[0] === "from" ? "day" : "streak");
  const { db, queries } = fakeSupabase(
    (first) => {
      order.push(`start ${name(first)}`);
      return first[0] === "from" ? day : streak;
    },
    { onAwait: (log) => order.push(`await ${name(log[0])}`) },
  );
  const log = (kind: string) => queries.find((query) => query[0][0] === kind) ?? [];
  return {
    db,
    order,
    queries,
    get calls() {
      return log("from");
    },
    get streakCalls() {
      return log("rpc");
    },
  };
}

describe("readMeter", () => {
  it("reads the day and its counters in one query, never the attempts table", async () => {
    const data = {
      survival_threshold: "0.60",
      game_day_counters: { attempts: 4, weighted_attempts: "4", weighted_passes: "3" },
    };
    const fake = fakeDb({ data, error: null });
    expect(await readMeter(fake.db, open)).toEqual({
      gameDate: "2026-11-08",
      status: "open",
      passRate: 0.75,
      attempts: 4,
      threshold: 0.6,
      closesAt,
      streak: { current: 4, best: 9 },
    });
    expect(fake.streakCalls).toEqual([["rpc", "world_streak"], ["single"]]);
    expect(fake.calls).toEqual([
      ["from", "game_days"],
      ["select", "survival_threshold, game_day_counters(attempts, weighted_attempts, weighted_passes)"],
      ["eq", "game_date", "2026-11-08"],
      ["maybeSingle"],
    ]);
    expect(fake.queries.filter(([[method]]) => method === "from")).toHaveLength(1);
    expect(fake.calls.filter(([method]) => method === "from")).toEqual([["from", "game_days"]]);
  });

  it("opens the next day's meter at the deadline", async () => {
    // A millisecond before midnight UTC is the still-open end of Nov 8; midnight is the open start of Nov 9.
    const before = fakeDb({ data: null, error: null });
    expect(await readMeter(before.db, new Date("2026-11-08T23:59:59.999Z"))).toMatchObject({
      gameDate: "2026-11-08",
      status: "open",
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

  it("starts the streak read alongside the day's, not after it", async () => {
    const { db, order } = fakeDb({ data: null, error: null });
    await readMeter(db, open);
    expect(order.slice(0, 2).sort()).toEqual(["start day", "start streak"]);
  });

  it("carries the world streak in the hidden final hours too: it is not secret", async () => {
    config.hideHours = 3;
    const { db } = fakeDb({ data: null, error: null });
    expect(await readMeter(db, new Date("2026-11-08T22:00:00Z"))).toMatchObject({
      status: "hidden",
      streak: { current: 4, best: 9 },
    });
  });

  const day = { data: { survival_threshold: 0.6, game_day_counters: null }, error: null };
  it.each([
    ["current", { current: null, best: 9 }, /for current,/],
    ["current", { current: 1.5, best: 9 }, /for current,/],
    ["best", { current: 4, best: "x" }, /for best,/],
  ])("throws on a malformed streak %s instead of showing NaN or 0", async (_, data, message) => {
    const { db } = fakeDb(day, { data, error: null });
    await expect(readMeter(db, open)).rejects.toThrow(message);
  });

  it("throws when the streak cannot be read", async () => {
    const { db } = fakeDb(day, { data: null, error: { message: "timeout" } });
    await expect(readMeter(db, open)).rejects.toThrow("World streak lookup failed: timeout");
  });
});
