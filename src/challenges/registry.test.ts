import { describe, expect, it } from "vitest";
import { CHALLENGES, challengeForGameDay, isChallengeType } from "./registry";
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

  it("gives a game day's challenge module", () => {
    expect(challengeForGameDay("2026-11-08", "stacking")).toBe(stacking);
  });

  it("fails loudly, naming the day and type, on a challenge type the server does not know", () => {
    expect(() => challengeForGameDay("2026-11-08", "chess")).toThrow('Game day 2026-11-08 has unknown challenge type "chess"');
    expect(() => challengeForGameDay("2026-11-08", "toString")).toThrow(/toString/);
  });
});
