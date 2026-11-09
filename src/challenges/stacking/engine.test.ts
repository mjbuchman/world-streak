import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  IDLE_LOCK_MS,
  MAX_TAPS,
  MIN_STEP_MS,
  PARAM_RANGES,
  ROWS,
  START_WIDTH,
  columnAt,
  paramsFromSeed,
  simulate,
  stacking,
  stepMs,
  widthCap,
  type MovingRow,
  type StackingParams,
} from "./engine";
import golden from "./engine.golden.json";

// A slow, steady board: every row steps every 100 ms (no speed-up), row 1 starts at column 0
// moving right. Row r appears at the previous row's lock time, at a wall, alternating direction.
const steady: StackingParams = { startStepMs: 100, stepDecayMs: 0, startColumn: 0, direction: "right" };

const moving = (overrides: Partial<MovingRow> = {}): MovingRow => ({
  row: 1,
  width: 3,
  startMs: 0,
  startColumn: 0,
  direction: "right",
  ...overrides,
});

/**
 * Taps that stack `rowCount` rows perfectly on column 0: each row is tapped at the middle of
 * the first step where it covers column 0 (row 1 starts there).
 */
function stackOnColumnZero(params: StackingParams, rowCount: number): number[] {
  const taps: number[] = [];
  for (let row = 1; row <= rowCount; row++) {
    // Look at the run as it is just after the last tap, before any idle lock.
    const next = simulate(params, taps, (taps.at(-1) ?? 0) + 1).moving!;
    const step = stepMs(params, next.row);
    let t = next.startMs + step / 2;
    while (columnAt(params, next, t) !== 0) t += step;
    taps.push(t);
  }
  return taps;
}

/** The column sequence a row shows at the middle of each of its first `count` steps. */
function columns(params: StackingParams, row: MovingRow, count: number): number[] {
  const step = stepMs(params, row.row);
  return Array.from({ length: count }, (_, i) => columnAt(params, row, row.startMs + i * step + step / 2));
}

describe("the board", () => {
  it("is 7 columns by 15 rows, starting 3 cells wide", () => {
    expect([COLUMNS, ROWS, START_WIDTH, MAX_TAPS]).toEqual([7, 15, 3, 15]);
  });

  it("narrows by force at set heights: 3 wide up to row 5, 2 up to row 10, then 1", () => {
    expect([1, 5, 6, 10, 11, 15].map(widthCap)).toEqual([3, 3, 2, 2, 1, 1]);
  });

  it("steps faster on higher rows, never faster than the minimum", () => {
    const params = { ...steady, startStepMs: 160, stepDecayMs: 7 };
    expect([1, 2, 15].map((row) => stepMs(params, row))).toEqual([160, 153, 62]);
    expect(stepMs({ ...steady, startStepMs: 100, stepDecayMs: 10 }, 15)).toBe(MIN_STEP_MS);
  });
});

describe("columnAt", () => {
  it("moves one column per step and bounces off the walls", () => {
    expect(columns(steady, moving(), 11)).toEqual([0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2]);
    expect(columns(steady, moving({ startColumn: 4, direction: "left" }), 6)).toEqual([4, 3, 2, 1, 0, 1]);
    expect(columns(steady, moving({ width: 1, startColumn: 6, direction: "left" }), 8)).toEqual([6, 5, 4, 3, 2, 1, 0, 1]);
    expect(columns(steady, moving({ startColumn: 2, direction: "left" }), 4)).toEqual([2, 1, 0, 1]);
  });

  it("changes column exactly on each step boundary, counted from when the row appeared", () => {
    const row = moving({ startMs: 1000 });
    expect(columnAt(steady, row, 1099)).toBe(0);
    expect(columnAt(steady, row, 1100)).toBe(1);
    // Before the row appears it sits at its starting column.
    expect(columnAt(steady, row, 500)).toBe(0);
  });

  it("keeps a row as wide as the board still (it has nowhere to go)", () => {
    expect(columnAt(steady, moving({ width: COLUMNS }), 5000)).toBe(0);
  });

  it("uses the row's own step interval", () => {
    const params = { ...steady, stepDecayMs: 10 };
    expect(columnAt(params, moving({ row: 3 }), 80)).toBe(1); // row 3 steps every 80 ms
  });
});

describe("simulate", () => {
  it("locks row 1 wherever it is: the floor holds every cell", () => {
    const result = simulate(steady, [250], 300);
    expect(result.rows[0]).toEqual({ left: 2, width: 3, lostColumns: [], lockedAtMs: 250, byTap: true });
    expect(result.score).toBe(1);
  });

  it("drops the cells that do not rest on the row below, so the next row is narrower", () => {
    // Row 1 locks at columns 2-4. Row 2 appears at the right wall (columns 4-6) moving left;
    // tapped one step later it sits at 3-5, so column 5 falls and 3-4 stay.
    const result = simulate(steady, [250, 350], 360);
    expect(result.rows[1]).toEqual({ left: 3, width: 2, lostColumns: [5], lockedAtMs: 350, byTap: true });
    expect(result.moving).toMatchObject({ row: 3, width: 2, startMs: 350, startColumn: 0, direction: "right" });
  });

  it("starts each row at a wall, alternating direction", () => {
    const result = simulate(steady, [50], 60);
    expect(result.moving).toMatchObject({ row: 2, startColumn: 4, direction: "left" });
    expect(simulate({ ...steady, direction: "left" }, [50], 60).moving).toMatchObject({ row: 2, startColumn: 0, direction: "right" });
  });

  it("forces the width down at row 6 and row 11, even when every cell survived", () => {
    const fiveRows = stackOnColumnZero(steady, 5);
    const atRow6 = simulate(steady, fiveRows, fiveRows.at(-1)! + 1);
    expect(atRow6.rows.every((row) => row.width === 3)).toBe(true);
    expect(atRow6.moving).toMatchObject({ row: 6, width: 2 });

    const tenRows = stackOnColumnZero(steady, 10);
    const atRow11 = simulate(steady, tenRows, tenRows.at(-1)! + 1);
    expect(atRow11.rows.at(-1)!.width).toBe(2);
    expect(atRow11.moving).toMatchObject({ row: 11, width: 1 });
  });

  it("ends in a miss when no cell rests on the row below", () => {
    // Row 1 at columns 0-2; row 2 appears at columns 4-6 and is tapped straight away.
    const result = simulate(steady, [1, 2]);
    expect(result.endReason).toBe("miss");
    expect(result.rows[1]).toMatchObject({ width: 0, lostColumns: [4, 5, 6] });
    expect(result.score).toBe(1);
    expect(result.endedAtMs).toBe(2);
    expect(result.moving).toBeNull();
  });

  it("ends at the top row with the winning score", () => {
    const taps = stackOnColumnZero(steady, ROWS);
    const result = simulate(steady, taps);
    expect(result).toMatchObject({ score: ROWS, endReason: "top", moving: null, endedAtMs: taps.at(-1) });
    expect(result.rows).toHaveLength(ROWS);
    expect(result.rows.every((row) => row.left === 0 && row.lostColumns.length === 0)).toBe(true);
    // Nothing counts after the win.
    expect(simulate(steady, [...taps, taps.at(-1)! + 50])).toEqual(result);
  });

  it("is still running before the row's tap or idle lock", () => {
    const result = simulate(steady, [], 1000);
    expect(result).toMatchObject({ score: 0, endReason: "running", rows: [] });
    expect(result.moving).toMatchObject({ row: 1, startMs: 0 });
  });

  it(`drops a row nobody taps for ${IDLE_LOCK_MS} ms, which ends the run like a miss`, () => {
    const column = columnAt(steady, moving(), IDLE_LOCK_MS);
    const result = simulate(steady, [], IDLE_LOCK_MS);
    expect(result.rows[0]).toEqual({
      left: column,
      width: 0,
      lostColumns: [column, column + 1, column + 2],
      lockedAtMs: IDLE_LOCK_MS,
      byTap: false,
    });
    expect(result).toMatchObject({ endReason: "miss", score: 0, endedAtMs: IDLE_LOCK_MS, moving: null });
    expect(simulate(steady, [], IDLE_LOCK_MS - 1).rows).toEqual([]);
  });

  it("counts a tap only strictly before the idle limit, and only up to now", () => {
    // A tap at exactly the limit is too late: the row has already dropped.
    expect(simulate(steady, [IDLE_LOCK_MS])).toMatchObject({ score: 0, endReason: "miss" });
    expect(simulate(steady, [IDLE_LOCK_MS]).rows[0].byTap).toBe(false);
    expect(simulate(steady, [IDLE_LOCK_MS - 1]).rows[0].byTap).toBe(true);
    // The live view includes a tap that landed exactly now, but not one from the future.
    expect(simulate(steady, [250], 250).rows).toHaveLength(1);
    expect(simulate(steady, [250], 249).rows).toHaveLength(0);
  });

  it("ends a run that stops part-way at the next idle drop, keeping the rows already locked", () => {
    const result = simulate(steady, [250]);
    expect(result).toMatchObject({ score: 1, endReason: "miss", endedAtMs: 250 + IDLE_LOCK_MS });
  });

  it("always finishes when replayed to the end, and nobody scores without tapping", () => {
    for (let seed = 0; seed < 50; seed++) {
      const result = simulate(paramsFromSeed(seed), []);
      expect(result).toMatchObject({ endReason: "miss", score: 0 });
    }
  });

  it("ignores a tap at or before the moment its row appeared, and taps after the end", () => {
    // The second tap equals the first: it cannot belong to row 2 (which appears at 250).
    expect(simulate(steady, [250, 250], 300).rows).toHaveLength(1);
    const ended = simulate(steady, [1, 2]);
    expect(simulate(steady, [1, 2, 500, 900])).toEqual(ended);
  });

  it("gives the same result for the same inputs, every time", () => {
    const params = paramsFromSeed(7);
    const taps = [400, 1300, 2200, 3100];
    expect(simulate(params, taps)).toEqual(simulate(params, taps));
  });

  it("only counts rows that kept at least one cell", () => {
    const result = simulate(steady, [1, 2]);
    expect(result.rows).toHaveLength(2);
    expect(result.score).toBe(1);
  });
});

describe("paramsFromSeed", () => {
  it("picks whole-millisecond speeds within the ranges, a starting column and a direction", () => {
    for (let seed = 0; seed < 300; seed++) {
      const params = paramsFromSeed(seed);
      expect(Number.isInteger(params.startStepMs)).toBe(true);
      expect(Number.isInteger(params.stepDecayMs)).toBe(true);
      expect(params.startStepMs).toBeGreaterThanOrEqual(PARAM_RANGES.startStepMs.min);
      expect(params.startStepMs).toBeLessThanOrEqual(PARAM_RANGES.startStepMs.max);
      expect(params.stepDecayMs).toBeGreaterThanOrEqual(PARAM_RANGES.stepDecayMs.min);
      expect(params.stepDecayMs).toBeLessThanOrEqual(PARAM_RANGES.stepDecayMs.max);
      expect(params.startColumn).toBeGreaterThanOrEqual(0);
      expect(params.startColumn).toBeLessThanOrEqual(COLUMNS - START_WIDTH);
    }
  });

  it("is deterministic per seed and varies between seeds", () => {
    expect(paramsFromSeed(123)).toEqual(paramsFromSeed(123));
    const seen = Array.from({ length: 100 }, (_, seed) => paramsFromSeed(seed));
    expect(new Set(seen.map((p) => p.direction))).toEqual(new Set(["left", "right"]));
    expect(new Set(seen.map((p) => p.startColumn)).size).toBe(COLUMNS - START_WIDTH + 1);
    expect(new Set(seen.map((p) => p.startStepMs)).size).toBeGreaterThan(5);
  });
});

describe("stacking module", () => {
  it("scores by replaying the taps to the end, higher is better", () => {
    expect(stacking.direction).toBe("higher-better");
    expect(stacking.score(steady, { tapsMs: [1, 2] })).toBe(1);
    expect(stacking.paramsFromSeed(3)).toEqual(paramsFromSeed(3));
  });

  it("reports the last tap's time for the server's timing check, or 0 with no taps", () => {
    expect(stacking.lastInputMs({ tapsMs: [750, 1250] })).toBe(1250);
    expect(stacking.lastInputMs({ tapsMs: [] })).toBe(0);
  });

  it("accepts increasing, non-negative taps", () => {
    expect(stacking.inputsSchema.parse({ tapsMs: [0, 10.5, 900] })).toEqual({ tapsMs: [0, 10.5, 900] });
    expect(stacking.inputsSchema.safeParse({ tapsMs: [] }).success).toBe(true);
  });

  it.each([
    ["a negative tap", [-1, 10]],
    ["a repeated tap", [10, 10]],
    ["a decreasing tap", [10, 5]],
    ["a non-finite tap", [10, Number.POSITIVE_INFINITY]],
    ["a NaN tap", [10, Number.NaN]],
  ])("rejects %s", (_name, tapsMs) => {
    expect(stacking.inputsSchema.safeParse({ tapsMs }).success).toBe(false);
  });

  it.each([
    ["no taps field", {}],
    ["taps that are not numbers", { tapsMs: ["10", "20"] }],
    ["taps that are not a list", { tapsMs: 10 }],
    ["something that is not an object", [10, 20]],
    ["nothing", null],
  ])("rejects a malformed submission: %s", (_name, input) => {
    expect(stacking.inputsSchema.safeParse(input).success).toBe(false);
  });

  it(`allows at most ${MAX_TAPS} taps (one per row)`, () => {
    const taps = (count: number) => Array.from({ length: count }, (_, i) => i * 10);
    expect(stacking.inputsSchema.safeParse({ tapsMs: taps(MAX_TAPS) }).success).toBe(true);
    expect(stacking.inputsSchema.safeParse({ tapsMs: taps(MAX_TAPS + 1) }).success).toBe(false);
  });
});

describe("golden runs", () => {
  // Three committed seeds and tap sequences (from the simulated player in player.ts) with their
  // exact results: one ends in a miss, one at the top, and one is finished by idle locks. If
  // this fails, replayed official scores have changed: never regenerate the fixture to make it
  // pass without a recorded decision.
  it.each(golden)("seed $seed scores exactly as committed", ({ seed, params, tapsMs, result }) => {
    expect(paramsFromSeed(seed)).toEqual(params);
    expect(simulate(paramsFromSeed(seed), tapsMs)).toMatchObject(result);
    expect(stacking.score(paramsFromSeed(seed), { tapsMs })).toBe(result.score);
  });

  it("covers every way a run ends, including an idle drop", () => {
    expect(golden.map((run) => run.result.endReason).sort()).toEqual(["miss", "miss", "top"]);
    expect(golden.some((run) => run.result.rows.some((row) => !row.byTap))).toBe(true);
  });
});
