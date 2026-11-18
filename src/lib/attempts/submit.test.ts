import { describe, expect, it, vi } from "vitest";
import { flashLadder } from "@/challenges/flash-count/flashLadder";
import { timeBank } from "@/challenges/inner-clock/timeBank";
import { simulate, stacking } from "@/challenges/stacking/engine";
import { tapsForAMiss } from "@/challenges/stacking/player";
import { submitAttempt, type SubmitStore } from "./submit";
import type { DayResult, GameAttempt, GameDay } from "./types";

const userId = "8f14e45f-ceea-467a-9f9b-1b6f0f0e2f11";
const attemptId = "0b6d1d6c-6c1e-4b8e-9a4a-5f3c2d1e0a9b";
const seed = 1234;
const startedAt = new Date("2026-11-08T12:00:00.000Z");
// 30 s after the start, still game date Nov 8.
const now = new Date("2026-11-08T12:00:30.000Z");

const params = stacking.paramsFromSeed(seed);
// A finished run on this seed that stacks some rows (both checked below). The game only
// submits finished runs.
const goodTaps = [930, 1712, 2577];
// The shortest finished run: whatever the search finds first.
const shortRun = tapsForAMiss(params);

// A one-game day by default; the lineup tests below give it three.
const lineupOf = (challengeType: string, passTarget: number, closed = false) =>
  vi.fn(async (): Promise<GameDay> => ({ closed, games: [{ position: 1, challengeType, passTarget }] }));
const attemptAt = (position: number, rest: { submitted?: boolean; startedAt?: Date; userId?: string } = {}) =>
  vi.fn(async () => ({ userId, gameDate: "2026-11-08", position, seed, startedAt, submitted: false, ...rest }));

function fakeStore(overrides: Partial<SubmitStore> = {}): SubmitStore {
  return {
    findAttemptById: attemptAt(1),
    gameDay: lineupOf("stacking", 2),
    dayAttempts: vi.fn(async (): Promise<GameAttempt[]> => [{ position: 1, submitted: true, score: 3, passed: true }]),
    dayResult: vi.fn(async (): Promise<DayResult> => ({ wins: 1, losses: 0, outcome: "passed" })),
    recordResult: vi.fn(async () => "recorded" as const),
    recentScores: vi.fn(async () => []),
    recordFlags: vi.fn(async () => {}),
    ...overrides,
  };
}

const submit = (body: unknown, store = fakeStore(), at = now) => submitAttempt({ userId, body, now: at, store });

describe("submitAttempt", () => {
  it("scores the inputs by replaying the engine on the attempt's seed, and records the result", async () => {
    const store = fakeStore();
    const score = stacking.score(stacking.paramsFromSeed(seed), { tapsMs: goodTaps });
    expect(score).toBeGreaterThan(0);
    expect(simulate(params, goodTaps).endReason).not.toBe("running");

    const result = await submit({ attemptId, inputs: { tapsMs: goodTaps } }, store);

    expect(result).toEqual({
      status: 200,
      body: { score, passed: score >= 2, passTarget: 2, day: { wins: 1, losses: 0, outcome: "passed", nextPosition: null } },
    });
    expect(store.findAttemptById).toHaveBeenCalledWith(attemptId);
    expect(store.gameDay).toHaveBeenCalledWith("2026-11-08");
    expect(store.recordResult).toHaveBeenCalledWith({ attemptId, inputs: { tapsMs: goodTaps }, score, passed: score >= 2 });
  });

  it("decides pass or fail from the day's target, never from the request", async () => {
    // Claims a pass with a run that scores below the target.
    const score = simulate(params, shortRun).score;
    const store = fakeStore({ gameDay: lineupOf("stacking", score + 1) });
    const result = await submit({ attemptId, inputs: { tapsMs: shortRun }, score: 99, passed: true }, store);
    expect(result).toMatchObject({ status: 200, body: { score, passed: false, passTarget: score + 1 } });
    expect(store.recordResult).toHaveBeenCalledWith({ attemptId, inputs: { tapsMs: shortRun }, score, passed: false });
  });

  it("refuses taps that stop before the run ended (the game only submits finished runs)", async () => {
    for (const tapsMs of [[], [930]]) {
      expect(simulate(params, tapsMs).endReason).toBe("running");
      const store = fakeStore();
      expect(await submit({ attemptId, inputs: { tapsMs } }, store)).toEqual({ status: 400, body: { error: "invalid-inputs" } });
      expect(store.recordResult).not.toHaveBeenCalled();
    }
  });

  it("passes a score equal to the target (higher is better), and fails one below it", async () => {
    const score = stacking.score(stacking.paramsFromSeed(seed), { tapsMs: goodTaps });
    const at = (passTarget: number) => fakeStore({ gameDay: lineupOf("stacking", passTarget) });
    expect((await submit({ attemptId, inputs: { tapsMs: goodTaps } }, at(score))).body).toMatchObject({ passed: true });
    expect((await submit({ attemptId, inputs: { tapsMs: goodTaps } }, at(score + 1))).body).toMatchObject({ passed: false });
  });

  describe("every challenge type, with no type-specific branches (T30)", () => {
    const dayOf = (challengeType: string, passTarget: number) => fakeStore({ gameDay: lineupOf(challengeType, passTarget) });

    it("Second Sense with a target of 4: surviving all four with an empty bank passes, busting in round 4 fails", async () => {
      const targets = timeBank.paramsFromSeed(seed).rounds.map((round) => round.targetMs);
      // Three rounds exactly on target, then a fourth off by `lastErrorMs`.
      const run = (lastErrorMs: number) => ({ tapsMs: [...targets.slice(0, 3), targets[3] + lastErrorMs] });
      // Later than any of these runs could end.
      const later = new Date(startedAt.getTime() + 150_000);
      const pass = await submit({ attemptId, inputs: run(10_000) }, dayOf("inner-clock", 4), later);
      expect(pass.body).toMatchObject({ score: 4, passed: true, passTarget: 4 });
      const fail = await submit({ attemptId, inputs: run(10_001) }, dayOf("inner-clock", 4), later);
      expect(fail.body).toMatchObject({ score: 3, passed: false, passTarget: 4 });
    });

    it("Swift Sum with a target of 5 rounds: all five survived passes, a bust in round 5 fails", async () => {
      const counts = flashLadder.paramsFromSeed(seed).levels.map((level) => level.dotCount);
      // Rounds exactly right, then (for the fail) a count of 999, which busts any bank.
      const run = (...answers: number[]) => ({ answers: answers.map((count, i) => ({ count, atMs: 5_000 * (i + 1) })) });
      // A minute after the start: later than any of these runs' last answer.
      const later = new Date(startedAt.getTime() + 60_000);
      const pass = await submit({ attemptId, inputs: run(...counts) }, dayOf("flash-count", 5), later);
      expect(pass.body).toMatchObject({ score: 6, passed: true, passTarget: 5 });
      const store = dayOf("flash-count", 5);
      const bust = run(...counts.slice(0, 4), 999);
      const fail = await submit({ attemptId, inputs: bust }, store, later);
      expect(fail.body).toMatchObject({ score: 4, passed: false, passTarget: 5 });
      expect(store.recordResult).toHaveBeenCalledWith({ attemptId, inputs: bust, score: 4, passed: false });
    });

    it("refuses another challenge's inputs (each type's own schema decides)", async () => {
      for (const [challengeType, inputs] of [
        ["inner-clock", { count: 3 }],
        ["flash-count", { tapMs: 500 }],
        ["stacking", { count: 3 }],
      ] as const) {
        expect(await submit({ attemptId, inputs }, dayOf(challengeType, 1))).toEqual({ status: 400, body: { error: "invalid-inputs" } });
      }
    });
  });

  it("returns 400 for a malformed body, without touching the database", async () => {
    for (const body of [null, "x", {}, { attemptId: "not-a-uuid", inputs: {} }, { inputs: { tapsMs: shortRun } }]) {
      const store = fakeStore();
      expect(await submit(body, store)).toEqual({ status: 400, body: { error: "invalid-body" } });
      expect(store.findAttemptById).not.toHaveBeenCalled();
    }
  });

  it("returns 400 when the inputs fail the challenge's schema, recording nothing", async () => {
    for (const inputs of [{ tapsMs: [900, 800] }, { tapsMs: [-1] }, { taps: [1] }, "taps"]) {
      const store = fakeStore();
      expect(await submit({ attemptId, inputs }, store)).toEqual({ status: 400, body: { error: "invalid-inputs" } });
      expect(store.recordResult).not.toHaveBeenCalled();
    }
  });

  it("returns 404 for an unknown attempt or someone else's", async () => {
    const missing = fakeStore({ findAttemptById: vi.fn(async () => null) });
    expect(await submit({ attemptId, inputs: { tapsMs: shortRun } }, missing)).toEqual({ status: 404, body: { error: "not-found" } });

    const theirs = fakeStore({
      findAttemptById: attemptAt(1, { userId: "someone-else" }),
    });
    expect(await submit({ attemptId, inputs: { tapsMs: shortRun } }, theirs)).toEqual({ status: 404, body: { error: "not-found" } });
    expect(theirs.recordResult).not.toHaveBeenCalled();
  });

  it("returns 409 already-submitted for a submitted attempt", async () => {
    const store = fakeStore({
      findAttemptById: attemptAt(1, { submitted: true }),
    });
    expect(await submit({ attemptId, inputs: { tapsMs: shortRun } }, store)).toEqual({ status: 409, body: { error: "already-submitted" } });
    expect(store.recordResult).not.toHaveBeenCalled();
  });

  it("returns 409 day-closed once the attempt's game date is over, or its day is closed", async () => {
    // Started at 23:59:30 on Nov 8, submitted after the midnight deadline.
    const lateStart = new Date("2026-11-08T23:59:30Z");
    const late = fakeStore({
      findAttemptById: attemptAt(1, { startedAt: lateStart }),
    });
    const afterDeadline = new Date("2026-11-09T00:00:10Z");
    expect(await submit({ attemptId, inputs: { tapsMs: [900] } }, late, afterDeadline)).toEqual({
      status: 409,
      body: { error: "day-closed" },
    });
    expect(late.recordResult).not.toHaveBeenCalled();

    const closed = fakeStore({ gameDay: lineupOf("stacking", 2, true) });
    expect(await submit({ attemptId, inputs: { tapsMs: shortRun } }, closed)).toEqual({ status: 409, body: { error: "day-closed" } });
    expect(closed.recordResult).not.toHaveBeenCalled();
  });

  it("returns 422 when the last input is later than the attempt has been running, plus 2 s of slack", async () => {
    // A run whose last tap is at `last` ms may arrive once the attempt has run `last - 2000` ms.
    const last = shortRun.at(-1)!;
    const after = (elapsedMs: number) => new Date(startedAt.getTime() + elapsedMs);
    expect((await submit({ attemptId, inputs: { tapsMs: shortRun } }, fakeStore(), after(last - 2_000))).status).toBe(200);
    const store = fakeStore();
    expect(await submit({ attemptId, inputs: { tapsMs: shortRun } }, store, after(last - 2_001))).toEqual({
      status: 422,
      body: { error: "implausible-timing" },
    });
    expect(store.recordResult).not.toHaveBeenCalled();
  });

  it("accepts a slow run: there is no time limit, only the day's deadline (human decision, T87)", async () => {
    // A player who waited ten minutes on row 1 before playing it out.
    const slow = tapsForAMiss(params, [600_000], 600_001);
    const tenMinutesLater = new Date(startedAt.getTime() + slow.at(-1)! + 5_000);
    const result = await submit({ attemptId, inputs: { tapsMs: slow } }, fakeStore(), tenMinutesLater);
    expect(result).toMatchObject({ status: 200, body: { score: simulate(params, slow).score } });
  });

  it("reports what the database found if a simultaneous submission or the close job got there first", async () => {
    for (const [status, error] of [
      ["already-submitted", 409],
      ["day-closed", 409],
      ["not-found", 404],
    ] as const) {
      const store = fakeStore({ recordResult: vi.fn(async () => status) });
      expect(await submit({ attemptId, inputs: { tapsMs: shortRun } }, store)).toEqual({ status: error, body: { error: status } });
    }
  });

  describe("cheat checks (T41)", () => {
    // goodTaps end at 2,577 ms: 3 s after the start is ordinary, 30 s is far behind the server's clock.
    const soon = new Date(startedAt.getTime() + 3_000);

    it("records the reasons the checks find, and answers exactly as it would without them", async () => {
      const flaggedStore = fakeStore();
      const flagged = await submit({ attemptId, inputs: { tapsMs: goodTaps } }, flaggedStore, now);
      expect(flaggedStore.recordFlags).toHaveBeenCalledExactlyOnceWith(attemptId, ["timing-mismatch"]);

      const cleanStore = fakeStore();
      const clean = await submit({ attemptId, inputs: { tapsMs: goodTaps } }, cleanStore, soon);
      expect(cleanStore.recordFlags).not.toHaveBeenCalled();
      // Same status, same fields, same values: a flag is invisible to the player.
      expect(flagged).toEqual(clean);
    });

    it("reads the player's earlier scores for the checks, and flags no honest Second Sense run", async () => {
      // No rule reads the history since T140 retired Second Sense's; T164 brings history rules back.
      const first = timeBank.paramsFromSeed(seed).rounds[0];
      const store = fakeStore({
        gameDay: lineupOf("inner-clock", 0),
        recentScores: vi.fn(async () => [{ challengeType: "inner-clock", score: 5 }]),
      });
      // A first tap later than the whole bank.
      const inputs = { tapsMs: [first.targetMs + 10_001] };
      const at = new Date(startedAt.getTime() + first.targetMs + 10_001 + 1_000);
      expect(await submit({ attemptId, inputs }, store, at)).toMatchObject({ status: 200, body: { score: 0, passed: true } });
      expect(store.recentScores).toHaveBeenCalledWith(userId, "2026-11-08");
      expect(store.recordFlags).not.toHaveBeenCalled();
    });

    it("still answers with the result if recording a flag fails (the result is already stored)", async () => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => {});
      const store = fakeStore({ recordFlags: vi.fn(async () => Promise.reject(new Error("down"))) });
      const result = await submit({ attemptId, inputs: { tapsMs: goodTaps } }, store, now);
      expect(result.status).toBe(200);
      expect(logged).toHaveBeenCalled();
      logged.mockRestore();
    });

    it("checks nothing when the result was not recorded", async () => {
      const store = fakeStore({ recordResult: vi.fn(async () => "already-submitted" as const) });
      await submit({ attemptId, inputs: { tapsMs: goodTaps } }, store, now);
      expect(store.recentScores).not.toHaveBeenCalled();
      expect(store.recordFlags).not.toHaveBeenCalled();
    });
  });

  it("fails loudly on a lineup game whose challenge type the server does not know", async () => {
    const store = fakeStore({ gameDay: lineupOf("chess", 1) });
    await expect(submit({ attemptId, inputs: { tapsMs: shortRun } }, store)).rejects.toThrow(/chess/);
  });

  it("fails loudly if the attempt's day or its game is missing from the lineup", async () => {
    await expect(submit({ attemptId, inputs: { tapsMs: shortRun } }, fakeStore({ gameDay: vi.fn(async () => null) }))).rejects.toThrow(
      "Game day 2026-11-08 does not exist",
    );
    await expect(submit({ attemptId, inputs: { tapsMs: shortRun } }, fakeStore({ findAttemptById: attemptAt(2) }))).rejects.toThrow(
      "Game day 2026-11-08 has no game 2",
    );
  });

  describe("the Daily Three (T154)", () => {
    // Game 2 is Stacking with a target of 3 rows, so the same runs pass and fail it.
    const lineup = vi.fn(
      async (): Promise<GameDay> => ({
        closed: false,
        games: [
          { position: 1, challengeType: "inner-clock", passTarget: 4 },
          { position: 2, challengeType: "stacking", passTarget: 3 },
          { position: 3, challengeType: "flash-count", passTarget: 5 },
        ],
      }),
    );
    const score = stacking.score(params, { tapsMs: goodTaps });

    it("judges game 2 with its own challenge and target, and answers the day so far with the next game", async () => {
      const store = fakeStore({
        findAttemptById: attemptAt(2),
        gameDay: lineup,
        dayAttempts: vi.fn(async (): Promise<GameAttempt[]> => [
          { position: 1, submitted: true, score: 1, passed: false },
          { position: 2, submitted: true, score, passed: score >= 3 },
        ]),
        dayResult: vi.fn(async (): Promise<DayResult> => ({ wins: 1, losses: 1, outcome: null })),
      });
      expect(await submit({ attemptId, inputs: { tapsMs: goodTaps } }, store)).toEqual({
        status: 200,
        body: { score, passed: score >= 3, passTarget: 3, day: { wins: 1, losses: 1, outcome: null, nextPosition: 3 } },
      });
      expect(store.recordResult).toHaveBeenCalledWith({ attemptId, inputs: { tapsMs: goodTaps }, score, passed: score >= 3 });
      expect(store.recentScores).toHaveBeenCalledWith(userId, "2026-11-08");
      // The day is read after the result is stored, so it includes this game.
      const order = (fn: unknown) => (fn as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
      expect(order(store.recordResult)).toBeLessThan(order(store.dayResult));
      expect(order(store.recordResult)).toBeLessThan(order(store.dayAttempts));
    });

    it("answers a decided day, with no next game once all three have started", async () => {
      const store = fakeStore({
        findAttemptById: attemptAt(2),
        gameDay: lineup,
        dayAttempts: vi.fn(async (): Promise<GameAttempt[]> => [
          { position: 1, submitted: true, score: 9, passed: true },
          { position: 2, submitted: true, score, passed: true },
          { position: 3, submitted: false },
        ]),
        dayResult: vi.fn(async (): Promise<DayResult> => ({ wins: 2, losses: 1, outcome: "passed" })),
      });
      const result = await submit({ attemptId, inputs: { tapsMs: goodTaps } }, store);
      expect(result).toMatchObject({ status: 200, body: { day: { wins: 2, losses: 1, outcome: "passed", nextPosition: null } } });
    });

    it("refuses inputs for the day's other games (game 2's schema decides)", async () => {
      const store = fakeStore({ findAttemptById: attemptAt(2), gameDay: lineup });
      expect(await submit({ attemptId, inputs: { answers: [] } }, store)).toEqual({ status: 400, body: { error: "invalid-inputs" } });
      expect(store.recordResult).not.toHaveBeenCalled();
    });

    it("reads no day when the result was not recorded", async () => {
      const store = fakeStore({ findAttemptById: attemptAt(2), gameDay: lineup, recordResult: vi.fn(async () => "day-closed" as const) });
      expect(await submit({ attemptId, inputs: { tapsMs: goodTaps } }, store)).toEqual({ status: 409, body: { error: "day-closed" } });
      expect(store.dayResult).not.toHaveBeenCalled();
    });
  });
});
