import { describe, expect, it } from "vitest";
import {
  BASE_BLOCK,
  FIELD_WIDTH,
  MAX_TAPS,
  PARAM_RANGES,
  blockLeftAt,
  paramsFromSeed,
  simulate,
  stacking,
  type StackingParams,
} from "./engine";

const MINUTE = 60_000;
const steady: StackingParams = { startSpeed: 0.2, ramp: 0, direction: "right", maxDurationMs: MINUTE };

describe("simulate: worked examples", () => {
  it("taps [500]: block 1 lands exactly on the base", () => {
    const result = simulate(steady, [500]);
    expect(result.score).toBe(1);
    expect(result.blocks).toEqual([{ left: 100, width: 200, overhang: 0 }]);
  });

  it("taps [750]: block 1 overhangs by 50, which is trimmed", () => {
    expect(simulate(steady, [750]).blocks).toEqual([{ left: 150, width: 150, overhang: 50 }]);
  });

  it("taps [1250]: the block bounces off the right edge at 1000 ms, landing where [750] does", () => {
    expect(simulate(steady, [1250]).blocks).toEqual(simulate(steady, [750]).blocks);
  });

  it("taps [750, 1250]: block 2 starts at the right moving left and lands exactly on block 1", () => {
    const result = simulate(steady, [750, 1250]);
    expect(result.score).toBe(2);
    expect(result.blocks[1]).toEqual({ left: 150, width: 150, overhang: 0 });
  });

  it("taps [750, 2000]: block 2 at left 0 misses block 1 and ends the run", () => {
    const result = simulate(steady, [750, 2000]);
    expect(result).toMatchObject({ score: 1, endReason: "miss", endedAtMs: 2000, moving: null });
    expect(result.blocks).toHaveLength(1);
  });

  it("ramp 0.05: block 2 moves at 0.25 px/ms, so taps [500, 900] stack exactly", () => {
    const result = simulate({ ...steady, ramp: 0.05 }, [500, 900]);
    expect(result.score).toBe(2);
    expect(result.blocks[1]).toEqual({ left: 100, width: 200, overhang: 0 });
  });

  it('direction "left": block 1 starts at the right edge, so taps [250] land at left 150', () => {
    expect(simulate({ ...steady, direction: "left" }, [250]).blocks).toEqual([{ left: 150, width: 150, overhang: 50 }]);
  });

  it("trims the left side too when a block lands left of the one below", () => {
    // Left-moving block 1 from 200: at 750 ms it is at 50, overlapping the base from 100 to 250.
    expect(simulate({ ...steady, direction: "left" }, [750]).blocks).toEqual([{ left: 100, width: 150, overhang: 50 }]);
  });
});

describe("simulate: how runs end", () => {
  it("with no taps, ends with the inputs and block 1 still moving from the start", () => {
    expect(simulate(steady, [])).toEqual({
      score: 0,
      blocks: [],
      endedAtMs: 0,
      endReason: "inputs",
      moving: { index: 1, width: 200, startMs: 0 },
    });
  });

  it("when the taps run out, reports the next moving block for the renderer", () => {
    const result = simulate(steady, [750]);
    expect(result).toMatchObject({ endReason: "inputs", endedAtMs: 750 });
    expect(result.moving).toEqual({ index: 2, width: 150, startMs: 750 });
  });

  it("ignores taps after a miss", () => {
    const missed = simulate(steady, [750, 2000]);
    expect(simulate(steady, [750, 2000, 2500, 3000])).toEqual(missed);
  });

  it("ignores taps after maxDurationMs and ends the run on time", () => {
    const params = { ...steady, maxDurationMs: 1000 };
    const result = simulate(params, [500, 1001, 1500]);
    expect(result).toMatchObject({ score: 1, endReason: "time", endedAtMs: 1000, moving: null });
  });

  it("still counts a tap exactly at maxDurationMs", () => {
    expect(simulate({ ...steady, maxDurationMs: 500 }, [500]).score).toBe(1);
  });
});

describe("blockLeftAt", () => {
  it("moves block 1 from the left edge for direction right, bouncing at both edges", () => {
    const block = { index: 1, width: 200, startMs: 0 };
    expect([0, 500, 1000, 1500, 2000, 2500].map((t) => blockLeftAt(steady, block, t))).toEqual([
      0, 100, 200, 100, 0, 100,
    ]);
  });

  it("starts each later block from the opposite side, timed from the previous tap", () => {
    const block2 = { index: 2, width: 150, startMs: 750 };
    expect(blockLeftAt(steady, block2, 750)).toBe(250);
    expect(blockLeftAt(steady, block2, 1250)).toBe(150);
    const block3 = { index: 3, width: 150, startMs: 1250 };
    expect(blockLeftAt(steady, block3, 1250)).toBe(0);
  });

  it("speeds up by the ramp for each block", () => {
    const params = { ...steady, ramp: 0.1 };
    // Block 3 moves at 0.2 + 0.1 * 2 = 0.4 px/ms.
    expect(blockLeftAt(params, { index: 3, width: 200, startMs: 1000 }, 1100)).toBe(40);
  });

  it("never leaves the field", () => {
    const block = { index: 1, width: 120, startMs: 0 };
    for (let t = 0; t < 20_000; t += 37) {
      const left = blockLeftAt({ ...steady, startSpeed: 0.33 }, block, t);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left).toBeLessThanOrEqual(FIELD_WIDTH - 120);
    }
  });
});

describe("simulate: properties", () => {
  const seeds = Array.from({ length: 50 }, (_, i) => i * 7919);
  // Taps every 400-900 ms, varied by seed, without Math.random.
  const tapsFor = (seed: number) => {
    const taps: number[] = [];
    let t = 0;
    for (let i = 0; i < 40; i++) {
      t += 400 + ((seed + i * 131) % 500);
      taps.push(t);
    }
    return taps;
  };

  it("gives the same result for the same params and taps", () => {
    for (const seed of seeds) {
      const params = paramsFromSeed(seed);
      expect(simulate(params, tapsFor(seed))).toEqual(simulate(params, tapsFor(seed)));
    }
  });

  it("keeps the score equal to the placed blocks, never above the taps, with widths that never grow", () => {
    for (const seed of seeds) {
      const taps = tapsFor(seed);
      const { score, blocks } = simulate(paramsFromSeed(seed), taps);
      expect(score).toBe(blocks.length);
      expect(score).toBeLessThanOrEqual(taps.length);
      let below: { left: number; width: number } = BASE_BLOCK;
      for (const block of blocks) {
        expect(block.width).toBeGreaterThan(0);
        expect(block.width + block.overhang).toBeCloseTo(below.width, 6);
        expect(block.left).toBeGreaterThanOrEqual(below.left);
        expect(block.left + block.width).toBeLessThanOrEqual(below.left + below.width + 1e-9);
        below = block;
      }
    }
  });
});

describe("paramsFromSeed", () => {
  it("is deterministic", () => {
    expect(paramsFromSeed(12345)).toEqual(paramsFromSeed(12345));
  });

  it("stays inside the documented ranges over seeds 0 to 999, with both directions", () => {
    const directions = new Set<string>();
    for (let seed = 0; seed < 1000; seed++) {
      const params = paramsFromSeed(seed);
      expect(params.startSpeed).toBeGreaterThanOrEqual(PARAM_RANGES.startSpeed.min);
      expect(params.startSpeed).toBeLessThanOrEqual(PARAM_RANGES.startSpeed.max);
      expect(params.ramp).toBeGreaterThanOrEqual(PARAM_RANGES.ramp.min);
      expect(params.ramp).toBeLessThanOrEqual(PARAM_RANGES.ramp.max);
      expect(params.maxDurationMs).toBe(PARAM_RANGES.maxDurationMs);
      directions.add(params.direction);
    }
    expect([...directions].sort()).toEqual(["left", "right"]);
  });

  it("varies between players", () => {
    const speeds = new Set(Array.from({ length: 100 }, (_, seed) => paramsFromSeed(seed).startSpeed));
    expect(speeds.size).toBeGreaterThan(50);
  });
});

describe("stacking module", () => {
  it("scores by replaying the taps, higher is better", () => {
    expect(stacking.direction).toBe("higher-better");
    expect(stacking.score(steady, { tapsMs: [750, 1250] })).toBe(2);
    expect(stacking.paramsFromSeed(3)).toEqual(paramsFromSeed(3));
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
  ])("rejects %s", (_name, tapsMs) => {
    expect(stacking.inputsSchema.safeParse({ tapsMs }).success).toBe(false);
  });

  it(`allows at most ${MAX_TAPS} taps`, () => {
    const taps = (count: number) => Array.from({ length: count }, (_, i) => i * 10);
    expect(stacking.inputsSchema.safeParse({ tapsMs: taps(MAX_TAPS) }).success).toBe(true);
    expect(stacking.inputsSchema.safeParse({ tapsMs: taps(MAX_TAPS + 1) }).success).toBe(false);
  });
});
