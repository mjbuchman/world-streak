/**
 * Thresholds for the cheat checks (T40). Placeholders, recorded as a judgment call in
 * docs/DECISIONS.md: a flag only puts an account's prize entries on hold for an admin to review
 * (T41, T42); it never changes a pass, a fail or the meter.
 */

/** Two Tower taps closer than this are faster than a person can tap. */
export const STACKING_MIN_TAP_INTERVAL_MS = 120;
/** With at least this many taps, intervals this even (standard deviation, ms) look scripted. */
export const STACKING_RHYTHM_MIN_TAPS = 10;
export const STACKING_RHYTHM_MAX_SD_MS = 5;
/**
 * This many rows in a row locked without losing a cell. The backlog's 20 predates the 15-row grid
 * Tower (T76), so it could never trigger; 12 of 15 is the placeholder.
 */
export const STACKING_PERFECT_RUN_ROWS = 12;

/** Second Sense: an error under this many seconds counts as near perfect... */
export const INNER_CLOCK_NEAR_PERFECT_S = 0.01;
/** ...and this many near-perfect runs among the player's latest INNER_CLOCK_WINDOW is implausible. */
export const INNER_CLOCK_NEAR_PERFECT_COUNT = 3;
export const INNER_CLOCK_WINDOW = 5;

/** Swift Sum: an answer this soon after the dots cleared is faster than typing, when reported. */
export const FLASH_COUNT_MIN_ANSWER_MS = 800;

/** Loading and reading before a run starts, which the server's clock includes and the game's does not. */
export const TIMING_LOAD_ALLOWANCE_MS = 15_000;
/** Beyond that allowance, a last input more than this far behind the server's clock is a mismatch. */
export const TIMING_MISMATCH_MS = 2_000;
