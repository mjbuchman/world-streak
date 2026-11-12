import { describe, expect, it, vi } from "vitest";
import { flashCount } from "@/challenges/flash-count/engine";
import { innerClock } from "@/challenges/inner-clock/engine";
import { simulate, stacking } from "@/challenges/stacking/engine";
import { tapsForAMiss } from "@/challenges/stacking/player";
import { submitAttempt, type SubmitStore } from "./submit";

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

function fakeStore(overrides: Partial<SubmitStore> = {}): SubmitStore {
  return {
    findAttemptById: vi.fn(async () => ({ userId, gameDate: "2026-11-08", seed, startedAt, submitted: false })),
    gameDay: vi.fn(async () => ({ challengeType: "stacking", passTarget: 2, closed: false })),
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

    expect(result).toEqual({ status: 200, body: { score, passed: score >= 2, passTarget: 2 } });
    expect(store.findAttemptById).toHaveBeenCalledWith(attemptId);
    expect(store.gameDay).toHaveBeenCalledWith("2026-11-08");
    expect(store.recordResult).toHaveBeenCalledWith({ attemptId, inputs: { tapsMs: goodTaps }, score, passed: score >= 2 });
  });

  it("decides pass or fail from the day's target, never from the request", async () => {
    // Claims a pass with a run that scores below the target.
    const score = simulate(params, shortRun).score;
    const store = fakeStore({ gameDay: vi.fn(async () => ({ challengeType: "stacking", passTarget: score + 1, closed: false })) });
    const result = await submit({ attemptId, inputs: { tapsMs: shortRun }, score: 99, passed: true }, store);
    expect(result).toEqual({ status: 200, body: { score, passed: false, passTarget: score + 1 } });
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
    const at = (passTarget: number) => fakeStore({ gameDay: vi.fn(async () => ({ challengeType: "stacking", passTarget, closed: false })) });
    expect((await submit({ attemptId, inputs: { tapsMs: goodTaps } }, at(score))).body).toMatchObject({ passed: true });
    expect((await submit({ attemptId, inputs: { tapsMs: goodTaps } }, at(score + 1))).body).toMatchObject({ passed: false });
  });

  it("passes a lower score for a lower-better challenge (Second Sense), and fails a higher one", async () => {
    const target = innerClock.paramsFromSeed(seed).targetMs;
    // 0.25 s off the target, against a pass target of 0.3 s (passes) and of 0.2 s (fails).
    const inputs = { tapMs: target + 250 };
    const day = (passTarget: number) =>
      fakeStore({ gameDay: vi.fn(async () => ({ challengeType: "inner-clock", passTarget, closed: false })) });
    expect((await submit({ attemptId, inputs }, day(0.3))).body).toEqual({ score: 0.25, passed: true, passTarget: 0.3 });
    expect((await submit({ attemptId, inputs }, day(0.2))).body).toEqual({ score: 0.25, passed: false, passTarget: 0.2 });
  });

  describe("every challenge type, with no type-specific branches (T30)", () => {
    const dayOf = (challengeType: string, passTarget: number) =>
      fakeStore({ gameDay: vi.fn(async () => ({ challengeType, passTarget, closed: false })) });

    it("Second Sense with a target of 0.5 s: 0.32 s off passes, 0.6 s off fails", async () => {
      const target = innerClock.paramsFromSeed(seed).targetMs;
      const pass = await submit({ attemptId, inputs: { tapMs: target - 320 } }, dayOf("inner-clock", 0.5));
      expect(pass.body).toEqual({ score: 0.32, passed: true, passTarget: 0.5 });
      const fail = await submit({ attemptId, inputs: { tapMs: target + 600 } }, dayOf("inner-clock", 0.5));
      expect(fail.body).toEqual({ score: 0.6, passed: false, passTarget: 0.5 });
    });

    it("Swift Sum with a target of 15%: the true count passes, a count 50% off fails", async () => {
      const { dotCount } = flashCount.paramsFromSeed(seed);
      const pass = await submit({ attemptId, inputs: { count: dotCount } }, dayOf("flash-count", 15));
      expect(pass.body).toEqual({ score: 0, passed: true, passTarget: 15 });
      const store = dayOf("flash-count", 15);
      const fail = await submit({ attemptId, inputs: { count: dotCount * 2 } }, store);
      expect(fail.body).toEqual({ score: 100, passed: false, passTarget: 15 });
      expect(store.recordResult).toHaveBeenCalledWith({ attemptId, inputs: { count: dotCount * 2 }, score: 100, passed: false });
    });

    it("refuses another challenge's inputs (each type's own schema decides)", async () => {
      for (const [challengeType, inputs] of [
        ["inner-clock", { tapsMs: goodTaps }],
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
      findAttemptById: vi.fn(async () => ({ userId: "someone-else", gameDate: "2026-11-08", seed, startedAt, submitted: false })),
    });
    expect(await submit({ attemptId, inputs: { tapsMs: shortRun } }, theirs)).toEqual({ status: 404, body: { error: "not-found" } });
    expect(theirs.recordResult).not.toHaveBeenCalled();
  });

  it("returns 409 already-submitted for a submitted attempt", async () => {
    const store = fakeStore({
      findAttemptById: vi.fn(async () => ({ userId, gameDate: "2026-11-08", seed, startedAt, submitted: true })),
    });
    expect(await submit({ attemptId, inputs: { tapsMs: shortRun } }, store)).toEqual({ status: 409, body: { error: "already-submitted" } });
    expect(store.recordResult).not.toHaveBeenCalled();
  });

  it("returns 409 day-closed once the attempt's game date is over, or its day is closed", async () => {
    // Started at 23:59:30 on Nov 8, submitted after the midnight deadline.
    const lateStart = new Date("2026-11-08T23:59:30Z");
    const late = fakeStore({
      findAttemptById: vi.fn(async () => ({ userId, gameDate: "2026-11-08", seed, startedAt: lateStart, submitted: false })),
    });
    const afterDeadline = new Date("2026-11-09T00:00:10Z");
    expect(await submit({ attemptId, inputs: { tapsMs: [900] } }, late, afterDeadline)).toEqual({
      status: 409,
      body: { error: "day-closed" },
    });
    expect(late.recordResult).not.toHaveBeenCalled();

    const closed = fakeStore({ gameDay: vi.fn(async () => ({ challengeType: "stacking", passTarget: 2, closed: true })) });
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

    it("checks against the player's earlier scores", async () => {
      const target = innerClock.paramsFromSeed(seed).targetMs;
      const near = { challengeType: "inner-clock", score: 0.002 };
      const store = fakeStore({
        gameDay: vi.fn(async () => ({ challengeType: "inner-clock", passTarget: 0.5, closed: false })),
        recentScores: vi.fn(async () => [near, near]),
      });
      const at = new Date(startedAt.getTime() + target + 1_000);
      expect(await submit({ attemptId, inputs: { tapMs: target } }, store, at)).toMatchObject({ status: 200, body: { passed: true } });
      expect(store.recentScores).toHaveBeenCalledWith(userId, "2026-11-08");
      expect(store.recordFlags).toHaveBeenCalledWith(attemptId, ["inner-clock-implausible"]);
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

  it("fails loudly on a game day whose challenge type the server does not know", async () => {
    const store = fakeStore({ gameDay: vi.fn(async () => ({ challengeType: "chess", passTarget: 1, closed: false })) });
    await expect(submit({ attemptId, inputs: { tapsMs: shortRun } }, store)).rejects.toThrow(/chess/);
  });
});
