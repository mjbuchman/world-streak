import { describe, expect, it } from "vitest";
import { play as playFairSplit, type FairSplitCut, type FairSplitInputs, type FairSplitParams } from "@/challenges/fair-split/engine";
import { echoPath, paramsFromSeed as echoParamsFromSeed, sequenceFor } from "@/challenges/echo-path/engine";
import { playbackMs } from "@/challenges/echo-path/render";
import { REVEAL_MS } from "@/challenges/flash-count/flashLadder";
import { ROUND_COUNTDOWN_MS, ROUND_GAP_MS } from "@/challenges/inner-clock/timeBank";
import { COLUMNS, columnAt, simulate, type StackingParams } from "@/challenges/stacking/engine";
import { createRng } from "@/challenges/shared/prng";
import { ECHO_PATH_RHYTHM_MAX_SD_MS, STACKING_RHYTHM_MAX_SD_MS } from "@/config/cheat";
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
 * A Swift Sum run of two right answers, each `gapsMs` after its flash cleared: the first after
 * the 3-2-1 and its flash, the second after the reveal, its own 3-2-1 and its flash.
 */
const sum = (gapsMs = [2_000, 2_000], over: Partial<DetectArgs> = {}): DetectArgs => {
  const first = RUN_COUNTDOWN_MS + 1_500 + gapsMs[0];
  const second = first + REVEAL_MS + RUN_COUNTDOWN_MS + 1_500 + gapsMs[1];
  return {
    challengeType: "flash-count",
    inputs: { answers: [{ count: 10, atMs: first }, { count: 14, atMs: second }] },
    score: 3,
    params: { layoutSeed: 1, bank: 10, levels: [10, 14].map((dotCount) => ({ dotCount, flashMs: 1_500 })) },
    serverElapsedMs: second + 1_000,
    history: [],
    ...over,
  };
};

/** A Time Bank run of four 20 s rounds, each tapped `errorsMs[i]` late (null: no tap). */
const bank = (errorsMs: (number | null)[], over: Partial<DetectArgs> = {}): DetectArgs => {
  const rounds = Array.from({ length: 4 }, () => ({ targetMs: 20_000, revealMs: 2_000, timeoutMs: 30_000 }));
  const tapsMs = errorsMs.map((error) => (error === null ? null : 20_000 + error));
  const lastMs = tapsMs.reduce<number>((sum, tap, i) => sum + (i > 0 ? ROUND_GAP_MS + ROUND_COUNTDOWN_MS : 0) + (tap ?? 30_000), 0);
  return clock(errorsMs.length, { inputs: { tapsMs }, params: { budgetMs: 10_000, rounds }, serverElapsedMs: lastMs + 4_000, ...over });
};

/** A real Echo Path board: its path is 17 tiles long, played back at 300 ms a tile. */
const ECHO_PARAMS = echoParamsFromSeed(0);
/** The game's pause before each playback (EchoPathGame's BETWEEN_MS). */
const ECHO_PAUSE_MS = 700;

/** An Echo Path run tapped at these times (the tiles do not matter to its rule). */
const echo = (tapsMs: number[], over: Partial<DetectArgs> = {}): DetectArgs => ({
  challengeType: "echo-path",
  inputs: { taps: tapsMs.map((atMs, i) => ({ tile: i % 50, atMs })) },
  score: 3,
  params: ECHO_PARAMS,
  serverElapsedMs: (tapsMs.at(-1) ?? 0) + 4_000,
  history: [],
  ...over,
});

/**
 * An Echo Path run that clears every length from 4 up to `length` with no miss, as the game
 * paces it: each echo's first tap comes 600 ms after the pause and its playback, and the taps
 * after it follow at `gapMs(j)`, j counting those in-echo gaps over the whole run. It stops after
 * `maxTaps` taps.
 */
function echoRun(length: number, gapMs: (j: number) => number, maxTaps = Infinity): DetectArgs {
  const taps: { tile: number; atMs: number }[] = [];
  let at = RUN_COUNTDOWN_MS;
  let j = 0;
  for (let len = ECHO_PARAMS.startLength; len <= length; len++) {
    at += ECHO_PAUSE_MS + playbackMs(len, ECHO_PARAMS.stepMs);
    sequenceFor(ECHO_PARAMS, len).forEach((tile, i) => {
      at += i === 0 ? 600 : gapMs(j++);
      if (taps.length < maxTaps) taps.push({ tile, atMs: at });
    });
  }
  const inputs = { taps };
  return { ...echo([]), inputs, score: echoPath.score(ECHO_PARAMS, inputs), serverElapsedMs: at + 4_000 };
}

const SQUARE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];
const squares: FairSplitParams = { shapes: Array.from({ length: 12 }, () => ({ polygon: SQUARE, limitMs: 5_000 })) };

/**
 * A Fair Split run on squares: vertical cuts at `xs` (50 is exactly half; each unit off is one
 * point), each `afterMs[i]` (default 1.5 s) after its shape appeared.
 */
function split(xs: number[], afterMs: number[] = [], over: Partial<DetectArgs> = {}): DetectArgs {
  const cuts: FairSplitCut[] = [];
  xs.forEach((x, i) => {
    const { appearsAt } = playFairSplit(squares, { cuts, endMs: cuts.at(-1)?.atMs ?? 0 });
    cuts.push({ atMs: appearsAt + (afterMs[i] ?? 1_500), ax: x, ay: 0, bx: x, by: 100 });
  });
  const endMs = cuts.at(-1)?.atMs ?? 0;
  return { challengeType: "fair-split", inputs: { cuts, endMs }, score: 3, params: squares, serverElapsedMs: endMs + 4_000, history: [], ...over };
}

/** Human-like cuts: 0.2 to 0.9 points off half, either side. */
const HUMAN_XS = [50.4, 49.3, 50.8, 49.8, 50.2, 49.1, 50.6, 49.5];

describe("detectFlags on honest-looking runs", () => {
  it.each([1, 2, 3, 4, 5])("flags nothing for human-like Tower taps (seed %i)", (seed) => {
    expect(detectFlags(tower(humanTaps(15, seed)))).toEqual([]);
  });

  it.each([1, 2, 3])("flags nothing for human-like Echo Path taps (seed %i)", (seed) => {
    expect(detectFlags(echo(humanTaps(25, seed)))).toEqual([]);
  });

  it("flags nothing for a good, ordinary run of each other game", () => {
    expect(detectFlags(bank([40, -120, 15, 230, -60, 90, -25, 150]))).toEqual([]);
    expect(detectFlags(sum())).toEqual([]);
    expect(detectFlags(split(HUMAN_XS, [1_400, 900, 2_100, 1_200, 700, 1_800, 1_000, 2_500]))).toEqual([]);
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

describe("time-bank-implausible", () => {
  it("leaves an honest run alone", () => {
    expect(detectFlags(bank([400, -900, 250, 1_100]))).toEqual([]);
  });

  it("flags 3 of the 4 rounds tapped under 25 ms off, either side", () => {
    expect(detectFlags(bank([24, -3, 400, 0]))).toEqual(["time-bank-implausible"]);
  });

  it("allows 2 such rounds, and 25 ms exactly", () => {
    expect(detectFlags(bank([24, -3, 400, 900]))).toEqual([]);
    expect(detectFlags(bank([25, -25, 25, -25]))).toEqual([]);
  });

  it("does not count a round with no tap", () => {
    expect(detectFlags(bank([2, 2, null]))).toEqual([]);
  });

  it("looks at this run only, not earlier ones", () => {
    const perfect = Array.from({ length: 5 }, () => ({ challengeType: "inner-clock", score: 5 }));
    expect(detectFlags(bank([40, -120, 15], { history: perfect }))).toEqual([]);
  });
});

describe("echo-path-robotic", () => {
  it("flags two taps closer than 80 ms, and allows exactly 80", () => {
    const taps = humanTaps(6);
    expect(detectFlags(echo([...taps, taps[5] + 79]))).toEqual(["echo-path-robotic"]);
    expect(detectFlags(echo([...taps, taps[5] + 80]))).toEqual([]);
  });

  // An even number of gaps alternating 400 ± d has a standard deviation of exactly d. Echoes of
  // 4, 5 and 6 tiles have 3 + 4 + 5 = 12 gaps between their own taps.
  const alternating = (d: number) => (j: number) => 400 + (j % 2 === 0 ? d : -d);

  it("flags in-echo gaps that vary under 5 ms, and allows exactly 5", () => {
    expect(detectFlags(echoRun(6, alternating(0)))).toEqual(["echo-path-robotic"]);
    expect(detectFlags(echoRun(6, alternating(ECHO_PATH_RHYTHM_MAX_SD_MS - 0.01)))).toEqual(["echo-path-robotic"]);
    expect(detectFlags(echoRun(6, alternating(ECHO_PATH_RHYTHM_MAX_SD_MS)))).toEqual([]);
  });

  it("needs 9 in-echo gaps, as many as 10 taps have", () => {
    // 4 + 5 taps, then 3 of the 6-tile echo: 7 + 2 = 9 gaps; one tap fewer leaves 8.
    expect(detectFlags(echoRun(6, alternating(0), 12))).toEqual(["echo-path-robotic"]);
    expect(detectFlags(echoRun(6, alternating(0), 11))).toEqual([]);
  });

  // Runs of the growing path (T191): 4 up to 14 tiles is 99 taps over about a minute and a half.
  it("flags nothing for an honest 14-tile run, even a quick one", () => {
    const rng = createRng(3);
    const run = echoRun(14, () => rng.int(180, 520));
    expect(run.score).toBe(15);
    expect(detectFlags(run)).toEqual([]);
  });

  it("flags only the rhythm for a scripted 14-tile run tapped at an even 100 ms, whatever its pauses", () => {
    // The gaps before each echo (the pause, the playback and 600 ms) vary from 1.9 to 5.2 s: on
    // their own they would make the run look uneven.
    expect(detectFlags(echoRun(14, () => 100))).toEqual(["echo-path-robotic"]);
  });
});

describe("fair-split-implausible", () => {
  it("flags 6 cuts of one run within 0.05 points of half", () => {
    expect(detectFlags(split([50, 50.04, 49.96, 50.6, 50, 50.03, 49.97]))).toEqual(["fair-split-implausible"]);
  });

  it("allows 5 such cuts, and cuts 0.06 points off", () => {
    expect(detectFlags(split([50, 50.04, 49.96, 50.6, 50, 50.03, 49.2]))).toEqual([]);
    expect(detectFlags(split([50.06, 49.94, 50.06, 49.94, 50.06, 49.94]))).toEqual([]);
  });

  it("ignores cuts in the pause before a shape, which the game never judged", () => {
    const run = split(HUMAN_XS.slice(0, 2));
    const { cuts, endMs } = run.inputs as FairSplitInputs;
    // Each exact cut lands 100 ms after the previous one, inside its 1.2 s pause.
    const paused = cuts.flatMap((cut) => [cut, ...[1, 2, 3].map((k) => ({ ...cut, atMs: cut.atMs + k * 100, ax: 50, bx: 50 }))]);
    expect(detectFlags({ ...run, inputs: { cuts: paused, endMs: Math.max(endMs, paused.at(-1)!.atMs) } })).toEqual([]);
  });
});

describe("fair-split-instant", () => {
  it("flags a counted cut under 300 ms after its shape appeared, and allows exactly 300", () => {
    expect(detectFlags(split(HUMAN_XS.slice(0, 3), [1_500, 299, 1_500]))).toEqual(["fair-split-instant"]);
    expect(detectFlags(split(HUMAN_XS.slice(0, 3), [1_500, 300, 1_500]))).toEqual([]);
  });

  it("ignores a quick cut that missed, and one after the run ended", () => {
    expect(detectFlags(split([50.4, 60, 49.5], [1_500, 100, 1_500]))).toEqual([]);
    // Three misses end the run; a fast fair cut after that was never judged.
    expect(detectFlags(split([60, 60, 60, 50.4], [1_500, 1_500, 1_500, 100]))).toEqual([]);
  });
});

describe("flash-count-instant", () => {
  it("flags an answer under 800 ms after its dots cleared (worked out from the 3-2-1s, the reveals and the flashes)", () => {
    expect(detectFlags(sum([2_000, 799]))).toEqual(["flash-count-instant"]);
    expect(detectFlags(sum([799, 2_000]))).toEqual(["flash-count-instant"]);
    expect(detectFlags(sum([800, 800]))).toEqual([]);
  });

  /**
   * Rounds of 10 dots (a 1 s flash), 14 (2.5 s) and 18 (2 s): right, off by 2, then right, each
   * answer `gapsMs` after its flash cleared. A miss the bank covers moves on like a right answer.
   */
  function missed(gapsMs: number[]): DetectArgs {
    const levels = [
      { dotCount: 10, flashMs: 1_000 },
      { dotCount: 14, flashMs: 2_500 },
      { dotCount: 18, flashMs: 2_000 },
    ];
    const first = RUN_COUNTDOWN_MS + 1_000 + gapsMs[0];
    const second = first + REVEAL_MS + RUN_COUNTDOWN_MS + 2_500 + gapsMs[1];
    const third = second + REVEAL_MS + RUN_COUNTDOWN_MS + 2_000 + gapsMs[2];
    const answers = [
      { count: 10, atMs: first },
      { count: 12, atMs: second },
      { count: 18, atMs: third },
    ];
    return sum(undefined, { inputs: { answers }, params: { layoutSeed: 1, bank: 10, levels }, serverElapsedMs: third + 1_000 });
  }

  it("times each answer from its own round's flash, after a miss too", () => {
    expect(detectFlags(missed([800, 800, 800]))).toEqual([]);
    expect(detectFlags(missed([800, 799, 800]))).toEqual(["flash-count-instant"]);
    expect(detectFlags(missed([800, 800, 799]))).toEqual(["flash-count-instant"]);
  });

  it("ignores answers after the run ended, whether it ended on the last round or with the bank bust", () => {
    const run = sum();
    const { answers } = run.inputs as { answers: { count: number; atMs: number }[] };
    const late = { ...run, inputs: { answers: [...answers, { count: 1, atMs: answers[1].atMs + 1 }] } };
    expect(detectFlags(late)).toEqual([]);
    // A count of 99 busts the bank in round 1 (2 s after its flash); an answer at once follows.
    const bust = { count: 99, atMs: RUN_COUNTDOWN_MS + 1_500 + 2_000 };
    const afterBust = [bust, { count: 14, atMs: bust.atMs + 1 }];
    expect(detectFlags(sum(undefined, { inputs: { answers: afterBust }, serverElapsedMs: bust.atMs + 1_000 }))).toEqual([]);
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
    // Round 2 starts after the reveal gap and its own 3-2-1.
    const lastMs = 3_000 + ROUND_GAP_MS + ROUND_COUNTDOWN_MS + 4_000;
    expect(detectFlags(clock(2, { ...twoRounds, serverElapsedMs: lastMs + allowed }))).toEqual([]);
    expect(detectFlags(clock(2, { ...twoRounds, serverElapsedMs: lastMs + allowed + 1 }))).toEqual(["timing-mismatch"]);
  });

  it("times a Swift Sum run at its last answer", () => {
    const run = sum();
    const lastMs = run.serverElapsedMs - 1_000;
    expect(detectFlags(sum(undefined, { serverElapsedMs: lastMs + allowed }))).toEqual([]);
    expect(detectFlags(sum(undefined, { serverElapsedMs: lastMs + allowed + 1 }))).toEqual(["timing-mismatch"]);
  });

  it("times an Echo Path run at its last tap and a Fair Split run at its end", () => {
    const taps = humanTaps(8);
    expect(detectFlags(echo(taps, { serverElapsedMs: taps.at(-1)! + allowed }))).toEqual([]);
    expect(detectFlags(echo(taps, { serverElapsedMs: taps.at(-1)! + allowed + 1 }))).toEqual(["timing-mismatch"]);
    const run = split(HUMAN_XS.slice(0, 2));
    const endMs = (run.inputs as FairSplitInputs).endMs;
    expect(detectFlags({ ...run, serverElapsedMs: endMs + allowed })).toEqual([]);
    expect(detectFlags({ ...run, serverElapsedMs: endMs + allowed + 1 })).toEqual(["timing-mismatch"]);
  });

  it("skips a run with no timed input: no Tower taps, no Echo Path taps", () => {
    expect(detectFlags(tower([], { serverElapsedMs: 60_000 }))).toEqual([]);
    expect(detectFlags(echo([], { serverElapsedMs: 60_000 }))).toEqual([]);
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

  // Inputs that would trip a rule, read as another game's: Tower taps 100 ms apart are robotic for
  // the Tower and Echo Path, but mean nothing to Second Sense, whose rounds count from their own start.
  it("a rule never fires for another game's attempt", () => {
    const fast = Array.from({ length: 12 }, (_, i) => 1_000 + i * 100);
    expect(detectFlags(echoRun(6, () => 100))).toEqual(["echo-path-robotic"]);
    expect(detectFlags(bank([0, 0, 0, 0, 0], { challengeType: "echo-path", inputs: { taps: [] } }))).toEqual([]);
    expect(detectFlags({ ...split([50, 50, 50, 50, 50, 50]), challengeType: "flash-count", inputs: { answers: [] } })).toEqual([]);
    expect(detectFlags({ ...echo(fast), challengeType: "fair-split", inputs: { cuts: [], endMs: 1_000 }, params: squares })).toEqual([]);
  });
});

it("ignores a challenge it has no rules for", () => {
  expect(detectFlags({ ...sum(), challengeType: "unknown" })).toEqual([]);
});

it("reports several reasons together", () => {
  const taps = Array.from({ length: 12 }, (_, i) => 1_000 + i * 100);
  expect(detectFlags(tower(taps, { serverElapsedMs: 60_000 }))).toEqual(["stacking-min-interval", "stacking-robotic-rhythm", "timing-mismatch"]);
});
