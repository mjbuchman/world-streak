import { describe, expect, it } from "vitest";
import { CYCLE_LENGTH_DAYS, FIRST_CYCLE_START, PAYOUT_WITHIN_DAYS, PRIZE_PER_CYCLE_CENTS, STREAK_GOAL_DAYS } from "@/config/prize";
import { type Cycle, currentPrizeCents, nextRolloverCents } from "./prize";

const cycle = (over: Partial<Cycle> = {}): Cycle => ({ baseCents: PRIZE_PER_CYCLE_CENTS, rolloverInCents: 0, goalReachedOn: null, ...over });

/** The next cycle, as the close job will create it (T34). */
const next = (previous: Cycle): Cycle => cycle({ rolloverInCents: nextRolloverCents(previous) });

describe("prize config", () => {
  it("is a flat $200 for a 30-day streak inside a 60-day cycle from 2027-01-01, paid within 45 days", () => {
    expect({ PRIZE_PER_CYCLE_CENTS, CYCLE_LENGTH_DAYS, STREAK_GOAL_DAYS, FIRST_CYCLE_START, PAYOUT_WITHIN_DAYS }).toEqual({
      PRIZE_PER_CYCLE_CENTS: 20_000,
      CYCLE_LENGTH_DAYS: 60,
      STREAK_GOAL_DAYS: 30,
      FIRST_CYCLE_START: "2027-01-01",
      PAYOUT_WITHIN_DAYS: 45,
    });
  });
});

describe("currentPrizeCents", () => {
  it("is the base plus whatever rolled in", () => {
    expect(currentPrizeCents(cycle())).toBe(20_000);
    expect(currentPrizeCents(cycle({ rolloverInCents: 40_000 }))).toBe(60_000);
  });
});

describe("nextRolloverCents", () => {
  it("rolls the whole prize over when nobody won: cycle 2 is $400, cycle 3 is $600", () => {
    const cycle2 = next(cycle());
    expect(currentPrizeCents(cycle2)).toBe(40_000);
    const cycle3 = next(cycle2);
    expect(currentPrizeCents(cycle3)).toBe(60_000);
  });

  it("rolls nothing over from a won cycle, so the next one is $200 again", () => {
    const won = cycle({ rolloverInCents: 40_000, goalReachedOn: "2027-01-30" });
    expect(nextRolloverCents(won)).toBe(0);
    expect(currentPrizeCents(next(won))).toBe(20_000);
  });
});
