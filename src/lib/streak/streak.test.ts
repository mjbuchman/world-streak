import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  HISTORY_PAGE_SIZE,
  MAX_HISTORY_PAGE,
  challengeName,
  dayLabel,
  historyPageParam,
  passRateLabel,
  readHistory,
  readStreakSummary,
  recentDayLine,
  streakUnit,
  shapeRecentDays,
  type ClosedDay,
  yesterdayLine,
} from "./streak";

type Result = { data: unknown; error: { message: string; code?: string } | null; count?: number | null };

/** A client whose queries answer `results` in order, recording each builder call per query. */
function fakeDb(results: Result[]) {
  const queries: unknown[][][] = [];
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
    queries.push(log);
    return builder(log);
  };
  const db = {
    from: (table: string) => start(["from", table]),
    rpc: (name: string) => start(["rpc", name]),
  } as unknown as SupabaseClient;
  return { db, queries };
}

const day = (over: Record<string, unknown> = {}) => ({
  game_date: "2026-11-10",
  challenge_type: "stacking",
  final_pass_rate: "0.74",
  survival_threshold: "0.60",
  outcome: "survived",
  ...over,
});

describe("wording", () => {
  it("counts the streak in days, singular for one", () => {
    expect(streakUnit(0)).toBe("days");
    expect(streakUnit(1)).toBe("day");
    expect(streakUnit(12)).toBe("days");
  });

  it("describes each recent day for screen readers", () => {
    const base = { gameDate: "2026-11-01", threshold: 0.6 };
    expect(recentDayLine({ ...base, kind: "streak", passRate: 0.64, outcome: "survived" })).toBe(
      "Nov 1, 2026: 64% passed, 60% needed, survived",
    );
    expect(recentDayLine({ ...base, kind: "broke", passRate: 0.52, outcome: "broken" })).toBe(
      "Nov 1, 2026: 52% passed, 60% needed, broke the streak",
    );
    expect(recentDayLine({ ...base, kind: "closed", passRate: 0.4, outcome: "broken" })).toBe(
      "Nov 1, 2026: 40% passed, 60% needed, broken",
    );
    expect(recentDayLine({ ...base, kind: "empty", passRate: null, outcome: "broken" })).toBe("Nov 1, 2026: nobody played, broken");
    expect(recentDayLine({ gameDate: "2026-11-01", kind: "empty", passRate: null, threshold: null, outcome: null })).toBe(
      "Nov 1, 2026: no result",
    );
  });

  it("describes yesterday by its outcome and rate", () => {
    expect(yesterdayLine({ outcome: "survived", finalPassRate: 0.74 })).toBe("Yesterday the world survived with 74% passing");
    expect(yesterdayLine({ outcome: "broken", finalPassRate: 0.524 })).toBe("Yesterday the streak broke at 52%");
    expect(yesterdayLine({ outcome: "broken", finalPassRate: null })).toBe("Yesterday the streak broke: nobody played");
  });

  it("shows a pass rate as a whole percent, or no attempts", () => {
    expect(passRateLabel(0.625)).toBe("63%");
    expect(passRateLabel(null)).toBe("no attempts");
  });

  it("writes a game date in words, in UTC whatever the server's zone", () => {
    expect(dayLabel("2026-11-01")).toBe("Nov 1, 2026");
  });

  it("names a challenge, falling back to its type for one the app does not know yet", () => {
    expect(challengeName("stacking")).toBe("Teetering Tower");
    expect(challengeName("futureGame")).toBe("futureGame");
  });
});

describe("historyPageParam", () => {
  it("reads a whole page number, the first of several", () => {
    expect(historyPageParam("3")).toBe(3);
    expect(historyPageParam(["4", "9"])).toBe(4);
    expect(historyPageParam(String(MAX_HISTORY_PAGE))).toBe(MAX_HISTORY_PAGE);
  });

  it.each([undefined, "", "abc", "0", "-1", "1.5", "1e21", String(MAX_HISTORY_PAGE + 1)])("reads %j as the first page", (value) => {
    expect(historyPageParam(value)).toBe(1);
  });
});

describe("shapeRecentDays", () => {
  // Today is Nov 15: the 14 days shown are Nov 1 to Nov 14, and Oct 31 only says whether Nov 1 broke a run.
  const today = "2026-11-15";
  const closed = (gameDate: string, outcome: "survived" | "broken", passRate: number | null = outcome === "survived" ? 0.7 : 0.5): ClosedDay => ({
    gameDate,
    outcome,
    finalPassRate: passRate,
    threshold: 0.6,
  });
  const kinds = (days: ReturnType<typeof shapeRecentDays>) => days.map((d) => d.kind);

  it("gives 14 slots, oldest first, ending yesterday, with empty slots for days with no result", () => {
    const days = shapeRecentDays([], today, null);
    expect(days).toHaveLength(14);
    expect(days[0]).toEqual({ gameDate: "2026-11-01", kind: "empty", passRate: null, threshold: null, outcome: null });
    expect(days[13].gameDate).toBe("2026-11-14");
    expect(new Set(kinds(days))).toEqual(new Set(["empty"]));
  });

  it("marks the current run mint, the day that broke a run, and other closed days muted", () => {
    const rows = [
      closed("2026-11-08", "survived"),
      closed("2026-11-09", "survived"),
      closed("2026-11-10", "broken", 0.52),
      closed("2026-11-11", "broken", 0.41),
      closed("2026-11-12", "survived"),
      closed("2026-11-13", "survived"),
      closed("2026-11-14", "survived"),
    ];
    const days = shapeRecentDays(rows, today, "2026-11-12");
    expect(kinds(days).slice(7)).toEqual(["closed", "closed", "broke", "closed", "streak", "streak", "streak"]);
    expect(days[9]).toEqual({ gameDate: "2026-11-10", kind: "broke", passRate: 0.52, threshold: 0.6, outcome: "broken" });
  });

  it("uses the day before the window to tell whether the first day broke a run", () => {
    expect(shapeRecentDays([closed("2026-10-31", "survived"), closed("2026-11-01", "broken")], today, null)[0].kind).toBe("broke");
    expect(shapeRecentDays([closed("2026-10-31", "broken"), closed("2026-11-01", "broken")], today, null)[0].kind).toBe("closed");
    expect(shapeRecentDays([closed("2026-11-01", "broken")], today, null)[0].kind).toBe("closed");
  });

  it("shows a day nobody played as an empty slot that keeps its outcome and threshold", () => {
    const days = shapeRecentDays([closed("2026-11-13", "survived"), closed("2026-11-14", "broken", null)], today, null);
    expect(days[13]).toEqual({ gameDate: "2026-11-14", kind: "empty", passRate: null, threshold: 0.6, outcome: "broken" });
  });

  it("shows an empty slot even for a survived day with no pass rate inside the run", () => {
    const days = shapeRecentDays([closed("2026-11-14", "survived", null)], today, "2026-11-14");
    expect(days[13]).toMatchObject({ kind: "empty", outcome: "survived" });
  });

  it("treats a run of survived days as muted when it is not the current one", () => {
    // With no current run (it broke), earlier survived days are history, not the streak.
    expect(kinds(shapeRecentDays([closed("2026-11-13", "survived"), closed("2026-11-14", "broken")], today, null)).slice(12)).toEqual([
      "closed",
      "broke",
    ]);
  });

  it("works with fewer than 14 days of history", () => {
    const days = shapeRecentDays([closed("2026-11-14", "survived")], today, "2026-11-14");
    expect(kinds(days)).toEqual([...Array(13).fill("empty"), "streak"]);
  });
});

const NO_RECENT: Result = { data: [], error: null };

describe("readStreakSummary", () => {
  it("reads the streak, yesterday's closed result and the last 15 closed days", async () => {
    const { db, queries } = fakeDb([
      { data: { current: 1, best: 5, current_start_date: "2026-11-10" }, error: null },
      { data: { outcome: "survived", final_pass_rate: "0.74" }, error: null },
      {
        data: [
          { game_date: "2026-11-09", outcome: "broken", final_pass_rate: "0.5", survival_threshold: "0.6" },
          { game_date: "2026-11-10", outcome: "survived", final_pass_rate: "0.74", survival_threshold: "0.6" },
        ],
        error: null,
      },
    ]);
    const summary = await readStreakSummary(db, new Date("2026-11-11T09:00:00Z"));
    expect(summary).toMatchObject({ current: 1, best: 5, yesterday: { outcome: "survived", finalPassRate: 0.74 } });
    expect(summary.recent).toHaveLength(14);
    expect(summary.recent.slice(12)).toEqual([
      { gameDate: "2026-11-09", kind: "closed", passRate: 0.5, threshold: 0.6, outcome: "broken" },
      { gameDate: "2026-11-10", kind: "streak", passRate: 0.74, threshold: 0.6, outcome: "survived" },
    ]);
    expect(queries[1]).toEqual([
      ["from", "game_days"],
      ["select", "outcome, final_pass_rate"],
      ["eq", "game_date", "2026-11-10"],
      ["not", "closed_at", "is", null],
      ["maybeSingle"],
    ]);
    // Public columns of closed days only, through the caller's own client (no service role).
    expect(queries[2]).toEqual([
      ["from", "game_days"],
      ["select", "game_date, outcome, final_pass_rate, survival_threshold"],
      ["gte", "game_date", "2026-10-27"],
      ["lte", "game_date", "2026-11-10"],
      ["not", "closed_at", "is", null],
    ]);
  });

  it("throws when the recent days cannot be read or are malformed", async () => {
    const streak = { data: { current: 0, best: 0, current_start_date: null }, error: null };
    const failed = fakeDb([streak, { data: null, error: null }, { data: null, error: { message: "down" } }]);
    await expect(readStreakSummary(failed.db, new Date("2026-11-11T09:00:00Z"))).rejects.toThrow("Recent days lookup failed: down");
    const malformed = fakeDb([
      streak,
      { data: null, error: null },
      { data: [{ game_date: "2026-11-10", outcome: "tied", final_pass_rate: null, survival_threshold: "0.6" }], error: null },
    ]);
    await expect(readStreakSummary(malformed.db, new Date("2026-11-11T09:00:00Z"))).rejects.toThrow(/outcome/);
  });

  it("finds yesterday across a month and a year boundary", async () => {
    for (const [now, yesterday] of [
      ["2026-12-01T00:30:00Z", "2026-11-30"],
      ["2027-01-01T08:00:00Z", "2026-12-31"],
    ]) {
      const { db, queries } = fakeDb([{ data: { current: 0, best: 0 }, error: null }, { data: null, error: null }, NO_RECENT]);
      await readStreakSummary(db, new Date(now));
      expect(queries[1]).toContainEqual(["eq", "game_date", yesterday]);
      expect(queries[2]).toContainEqual(["lte", "game_date", yesterday]);
    }
  });

  it("starts the recent window 15 days back, across a year boundary", async () => {
    const { db, queries } = fakeDb([{ data: { current: 0, best: 0 }, error: null }, { data: null, error: null }, NO_RECENT]);
    const summary = await readStreakSummary(db, new Date("2027-01-05T08:00:00Z"));
    expect(queries[2]).toContainEqual(["gte", "game_date", "2026-12-21"]);
    expect(summary.recent[0].gameDate).toBe("2026-12-22");
    expect(summary.recent[13].gameDate).toBe("2027-01-04");
  });

  it("has no yesterday line until yesterday has closed", async () => {
    const { db } = fakeDb([
      { data: { current: 0, best: 0, current_start_date: null }, error: null },
      { data: null, error: null },
      NO_RECENT,
    ]);
    expect(await readStreakSummary(db, new Date("2026-11-11T00:00:10Z"))).toMatchObject({ yesterday: null });
  });

  it.each([
    ["the streak", [{ data: null, error: { message: "down" } }, { data: null, error: null }], /World streak lookup failed: down/],
    ["a malformed streak", [{ data: { current: -1, best: 0 }, error: null }, { data: null, error: null }], /current/],
    ["a running streak with no start date", [{ data: { current: 2, best: 2 }, error: null }, { data: null, error: null }], /start date/],
    [
      "yesterday",
      [{ data: { current: 0, best: 0 }, error: null }, { data: null, error: { message: "down" } }],
      /Yesterday lookup failed: down/,
    ],
    [
      "a malformed outcome",
      [{ data: { current: 0, best: 0 }, error: null }, { data: { outcome: "tied", final_pass_rate: null }, error: null }],
      /outcome/,
    ],
  ])("throws on %s", async (_name, results, message) => {
    const { db } = fakeDb([...(results as Result[]), NO_RECENT]);
    await expect(readStreakSummary(db, new Date("2026-11-11T09:00:00Z"))).rejects.toThrow(message);
  });
});

describe("readHistory", () => {
  it("reads one page of closed days, newest first, with the total for paging", async () => {
    const { db, queries } = fakeDb([{ data: [day(), day({ game_date: "2026-11-09", outcome: "broken", final_pass_rate: null })], error: null, count: 31 }]);
    expect(await readHistory(db, 2)).toEqual({
      days: [
        { gameDate: "2026-11-10", challengeType: "stacking", finalPassRate: 0.74, threshold: 0.6, outcome: "survived" },
        { gameDate: "2026-11-09", challengeType: "stacking", finalPassRate: null, threshold: 0.6, outcome: "broken" },
      ],
      page: 2,
      pageCount: 2,
    });
    expect(queries[0]).toEqual([
      ["from", "game_days"],
      ["select", "game_date, challenge_type, final_pass_rate, survival_threshold, outcome", { count: "exact" }],
      ["not", "closed_at", "is", null],
      ["order", "game_date", { ascending: false }],
      ["range", HISTORY_PAGE_SIZE, 2 * HISTORY_PAGE_SIZE - 1],
    ]);
  });

  it("reads the first page from the newest day", async () => {
    const { db, queries } = fakeDb([{ data: [], error: null, count: 0 }]);
    await readHistory(db, 1);
    expect(queries[0].at(-1)).toEqual(["range", 0, HISTORY_PAGE_SIZE - 1]);
  });

  it.each([
    [30, 1],
    [31, 2],
    [60, 2],
    [61, 3],
  ])("puts %i closed days on %i pages of 30", async (count, pageCount) => {
    const { db } = fakeDb([{ data: [], error: null, count }]);
    expect(await readHistory(db, 1)).toMatchObject({ pageCount });
  });

  it("has no page that starts past the last day (PostgREST answers that range with PGRST103)", async () => {
    const { db } = fakeDb([{ data: null, error: { message: "Requested range not satisfiable", code: "PGRST103" }, count: null }]);
    expect(await readHistory(db, 999)).toBeNull();
  });

  it("has one (empty) page when nothing has closed yet", async () => {
    const { db } = fakeDb([{ data: [], error: null, count: 0 }]);
    expect(await readHistory(db, 1)).toEqual({ days: [], page: 1, pageCount: 1 });
  });

  it.each([
    ["a database error", { data: null, error: { message: "down" } }, /History lookup failed: down/],
    ["a malformed rate", { data: [day({ final_pass_rate: "x" })], error: null, count: 1 }, /final_pass_rate/],
    ["a missing count", { data: [], error: null, count: null }, /count/],
  ])("throws on %s", async (_name, result, message) => {
    const { db } = fakeDb([result as Result]);
    await expect(readHistory(db, 1)).rejects.toThrow(message);
  });
});
