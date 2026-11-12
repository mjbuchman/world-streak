/**
 * The prize cycle (DESIGN.md "Streak cycle and prize"; the flat prize is the human's decision).
 * The cycles migration uses the same values; change both together.
 */

/** A flat $200 per cycle, plus any rollover from cycles nobody won. */
export const PRIZE_PER_CYCLE_CENTS = 20_000;
export const CYCLE_LENGTH_DAYS = 60;
/** The world streak a cycle needs, at any point inside it, for one player to win. */
export const STREAK_GOAL_DAYS = 30;
export const FIRST_CYCLE_START = "2027-01-01";
/** The winner is paid within this many days of the cycle ending. */
export const PAYOUT_WITHIN_DAYS = 45;
