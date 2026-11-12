import { describe, expect, it } from "vitest";
import { columnAt, simulate, type StackingParams } from "@/challenges/stacking/engine";
import { createRng } from "@/challenges/shared/prng";
import { detectFlags, type DetectArgs } from "./detect";

const PARAMS: StackingParams = { startStepMs: 160, stepDecayMs: 7, startColumn: 2, direction: "right" };

/**
 * Taps that lock each of `rows` rows exactly on the one below (no cell lost), each at least
 * `gapMs` plus a seeded jitter after the last, as a very good player might.
 */
function perfectTaps(rows: number, gapMs = 300, jitterMs = 200, seed = 1): number[] {
  const rng = createRng(seed);
  const taps: number[] = [];
  for (let r = 0; r < rows; r++) {
    const run = simulate(PARAMS, taps);
    const moving = run.moving!;
    const target = run.rows.at(-1)?.left ?? moving.startColumn;
    let t = (taps.at(-1) ?? 0) + gapMs + rng.int(0, jitterMs);
    while (columnAt(PARAMS, moving, t) !== target) t++;
    taps.push(t);
  }
  return taps;
}

/** Human-like taps: 350-750 ms apart, landing wherever they land. */
function humanTaps(count: number, seed = 7): number[] {
  const rng = createRng(seed);
  const taps: number[] = [];
  for (let i = 0; i < count; i++) taps.push((taps.at(-1) ?? 500) + rng.int(350, 750));
  return taps;
}

const tower = (tapsMs: number[], over: Partial<DetectArgs> = {}): DetectArgs => ({
  challengeType: "stacking",
  inputs: { tapsMs },
  score: simulate(PARAMS, tapsMs).score,
  params: PARAMS,
  serverElapsedMs: (tapsMs.at(-1) ?? 0) + 4_000,
  history: [],
  ...over,
});

const clock = (score: number, over: Partial<DetectArgs> = {}): DetectArgs => ({
  challengeType: "inner-clock",
  inputs: { tapMs: 6_000 },
  score,
  params: { targetMs: 6_000, timeoutMs: 18_000 },
  serverElapsedMs: 10_000,
  history: [],
  ...over,
});

const sum = (over: Partial<DetectArgs> = {}): DetectArgs => ({
  challengeType: "flash-count",
  inputs: { count: 20 },
  score: 0,
  params: { dotCount: 20, flashMs: 1500, dots: [] },
  serverElapsedMs: 60_000,
  history: [],
  ...over,
});

describe("detectFlags on honest-looking runs", () => {
  it.each([1, 2, 3, 4, 5])("flags nothing for human-like Tower taps (seed %i)", (seed) => {
    expect(detectFlags(tower(humanTaps(15, seed)))).toEqual([]);
  });

  it("flags nothing for a good, ordinary Second Sense or Swift Sum run", () => {
    expect(detectFlags(clock(0.21, { history: [{ challengeType: "inner-clock", score: 0.4 }] }))).toEqual([]);
    expect(detectFlags(sum({ answerAfterClearMs: 2_400 }))).toEqual([]);
    expect(detectFlags(sum())).toEqual([]);
  });
});

describe("stacking-min-interval", () => {
  it("flags two taps closer than 120 ms", () => {
    const taps = humanTaps(6);
    taps[3] = taps[2] + 119;
    expect(detectFlags(tower(taps))).toContain("stacking-min-interval");
  });

  it("allows exactly 120 ms", () => {
    const taps = humanTaps(6);
    const shift = taps[2] + 120 - taps[3];
    const shifted = taps.map((tap, i) => (i >= 3 ? tap + shift : tap));
    expect(detectFlags(tower(shifted))).not.toContain("stacking-min-interval");
  });
});

describe("stacking-robotic-rhythm", () => {
  const even = (count: number, jitter: number[]) => Array.from({ length: count }, (_, i) => 1_000 + i * 400 + (jitter[i] ?? 0));

  it("flags 10 taps whose intervals barely vary", () => {
    expect(detectFlags(tower(even(10, [0, 2, -2, 1, 0, -1, 2, 0, -2, 1])))).toContain("stacking-robotic-rhythm");
  });

  it("ignores 9 such taps, and 10 with a human spread", () => {
    expect(detectFlags(tower(even(9, [])))).not.toContain("stacking-robotic-rhythm");
    expect(detectFlags(tower(even(10, [0, 30, -25, 60, 10, -40, 15, 50, -10, 20])))).not.toContain("stacking-robotic-rhythm");
  });
});

describe("stacking-perfect-run", () => {
  it("flags 12 rows in a row locked without losing a cell", () => {
    expect(detectFlags(tower(perfectTaps(12)))).toContain("stacking-perfect-run");
  });

  it("allows 11", () => {
    expect(detectFlags(tower(perfectTaps(11)))).not.toContain("stacking-perfect-run");
  });
});

describe("inner-clock-implausible", () => {
  const near = { challengeType: "inner-clock", score: 0.004 };
  const far = { challengeType: "inner-clock", score: 0.3 };

  it("flags a third near-perfect run among the latest five", () => {
    expect(detectFlags(clock(0.005, { history: [near, far, near, far] }))).toContain("inner-clock-implausible");
  });

  it("counts only the latest five, only Second Sense, and only errors under 0.01 s", () => {
    expect(detectFlags(clock(0.005, { history: [far, far, far, far, near, near] }))).not.toContain("inner-clock-implausible");
    const tower = { challengeType: "stacking", score: 0 };
    // Tower attempts in between do not push Second Sense ones out of the window.
    expect(detectFlags(clock(0.005, { history: [tower, near, tower, tower, tower, far, near] }))).toContain("inner-clock-implausible");
    expect(detectFlags(clock(0.01, { history: [near, far, { challengeType: "inner-clock", score: 0.01 }] }))).not.toContain("inner-clock-implausible");
  });
});

describe("flash-count-instant", () => {
  it("flags an answer under 800 ms after the dots cleared, when that is reported", () => {
    expect(detectFlags(sum({ answerAfterClearMs: 799 }))).toEqual(["flash-count-instant"]);
    expect(detectFlags(sum({ answerAfterClearMs: 800 }))).toEqual([]);
    expect(detectFlags(sum({ answerAfterClearMs: null }))).toEqual([]);
  });
});

describe("timing-mismatch", () => {
  it("flags a last input more than 2 s behind the server's clock beyond the 15 s allowance", () => {
    const taps = humanTaps(8);
    expect(detectFlags(tower(taps, { serverElapsedMs: taps.at(-1)! + 17_001 }))).toContain("timing-mismatch");
    expect(detectFlags(clock(0.2, { serverElapsedMs: 6_000 + 17_001 }))).toContain("timing-mismatch");
  });

  it("allows exactly 17 s", () => {
    const taps = humanTaps(8);
    expect(detectFlags(tower(taps, { serverElapsedMs: taps.at(-1)! + 17_000 }))).not.toContain("timing-mismatch");
  });

  it("skips runs with no timed input: a Second Sense timeout, no Tower taps, and Swift Sum's untimed answer", () => {
    expect(detectFlags(clock(12, { inputs: { tapMs: null }, serverElapsedMs: 60_000 }))).toEqual([]);
    expect(detectFlags(tower([], { serverElapsedMs: 60_000 }))).toEqual([]);
    expect(detectFlags(sum({ serverElapsedMs: 600_000 }))).toEqual([]);
  });
});

it("ignores a challenge it has no rules for", () => {
  expect(detectFlags({ ...sum(), challengeType: "unknown" })).toEqual([]);
});

it("reports several reasons together", () => {
  const taps = Array.from({ length: 12 }, (_, i) => 1_000 + i * 100);
  expect(detectFlags(tower(taps, { serverElapsedMs: 60_000 }))).toEqual(["stacking-min-interval", "stacking-robotic-rhythm", "timing-mismatch"]);
});
