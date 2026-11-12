import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { CYCLE_LENGTH_DAYS, FIRST_CYCLE_START, PAYOUT_WITHIN_DAYS, PRIZE_PER_CYCLE_CENTS, STREAK_GOAL_DAYS } from "@/config/prize";
import { addDays } from "@/lib/gameDay";
import {
  type Cycle,
  currentPrizeCents,
  cycleDayLine,
  dollars,
  entriesLine,
  GOAL_LINE,
  goalReachedLine,
  nextRolloverCents,
  preseasonLine,
  prizeLine,
  readPrizeSummary,
} from "./prize";

const cycle = (over: Partial<Cycle> = {}): Cycle => ({ baseCents: PRIZE_PER_CYCLE_CENTS, rolloverInCents: 0, goalReachedOn: null, ...over });

/** The next cycle, as the close job will create it (T34). */
const next = (previous: Cycle): Cycle => cycle({ rolloverInCents: nextRolloverCents(previous) });

describe("prize config", () => {
  it("is a flat $200 for a 30-day streak inside a 60-day cycle from 2027-01-01, paid within 45 days", () => {
    expect({ PRIZE_PER_CYCLE_CENTS, CYCLE_LENGTH_DAYS, STREAK_GOAL_DAYS, FIRST_CYCLE_START, PAYOUT_WITHIN_DAYS }).toEqual({
      PRIZE_PER_CYCLE_CENTS: 20_000,
      CYCLE_LENGTH_DAYS: 60,
      STREAK_GOAL_DAYS: 30,
      FIRST_CYCLE_START: "2027-01-01",
      PAYOUT_WITHIN_DAYS: 45,
    });
  });

  it("matches the cycles migration, which repeats the prize and cycle 1's dates", () => {
    const migration = readFileSync("supabase/migrations/20261113000000_cycles.sql", "utf8");
    expect(migration).toContain(`base_prize_cents integer not null default ${PRIZE_PER_CYCLE_CENTS} `);
    const lastDay = addDays(FIRST_CYCLE_START, CYCLE_LENGTH_DAYS - 1);
    expect(migration).toContain(`values (1, '${FIRST_CYCLE_START}', '${lastDay}')`);
  });

  it("matches the close job, which repeats the cycle length and the goal", () => {
    const close = readFileSync("supabase/migrations/20261113010000_cycle_close.sql", "utf8");
    expect(close).toContain(`end_date + 1, end_date + ${CYCLE_LENGTH_DAYS},`);
    expect(close).toContain(`if v_run_length >= ${STREAK_GOAL_DAYS} then`);
  });
});

describe("currentPrizeCents", () => {
  it("is the base plus whatever rolled in", () => {
    expect(currentPrizeCents(cycle())).toBe(20_000);
    expect(currentPrizeCents(cycle({ rolloverInCents: 40_000 }))).toBe(60_000);
  });
});

describe("nextRolloverCents", () => {
  it("rolls the whole prize over when nobody won: cycle 2 is $400, cycle 3 is $600", () => {
    const cycle2 = next(cycle());
    expect(currentPrizeCents(cycle2)).toBe(40_000);
    const cycle3 = next(cycle2);
    expect(currentPrizeCents(cycle3)).toBe(60_000);
  });

  it("rolls nothing over from a won cycle, so the next one is $200 again", () => {
    const won = cycle({ rolloverInCents: 40_000, goalReachedOn: "2027-01-30" });
    expect(nextRolloverCents(won)).toBe(0);
    expect(currentPrizeCents(next(won))).toBe(20_000);
  });
});

describe("the prize lines (T36)", () => {
  it.each([
    [20_000, "$200"],
    [40_000, "$400"],
    [1_234_500, "$12,345"],
    [20_050, "$200.50"],
  ])("writes %i cents as %s", (cents, text) => {
    expect(dollars(cents)).toBe(text);
  });

  it("names the prize, and the rollover inside it when there is one", () => {
    expect(prizeLine(20_000, 0)).toBe("Prize this cycle: $200");
    expect(prizeLine(40_000, 20_000)).toBe("Prize this cycle: $400, including $200 rolled over");
  });

  it("says the day of the cycle, the goal, a reached goal, preseason and entries", () => {
    expect(cycleDayLine(10, 60)).toBe("Day 10 of 60");
    expect(GOAL_LINE).toBe("Goal: a 30-day world streak");
    expect(goalReachedLine("2027-01-30")).toBe("Goal reached on Jan 30, 2027. A winner will be drawn after the cycle ends.");
    expect(preseasonLine("2027-01-01", 20_000)).toBe("The first cycle starts January 1, 2027. Prize: $200.");
    expect(entriesLine(1)).toBe("Your entries this cycle: 1");
    expect(entriesLine(0)).toBe("Your entries this cycle: 0");
  });
});

type Reply = { data: unknown; error: { message: string } | null };

/** A client whose calls answer `replies` in order, recording each call and its builder steps. */
function fakeDb(replies: Reply[]) {
  const calls: unknown[][][] = [];
  const start = (first: unknown[]) => {
    const log: unknown[][] = [first];
    calls.push(log);
    const reply = replies.shift();
    const query: object = new Proxy(
      {},
      {
        get(_, method) {
          if (method === "then") return (resolve: (value: unknown) => void) => resolve(reply);
          return (...args: unknown[]) => {
            log.push([method, ...args]);
            return query;
          };
        },
      },
    );
    return query;
  };
  const db = { from: (table: string) => start(["from", table]), rpc: (name: string, args: unknown) => start(["rpc", name, args]) };
  return { db: db as unknown as SupabaseClient, calls };
}

const NOW = new Date("2027-01-10T12:00:00Z");
const CYCLE_ROW = { number: 1, start_date: "2027-01-01", end_date: "2027-03-01", base_prize_cents: 20_000, rollover_in_cents: 20_000, goal_reached_on: null };

describe("readPrizeSummary", () => {
  it("reads today's cycle: its day, prize, rollover and goal, with the player's entries", async () => {
    const { db, calls } = fakeDb([{ data: CYCLE_ROW, error: null }, { data: 3, error: null }]);
    expect(await readPrizeSummary(db, NOW, true)).toEqual({
      kind: "cycle",
      number: 1,
      day: 10,
      length: 60,
      prizeCents: 40_000,
      rolloverInCents: 20_000,
      goalReachedOn: null,
      entries: 3,
    });
    expect(calls[0]).toEqual([
      ["from", "cycles_public"],
      ["select", "number, start_date, end_date, base_prize_cents, rollover_in_cents, goal_reached_on"],
      ["lte", "start_date", "2027-01-10"],
      ["gte", "end_date", "2027-01-10"],
      ["maybeSingle"],
    ]);
    expect(calls[1]).toEqual([["rpc", "my_entry_count", { cycle: 1 }]]);
  });

  it("asks no entry count when signed out, and passes a reached goal on", async () => {
    const { db, calls } = fakeDb([{ data: { ...CYCLE_ROW, goal_reached_on: "2027-01-30" }, error: null }]);
    expect(await readPrizeSummary(db, NOW, false)).toMatchObject({ kind: "cycle", goalReachedOn: "2027-01-30", entries: null });
    expect(calls).toHaveLength(1);
  });

  it("before the first cycle, is preseason with the first cycle's start and prize", async () => {
    const { db, calls } = fakeDb([
      { data: null, error: null },
      { data: { start_date: "2027-01-01", base_prize_cents: 20_000, rollover_in_cents: 0 }, error: null },
    ]);
    expect(await readPrizeSummary(db, new Date("2026-11-12T12:00:00Z"), true)).toEqual({
      kind: "preseason",
      firstStart: "2027-01-01",
      prizeCents: 20_000,
    });
    expect(calls[1]).toEqual([
      ["from", "cycles_public"],
      ["select", "start_date, base_prize_cents, rollover_in_cents"],
      ["order", "number"],
      ["limit", 1],
      ["maybeSingle"],
    ]);
  });

  it("is null between cycles (the next one is not created yet) or with no cycles at all", async () => {
    const between = fakeDb([{ data: null, error: null }, { data: { start_date: "2027-01-01", base_prize_cents: 20_000, rollover_in_cents: 0 }, error: null }]);
    expect(await readPrizeSummary(between.db, new Date("2027-03-02T12:00:00Z"), false)).toBeNull();
    const none = fakeDb([{ data: null, error: null }, { data: null, error: null }]);
    expect(await readPrizeSummary(none.db, NOW, false)).toBeNull();
  });

  it("throws on a failed read, so the card shows as unavailable", async () => {
    await expect(readPrizeSummary(fakeDb([{ data: null, error: { message: "down" } }]).db, NOW, false)).rejects.toThrow(
      "Cycle lookup failed: down",
    );
    const first = fakeDb([{ data: null, error: null }, { data: null, error: { message: "down" } }]);
    await expect(readPrizeSummary(first.db, NOW, false)).rejects.toThrow("First cycle lookup failed: down");
    const entries = fakeDb([{ data: CYCLE_ROW, error: null }, { data: null, error: { message: "down" } }]);
    await expect(readPrizeSummary(entries.db, NOW, true)).rejects.toThrow("Entry count failed: down");
  });
});
