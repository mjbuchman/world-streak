import { describe, expect, it } from "vitest";
import { CHALLENGES, isChallengeType } from "./registry";
import { CHALLENGE_TYPES } from "./shared/types";
import { stacking } from "./stacking/engine";

describe("challenge registry", () => {
  it("has a module for every challenge type", () => {
    expect(Object.keys(CHALLENGES).sort()).toEqual([...CHALLENGE_TYPES].sort());
    expect(CHALLENGES.stacking).toBe(stacking);
  });

  it("recognises known challenge types only", () => {
    expect(isChallengeType("stacking")).toBe(true);
    expect(isChallengeType("chess")).toBe(false);
    expect(isChallengeType("toString")).toBe(false);
  });
});
