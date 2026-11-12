import { describe, expect, it } from "vitest";
import { COLUMNS, columnAt, simulate, type StackingParams } from "@/challenges/stacking/engine";
import { createRng } from "@/challenges/shared/prng";
import { STACKING_RHYTHM_MAX_SD_MS } from "@/config/cheat";
import { detectFlags, type DetectArgs } from "./detect";

const PARAMS: StackingParams = { startStepMs: 160, stepDecayMs: 7, startColumn: 2, direction: "right" };

/**
 * Taps that lock each row exactly on the one below (no cell lost), except the rows listed in
 * `losing`, which hang one cell off the edge. Each tap is at least `gapMs` plus a seeded jitter
 * after the last, as a very good player might.
 */
function towerTaps(rows: number, losing: readonly number[] = [], gapMs = 300, jitterMs = 200, seed = 1): number[] {
  const rng = createRng(seed);
  const taps: number[] = [];
  for (let r = 1; r <= rows; r++) {
    const run = simulate(PARAMS, taps);
    const moving = run.moving!;
    const below = run.rows.at(-1);
    let target = below?.left ?? moving.startColumn;
    if (below && losing.includes(r)) {
      // One column past fully supported, on whichever side has room.
      const right = below.left + below.width - moving.width + 1;
      target = right + moving.width <= COLUMNS ? right : below.left - 1;
    }
    let t = (taps.at(-1) ?? 0) + gapMs + rng.int(0, jitterMs);
    while (columnAt(PARAMS, moving, t) !== target) t++;
    taps.push(t);
  }
  return taps;
}
const perfectTaps = (rows: number) => towerTaps(rows);

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
    expect(detectFlags(tower(taps))).toEqual(["stacking-min-interval"]);
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
    expect(detectFlags(tower(even(10, [0, 2, -2, 1, 0, -1, 2, 0, -2, 1])))).toEqual(["stacking-robotic-rhythm"]);
  });

  // Intervals alternating 400 ± d have a standard deviation of exactly d.
  const alternating = (d: number) => {
    const taps = [1_000];
    for (let i = 0; i < 10; i++) taps.push(taps[i] + 400 + (i % 2 === 0 ? d : -d));
    return taps;
  };

  it("pins the boundary: exactly STACKING_RHYTHM_MAX_SD_MS is not flagged, just under is", () => {
    expect(detectFlags(tower(alternating(STACKING_RHYTHM_MAX_SD_MS)))).not.toContain("stacking-robotic-rhythm");
    expect(detectFlags(tower(alternating(STACKING_RHYTHM_MAX_SD_MS - 0.01)))).toContain("stacking-robotic-rhythm");
  });

  it("ignores 9 such taps, and 10 with a human spread", () => {
    expect(detectFlags(tower(even(9, [])))).not.toContain("stacking-robotic-rhythm");
    expect(detectFlags(tower(even(10, [0, 30, -25, 60, 10, -40, 15, 50, -10, 20])))).not.toContain("stacking-robotic-rhythm");
  });
});

describe("stacking-perfect-run", () => {
  it("flags 12 rows in a row locked without losing a cell", () => {
    expect(detectFlags(tower(perfectTaps(12)))).toEqual(["stacking-perfect-run"]);
  });

  it("allows 11", () => {
    expect(detectFlags(tower(perfectTaps(11)))).not.toContain("stacking-perfect-run");
  });

  it("counts only rows in a row: 14 perfect rows broken by one that loses a cell is not a run of 12", () => {
    const taps = towerTaps(15, [7]);
    const rows = simulate(PARAMS, taps).rows;
    // Setup: row 7 lost a cell but kept going; the other 14 lost none.
    expect(rows.map((row) => row.lostColumns.length)).toEqual([0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(rows.every((row) => row.width > 0)).toBe(true);
    expect(detectFlags(tower(taps))).not.toContain("stacking-perfect-run");
  });
});

describe("inner-clock-implausible", () => {
  const near = { challengeType: "inner-clock", score: 0.004 };
  const far = { challengeType: "inner-clock", score: 0.3 };

  it("flags a third near-perfect run among the latest five", () => {
    expect(detectFlags(clock(0.005, { history: [near, far, near, far] }))).toEqual(["inner-clock-implausible"]);
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
    expect(detectFlags(tower(taps, { serverElapsedMs: taps.at(-1)! + 17_001 }))).toEqual(["timing-mismatch"]);
    expect(detectFlags(clock(0.2, { serverElapsedMs: 6_000 + 17_001 }))).toEqual(["timing-mismatch"]);
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

describe("each challenge's rules stay with that challenge", () => {
  const nearPerfect = Array.from({ length: 4 }, () => ({ challengeType: "inner-clock", score: 0.001 }));

  it("a Tower attempt ignores Second Sense history and Swift Sum timing", () => {
    expect(detectFlags(tower(humanTaps(15), { score: 0.001, history: nearPerfect, answerAfterClearMs: 0 }))).toEqual([]);
  });

  it("a Second Sense attempt ignores Swift Sum timing", () => {
    expect(detectFlags(clock(0.3, { answerAfterClearMs: 0 }))).toEqual([]);
  });

  it("a Swift Sum attempt ignores Second Sense history", () => {
    expect(detectFlags(sum({ score: 0.001, history: nearPerfect }))).toEqual([]);
  });
});

it("ignores a challenge it has no rules for", () => {
  expect(detectFlags({ ...sum(), challengeType: "unknown" })).toEqual([]);
});

it("reports several reasons together", () => {
  const taps = Array.from({ length: 12 }, (_, i) => 1_000 + i * 100);
  expect(detectFlags(tower(taps, { serverElapsedMs: 60_000 }))).toEqual(["stacking-min-interval", "stacking-robotic-rhythm", "timing-mismatch"]);
});
