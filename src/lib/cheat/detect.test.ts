import { describe, expect, it } from "vitest";
import { REVEAL_MS } from "@/challenges/flash-count/flashLadder";
import { ROUND_GAP_MS } from "@/challenges/inner-clock/timeBank";
import { COLUMNS, columnAt, simulate, type StackingParams } from "@/challenges/stacking/engine";
import { createRng } from "@/challenges/shared/prng";
import { STACKING_RHYTHM_MAX_SD_MS } from "@/config/cheat";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
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
  inputs: { tapsMs: [6_000] },
  score,
  params: { budgetMs: 3_000, rounds: [{ targetMs: 6_000, revealMs: 1_000, timeoutMs: 18_000 }] },
  serverElapsedMs: 10_000,
  history: [],
  ...over,
});

/**
 * A Flash Ladder run of two right answers, each `gapsMs` after its flash cleared: the first after
 * the 3-2-1 and its flash, the second after the reveal and its flash.
 */
const sum = (gapsMs = [2_000, 2_000], over: Partial<DetectArgs> = {}): DetectArgs => {
  const first = RUN_COUNTDOWN_MS + 1_500 + gapsMs[0];
  const second = first + REVEAL_MS + 1_500 + gapsMs[1];
  return {
    challengeType: "flash-count",
    inputs: { answers: [{ count: 10, atMs: first }, { count: 14, atMs: second }] },
    score: 3,
    params: { layoutSeed: 1, levels: [10, 14].map((dotCount) => ({ dotCount, flashMs: 1_500 })) },
    serverElapsedMs: second + 1_000,
    history: [],
    ...over,
  };
};

describe("detectFlags on honest-looking runs", () => {
  it.each([1, 2, 3, 4, 5])("flags nothing for human-like Tower taps (seed %i)", (seed) => {
    expect(detectFlags(tower(humanTaps(15, seed)))).toEqual([]);
  });

  it("flags nothing for a good, ordinary Second Sense or Swift Sum run", () => {
    expect(detectFlags(clock(1, { history: [{ challengeType: "inner-clock", score: 1 }] }))).toEqual([]);
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
    expect(detectFlags(tower(alternating(STACKING_RHYTHM_MAX_SD_MS - 0.01)))).toEqual(["stacking-robotic-rhythm"]);
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

describe("Second Sense (Time Bank)", () => {
  it("has no rule of its own until T164: even perfect runs again and again are not flagged", () => {
    const perfect = Array.from({ length: 5 }, () => ({ challengeType: "inner-clock", score: 1 }));
    expect(detectFlags(clock(1, { history: perfect }))).toEqual([]);
  });
});

describe("flash-count-instant", () => {
  it("flags an answer under 800 ms after its dots cleared (worked out from the 3-2-1, the reveals and the flashes)", () => {
    expect(detectFlags(sum([2_000, 799]))).toEqual(["flash-count-instant"]);
    expect(detectFlags(sum([799, 2_000]))).toEqual(["flash-count-instant"]);
    expect(detectFlags(sum([800, 800]))).toEqual([]);
  });

  /**
   * Levels of 10 dots (a 1 s flash) and 14 dots (a 2.5 s flash): right on level 1, wrong on
   * level 2, then right on its retry, each answer `gapsMs` after its flash cleared.
   */
  function retried(gapsMs: number[]): DetectArgs {
    const levels = [
      { dotCount: 10, flashMs: 1_000 },
      { dotCount: 14, flashMs: 2_500 },
    ];
    const first = RUN_COUNTDOWN_MS + 1_000 + gapsMs[0];
    const second = first + REVEAL_MS + 2_500 + gapsMs[1];
    const third = second + REVEAL_MS + 2_500 + gapsMs[2];
    const answers = [
      { count: 10, atMs: first },
      { count: 99, atMs: second },
      { count: 14, atMs: third },
    ];
    return sum(undefined, { inputs: { answers }, params: { layoutSeed: 1, levels }, serverElapsedMs: third + 1_000 });
  }

  it("times each answer from its own level's flash, a retry's included", () => {
    expect(detectFlags(retried([800, 800, 800]))).toEqual([]);
    expect(detectFlags(retried([800, 799, 800]))).toEqual(["flash-count-instant"]);
    expect(detectFlags(retried([800, 800, 799]))).toEqual(["flash-count-instant"]);
  });

  it("ignores answers after the run ended, whether it ended on the last level or out of lives", () => {
    const run = sum();
    const { answers } = run.inputs as { answers: { count: number; atMs: number }[] };
    const late = { ...run, inputs: { answers: [...answers, { count: 1, atMs: answers[1].atMs + 1 }] } };
    expect(detectFlags(late)).toEqual([]);
    // Three misses on level 1 (each 2 s after its flash), then an answer at once.
    const misses = [0, 1, 2].map((i) => ({ count: 99, atMs: RUN_COUNTDOWN_MS + 1_500 + 2_000 + i * (REVEAL_MS + 1_500 + 2_000) }));
    const outOfLives = [...misses, { count: 10, atMs: misses[2].atMs + 1 }];
    expect(detectFlags(sum(undefined, { inputs: { answers: outOfLives }, serverElapsedMs: misses[2].atMs + 1_000 }))).toEqual([]);
  });
});

describe("timing-mismatch", () => {
  // 15 s to load and read, plus the 3-2-1 before the run's own clock starts (T138), plus 2 s.
  const allowed = 15_000 + RUN_COUNTDOWN_MS + 2_000;

  it("flags a last input more than 2 s behind the server's clock beyond the loading and countdown allowance", () => {
    const taps = humanTaps(8);
    expect(detectFlags(tower(taps, { serverElapsedMs: taps.at(-1)! + allowed + 1 }))).toEqual(["timing-mismatch"]);
    expect(detectFlags(clock(0.2, { serverElapsedMs: 6_000 + allowed + 1 }))).toEqual(["timing-mismatch"]);
  });

  it("allows exactly the allowance, so an honest run with a 3-2-1 is not flagged", () => {
    const taps = humanTaps(8);
    expect(detectFlags(tower(taps, { serverElapsedMs: taps.at(-1)! + allowed }))).not.toContain("timing-mismatch");
    expect(detectFlags(clock(0.2, { serverElapsedMs: 6_000 + allowed }))).not.toContain("timing-mismatch");
  });

  it("times a Second Sense round with no tap at its timeout, and later rounds after the gaps", () => {
    const timedOut = { inputs: { tapsMs: [null] } };
    expect(detectFlags(clock(0, { ...timedOut, serverElapsedMs: 18_000 + allowed }))).toEqual([]);
    expect(detectFlags(clock(0, { ...timedOut, serverElapsedMs: 18_000 + allowed + 1 }))).toEqual(["timing-mismatch"]);
    const twoRounds = {
      inputs: { tapsMs: [3_000, 4_000] },
      params: { budgetMs: 3_000, rounds: [3_000, 4_000].map((targetMs) => ({ targetMs, revealMs: 1_000, timeoutMs: 3 * targetMs })) },
    };
    const lastMs = 3_000 + ROUND_GAP_MS + 4_000;
    expect(detectFlags(clock(2, { ...twoRounds, serverElapsedMs: lastMs + allowed }))).toEqual([]);
    expect(detectFlags(clock(2, { ...twoRounds, serverElapsedMs: lastMs + allowed + 1 }))).toEqual(["timing-mismatch"]);
  });

  it("times a Swift Sum run at its last answer", () => {
    const run = sum();
    const lastMs = run.serverElapsedMs - 1_000;
    expect(detectFlags(sum(undefined, { serverElapsedMs: lastMs + allowed }))).toEqual([]);
    expect(detectFlags(sum(undefined, { serverElapsedMs: lastMs + allowed + 1 }))).toEqual(["timing-mismatch"]);
  });

  it("skips a run with no timed input: no Tower taps", () => {
    expect(detectFlags(tower([], { serverElapsedMs: 60_000 }))).toEqual([]);
  });
});

describe("each challenge's rules stay with that challenge", () => {
  const nearPerfect = Array.from({ length: 4 }, () => ({ challengeType: "inner-clock", score: 8 }));

  it("a Tower attempt ignores Second Sense history", () => {
    expect(detectFlags(tower(humanTaps(15), { score: 0.001, history: nearPerfect }))).toEqual([]);
  });

  it("a Swift Sum attempt ignores Second Sense history", () => {
    expect(detectFlags(sum(undefined, { score: 0.001, history: nearPerfect }))).toEqual([]);
  });
});

it("ignores a challenge it has no rules for", () => {
  expect(detectFlags({ ...sum(), challengeType: "unknown" })).toEqual([]);
});

it("reports several reasons together", () => {
  const taps = Array.from({ length: 12 }, (_, i) => 1_000 + i * 100);
  expect(detectFlags(tower(taps, { serverElapsedMs: 60_000 }))).toEqual(["stacking-min-interval", "stacking-robotic-rhythm", "timing-mismatch"]);
});
