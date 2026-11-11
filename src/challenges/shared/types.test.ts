import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { CHALLENGE_TYPES, type ChallengeModule, type ChallengeType, type ScoreDirection } from "./types";

describe("challenge types", () => {
  it("lists the challenge types, starting with stacking", () => {
    expect(CHALLENGE_TYPES).toEqual(["stacking", "inner-clock", "flash-count"]);
    expectTypeOf<ChallengeType>().toEqualTypeOf<"stacking" | "inner-clock" | "flash-count">();
    expectTypeOf<ScoreDirection>().toEqualTypeOf<"higher-better" | "lower-better">();
  });

  it("describes a module as params from a seed, a score, whether the run finished, an inputs schema, a direction and input timing", () => {
    const counter: ChallengeModule<{ target: number }, { taps: number; lastMs: number }> = {
      paramsFromSeed: (seed) => ({ target: seed % 10 }),
      score: (params, inputs) => Math.abs(params.target - inputs.taps),
      finished: (_params, inputs) => inputs.taps > 0,
      inputsSchema: z.object({ taps: z.number().int(), lastMs: z.number() }),
      direction: "lower-better",
      lastInputMs: (inputs) => inputs.lastMs,
    };
    const inputs = counter.inputsSchema.parse({ taps: 5, lastMs: 900 });
    expect(counter.score(counter.paramsFromSeed(17), inputs)).toBe(2);
    expect(counter.finished(counter.paramsFromSeed(17), inputs)).toBe(true);
    expect(counter.lastInputMs(inputs)).toBe(900);
    expectTypeOf(counter.inputsSchema.parse).returns.toEqualTypeOf<{ taps: number; lastMs: number }>();
  });
});
