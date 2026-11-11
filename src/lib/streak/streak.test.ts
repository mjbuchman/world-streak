import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  HISTORY_PAGE_SIZE,
  challengeName,
  dayLabel,
  passRateLabel,
  readHistory,
  readStreakSummary,
  streakLabel,
  yesterdayLine,
} from "./streak";

type Result = { data: unknown; error: { message: string } | null; count?: number | null };

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
    expect(streakLabel(0)).toBe("World streak: 0 days");
    expect(streakLabel(1)).toBe("World streak: 1 day");
    expect(streakLabel(12)).toBe("World streak: 12 days");
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

describe("readStreakSummary", () => {
  it("reads the streak and yesterday's closed result", async () => {
    const { db, queries } = fakeDb([
      { data: { current: 3, best: 5, current_start_date: "2026-11-08" }, error: null },
      { data: { outcome: "survived", final_pass_rate: "0.74" }, error: null },
    ]);
    expect(await readStreakSummary(db, new Date("2026-11-11T09:00:00Z"))).toEqual({
      current: 3,
      best: 5,
      yesterday: { outcome: "survived", finalPassRate: 0.74 },
    });
    expect(queries[1]).toEqual([
      ["from", "game_days"],
      ["select", "outcome, final_pass_rate"],
      ["eq", "game_date", "2026-11-10"],
      ["not", "closed_at", "is", null],
      ["maybeSingle"],
    ]);
  });

  it("has no yesterday line until yesterday has closed", async () => {
    const { db } = fakeDb([
      { data: { current: 0, best: 0, current_start_date: null }, error: null },
      { data: null, error: null },
    ]);
    expect(await readStreakSummary(db, new Date("2026-11-11T00:00:10Z"))).toMatchObject({ yesterday: null });
  });

  it.each([
    ["the streak", [{ data: null, error: { message: "down" } }, { data: null, error: null }], /World streak lookup failed: down/],
    ["a malformed streak", [{ data: { current: -1, best: 0 }, error: null }, { data: null, error: null }], /current/],
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
    const { db } = fakeDb(results as Result[]);
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
