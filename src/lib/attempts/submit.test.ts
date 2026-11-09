import { describe, expect, it, vi } from "vitest";
import { stacking } from "@/challenges/stacking/engine";
import { ATTEMPT_MAX_AGE_MS } from "@/config/attempts";
import { passes, submitAttempt, type SubmitStore } from "./submit";

const userId = "8f14e45f-ceea-467a-9f9b-1b6f0f0e2f11";
const attemptId = "0b6d1d6c-6c1e-4b8e-9a4a-5f3c2d1e0a9b";
const seed = 1234;
const startedAt = new Date("2026-11-08T12:00:00.000Z");
// 30 s after the start, still game date Nov 8.
const now = new Date("2026-11-08T12:00:30.000Z");

// Taps that stack on this seed (checked below), so the score is above 0.
const goodTaps = [930, 1712, 2577];

function fakeStore(overrides: Partial<SubmitStore> = {}): SubmitStore {
  return {
    findAttempt: vi.fn(async () => ({ userId, gameDate: "2026-11-08", seed, startedAt, submitted: false })),
    gameDay: vi.fn(async () => ({ challengeType: "stacking", passTarget: 2, closed: false })),
    recordResult: vi.fn(async () => "recorded" as const),
    ...overrides,
  };
}

const submit = (body: unknown, store = fakeStore(), at = now) => submitAttempt({ userId, body, now: at, store });

describe("passes", () => {
  it("needs at least the target when higher is better", () => {
    expect(passes(10, 10, "higher-better")).toBe(true);
    expect(passes(9.9, 10, "higher-better")).toBe(false);
  });

  it("needs at most the target when lower is better (for example a time)", () => {
    expect(passes(10, 10, "lower-better")).toBe(true);
    expect(passes(10.1, 10, "lower-better")).toBe(false);
    expect(passes(3, 10, "lower-better")).toBe(true);
  });
});

describe("submitAttempt", () => {
  it("scores the inputs by replaying the engine on the attempt's seed, and records the result", async () => {
    const store = fakeStore();
    const score = stacking.score(stacking.paramsFromSeed(seed), { tapsMs: goodTaps });
    expect(score).toBeGreaterThan(0);

    const result = await submit({ attemptId, inputs: { tapsMs: goodTaps } }, store);

    expect(result).toEqual({ status: 200, body: { score, passed: score >= 2, passTarget: 2 } });
    expect(store.findAttempt).toHaveBeenCalledWith(attemptId);
    expect(store.gameDay).toHaveBeenCalledWith("2026-11-08");
    expect(store.recordResult).toHaveBeenCalledWith({ attemptId, inputs: { tapsMs: goodTaps }, score, passed: score >= 2 });
  });

  it("decides pass or fail from the day's target, never from the request", async () => {
    // Claims a pass with inputs that score 0.
    const store = fakeStore();
    const result = await submit({ attemptId, inputs: { tapsMs: [] }, score: 99, passed: true }, store);
    expect(result).toEqual({ status: 200, body: { score: 0, passed: false, passTarget: 2 } });
    expect(store.recordResult).toHaveBeenCalledWith({ attemptId, inputs: { tapsMs: [] }, score: 0, passed: false });
  });

  it("passes a score equal to the target (higher is better), and fails one below it", async () => {
    const score = stacking.score(stacking.paramsFromSeed(seed), { tapsMs: goodTaps });
    const at = (passTarget: number) => fakeStore({ gameDay: vi.fn(async () => ({ challengeType: "stacking", passTarget, closed: false })) });
    expect((await submit({ attemptId, inputs: { tapsMs: goodTaps } }, at(score))).body).toMatchObject({ passed: true });
    expect((await submit({ attemptId, inputs: { tapsMs: goodTaps } }, at(score + 1))).body).toMatchObject({ passed: false });
  });

  it("returns 400 for a malformed body, without touching the database", async () => {
    for (const body of [null, "x", {}, { attemptId: "not-a-uuid", inputs: {} }, { inputs: { tapsMs: [] } }]) {
      const store = fakeStore();
      expect(await submit(body, store)).toEqual({ status: 400, body: { error: "invalid-body" } });
      expect(store.findAttempt).not.toHaveBeenCalled();
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
    const missing = fakeStore({ findAttempt: vi.fn(async () => null) });
    expect(await submit({ attemptId, inputs: { tapsMs: [] } }, missing)).toEqual({ status: 404, body: { error: "not-found" } });

    const theirs = fakeStore({
      findAttempt: vi.fn(async () => ({ userId: "someone-else", gameDate: "2026-11-08", seed, startedAt, submitted: false })),
    });
    expect(await submit({ attemptId, inputs: { tapsMs: [] } }, theirs)).toEqual({ status: 404, body: { error: "not-found" } });
    expect(theirs.recordResult).not.toHaveBeenCalled();
  });

  it("returns 409 already-submitted for a submitted attempt", async () => {
    const store = fakeStore({
      findAttempt: vi.fn(async () => ({ userId, gameDate: "2026-11-08", seed, startedAt, submitted: true })),
    });
    expect(await submit({ attemptId, inputs: { tapsMs: [] } }, store)).toEqual({ status: 409, body: { error: "already-submitted" } });
    expect(store.recordResult).not.toHaveBeenCalled();
  });

  it("returns 409 day-closed once the attempt's game date is over, or its day is closed", async () => {
    // Started at 23:59:30 on Nov 8, submitted after the midnight deadline.
    const lateStart = new Date("2026-11-08T23:59:30Z");
    const late = fakeStore({
      findAttempt: vi.fn(async () => ({ userId, gameDate: "2026-11-08", seed, startedAt: lateStart, submitted: false })),
    });
    const afterDeadline = new Date("2026-11-09T00:00:10Z");
    expect(await submit({ attemptId, inputs: { tapsMs: [900] } }, late, afterDeadline)).toEqual({
      status: 409,
      body: { error: "day-closed" },
    });
    expect(late.recordResult).not.toHaveBeenCalled();

    const closed = fakeStore({ gameDay: vi.fn(async () => ({ challengeType: "stacking", passTarget: 2, closed: true })) });
    expect(await submit({ attemptId, inputs: { tapsMs: [] } }, closed)).toEqual({ status: 409, body: { error: "day-closed" } });
    expect(closed.recordResult).not.toHaveBeenCalled();
  });

  it("returns 422 when the last input is later than the attempt has been running, plus 2 s of slack", async () => {
    // 30 s since the start: an input at 32,000 ms is allowed, one at 32,001 ms is not.
    expect((await submit({ attemptId, inputs: { tapsMs: [32_000] } })).status).toBe(200);
    const store = fakeStore();
    expect(await submit({ attemptId, inputs: { tapsMs: [32_001] } }, store)).toEqual({
      status: 422,
      body: { error: "implausible-timing" },
    });
    expect(store.recordResult).not.toHaveBeenCalled();
  });

  it("returns 422 when the attempt is older than the maximum age", async () => {
    const atLimit = new Date(startedAt.getTime() + ATTEMPT_MAX_AGE_MS);
    expect((await submit({ attemptId, inputs: { tapsMs: [] } }, fakeStore(), atLimit)).status).toBe(200);
    const store = fakeStore();
    const tooOld = new Date(startedAt.getTime() + ATTEMPT_MAX_AGE_MS + 1);
    expect(await submit({ attemptId, inputs: { tapsMs: [] } }, store, tooOld)).toEqual({
      status: 422,
      body: { error: "implausible-timing" },
    });
    expect(store.recordResult).not.toHaveBeenCalled();
  });

  it("reports what the database found if a simultaneous submission or the close job got there first", async () => {
    for (const [status, error] of [
      ["already-submitted", 409],
      ["day-closed", 409],
      ["not-found", 404],
    ] as const) {
      const store = fakeStore({ recordResult: vi.fn(async () => status) });
      expect(await submit({ attemptId, inputs: { tapsMs: [] } }, store)).toEqual({ status: error, body: { error: status } });
    }
  });

  it("fails loudly on a game day whose challenge type the server does not know", async () => {
    const store = fakeStore({ gameDay: vi.fn(async () => ({ challengeType: "chess", passTarget: 1, closed: false })) });
    await expect(submit({ attemptId, inputs: { tapsMs: [] } }, store)).rejects.toThrow(/chess/);
  });
});
