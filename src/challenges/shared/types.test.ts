import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { CHALLENGE_TYPES, type ChallengeModule, type ChallengeType, type ScoreDirection } from "./types";

describe("challenge types", () => {
  it("lists the challenge types, starting with stacking", () => {
    expect(CHALLENGE_TYPES).toEqual(["stacking"]);
    expectTypeOf<ChallengeType>().toEqualTypeOf<"stacking">();
    expectTypeOf<ScoreDirection>().toEqualTypeOf<"higher-better" | "lower-better">();
  });

  it("describes a module as params from a seed, a score, an inputs schema and a direction", () => {
    const counter: ChallengeModule<{ target: number }, { taps: number }> = {
      paramsFromSeed: (seed) => ({ target: seed % 10 }),
      score: (params, inputs) => Math.abs(params.target - inputs.taps),
      inputsSchema: z.object({ taps: z.number().int() }),
      direction: "lower-better",
    };
    expect(counter.score(counter.paramsFromSeed(17), counter.inputsSchema.parse({ taps: 5 }))).toBe(2);
    expectTypeOf(counter.inputsSchema.parse).returns.toEqualTypeOf<{ taps: number }>();
  });
});
