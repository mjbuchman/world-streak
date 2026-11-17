import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { DEFAULT_CHALLENGE, todaysChallenge, todaysDay } from "./today";

type Result = { data: unknown; error: { message: string } | null };

/** Records the query and resolves it to `result` (same approach as store.test.ts). */
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
    // The player's own client must only read; no database function runs on it.
    rpc: () => {
      throw new Error("todaysAttempt must not call an rpc");
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const userId = "u1";
// 23:30 UTC on Nov 8 is still game date Nov 8.
const now = new Date("2026-11-08T23:30:00Z");

/** A player's client whose reads of each table answer that table's result. */
function fakeTables(results: { game_days?: Result; attempts?: Result; day_results?: Result }) {
  const calls: unknown[][] = [];
  const db = {
    from: (table: keyof typeof results) => {
      const result = results[table] ?? { data: null, error: null };
      const query: object = new Proxy(
        {},
        {
          get(_, method) {
            if (method === "then") return (resolve: (value: Result) => void) => resolve(result);
            return (...args: unknown[]) => {
              calls.push([table, method, ...args]);
              return query;
            };
          },
        },
      );
      return query;
    },
    rpc: () => {
      throw new Error("todaysDay must not call an rpc");
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const lineup = {
  closed_at: null,
  game_day_games: [
    { position: 1, challenge_type: "stacking", pass_target: 10 },
    { position: 2, challenge_type: "inner-clock", pass_target: "4" },
    { position: 3, challenge_type: "flash-count", pass_target: 5 },
  ],
};
const games = [
  { position: 1, challengeType: "stacking", passTarget: 10 },
  { position: 2, challengeType: "inner-clock", passTarget: 4 },
  { position: 3, challengeType: "flash-count", passTarget: 5 },
];
const attempt = (position: number, score: number | null, passed: boolean | null) => ({
  position,
  score,
  passed,
  submitted_at: score === null ? null : "2026-11-08T12:00:00+00:00",
});
const ok = (data: unknown): Result => ({ data, error: null });

describe("todaysDay", () => {
  it("gives every game as not started before the player's first start", async () => {
    const { db, calls } = fakeTables({ game_days: ok(lineup), attempts: ok([]) });
    expect(await todaysDay(db, userId, now)).toEqual({
      gameDate: "2026-11-08",
      games: games.map((game) => ({ ...game, status: "not-started" })),
      wins: 0,
      losses: 0,
      outcome: null,
      nextPosition: 1,
    });
    // The lineup, the player's own attempts and their own day result, all for today's game date.
    expect(calls).toContainEqual(["game_days", "eq", "game_date", "2026-11-08"]);
    expect(calls).toContainEqual(["attempts", "eq", "user_id", userId]);
    expect(calls).toContainEqual(["day_results", "eq", "user_id", userId]);
  });

  it("gives each game's status (won, lost, in progress, not started), its score, the outcome and the next game", async () => {
    const { db } = fakeTables({
      game_days: ok(lineup),
      attempts: ok([attempt(1, 12, true), attempt(2, null, null)]),
      day_results: ok({ wins: 1, losses: 1, outcome: null }),
    });
    expect(await todaysDay(db, userId, now)).toEqual({
      gameDate: "2026-11-08",
      games: [
        { ...games[0], status: "won", score: 12 },
        { ...games[1], status: "in-progress" },
        { ...games[2], status: "not-started" },
      ],
      // The day so far, as day_results counts it (a started game is a loss until it passes).
      wins: 1,
      losses: 1,
      outcome: null,
      nextPosition: 3,
    });
  });

  it("gives a decided day, with no next game once all three have started", async () => {
    const { db } = fakeTables({
      game_days: ok(lineup),
      attempts: ok([attempt(1, 3, false), attempt(2, 1, false), attempt(3, 7, true)]),
      day_results: ok({ wins: 1, losses: 2, outcome: "failed" }),
    });
    const day = await todaysDay(db, userId, now);
    expect(day.games.map((game) => game.status)).toEqual(["lost", "lost", "won"]);
    expect(day).toMatchObject({ wins: 1, losses: 2, outcome: "failed", nextPosition: null });
  });

  it("gives an empty lineup, with game 1 next, while nobody has started today (the day does not exist yet)", async () => {
    const { db } = fakeTables({ attempts: ok([]) });
    expect(await todaysDay(db, userId, now)).toEqual({
      gameDate: "2026-11-08",
      games: [],
      wins: 0,
      losses: 0,
      outcome: null,
      nextPosition: 1,
    });
  });

  it("looks up the game date at the deadline, not the calendar date", async () => {
    // One ms before the midnight UTC deadline is still Nov 8; the deadline itself is Nov 9.
    const before = fakeTables({ attempts: ok([]) });
    expect((await todaysDay(before.db, userId, new Date("2026-11-08T23:59:59.999Z"))).gameDate).toBe("2026-11-08");
    const at = fakeTables({ attempts: ok([]) });
    expect((await todaysDay(at.db, userId, new Date("2026-11-09T00:00:00.000Z"))).gameDate).toBe("2026-11-09");
    expect(at.calls).toContainEqual(["game_days", "eq", "game_date", "2026-11-09"]);
  });

  it("throws on a database error, rather than offering a Start that would fail", async () => {
    const { db } = fakeTables({ attempts: { data: null, error: { message: "connection refused" } } });
    await expect(todaysDay(db, userId, now)).rejects.toThrow(/connection refused/);
  });
});


describe("todaysChallenge", () => {
  /** A client whose game day read answers `day` and whose rotation call answers `rotation`. */
  function fakeChallengeDb(day: Result, rotation: Result = { data: null, error: null }) {
    const day$ = fakeDb(day);
    const rpcCalls: unknown[][] = [];
    const db = {
      from: day$.db.from,
      rpc: (...args: unknown[]) => {
        rpcCalls.push(args);
        return Promise.resolve(rotation);
      },
    } as unknown as SupabaseClient;
    return { db, calls: day$.calls, rpcCalls };
  }

  it("reads today's first game from the public lineup, without asking the rotation", async () => {
    const { db, calls, rpcCalls } = fakeChallengeDb({ data: { challenge_type: "flash-count" }, error: null });
    expect(await todaysChallenge(db, now)).toBe("flash-count");
    expect(calls).toEqual([
      ["from", "game_day_games"],
      ["select", "challenge_type"],
      ["eq", "game_date", "2026-11-08"],
      ["eq", "position", 1],
      ["maybeSingle"],
    ]);
    expect(rpcCalls).toEqual([]);
  });

  it("asks the rotation which challenge today will be when nobody has created the day yet (T31)", async () => {
    const { db, rpcCalls } = fakeChallengeDb({ data: null, error: null }, { data: "inner-clock", error: null });
    expect(await todaysChallenge(db, now)).toBe("inner-clock");
    expect(rpcCalls).toEqual([["challenge_for", { d: "2026-11-08" }]]);
  });

  it("throws on a database error or a challenge this build does not know, from either source", async () => {
    await expect(todaysChallenge(fakeChallengeDb({ data: null, error: { message: "down" } }).db, now)).rejects.toThrow(
      "Game day lookup failed: down",
    );
    await expect(todaysChallenge(fakeChallengeDb({ data: null, error: null }, { data: null, error: { message: "gone" } }).db, now)).rejects.toThrow(
      "Rotation lookup failed: gone",
    );
    await expect(todaysChallenge(fakeChallengeDb({ data: { challenge_type: "chess" }, error: null }).db, now)).rejects.toThrow(
      'Game day 2026-11-08 has unknown challenge type "chess"',
    );
    await expect(todaysChallenge(fakeChallengeDb({ data: null, error: null }, { data: null, error: null }).db, now)).rejects.toThrow(
      "Game day 2026-11-08 has unknown challenge type null",
    );
  });

  it("keeps a default for the home page when nothing can be read", () => {
    expect(DEFAULT_CHALLENGE).toBe("stacking");
  });
});
