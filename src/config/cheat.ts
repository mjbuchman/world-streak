/**
 * Thresholds for the cheat checks (T40). Placeholders, recorded as a judgment call in
 * docs/DECISIONS.md: a flag only puts an account's prize entries on hold for an admin to review
 * (T41, T42); it never changes a pass, a fail or the meter.
 */
import { RUN_COUNTDOWN_MS } from "./countdown";

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

/**
 * Swift Sum: an answer this soon after the dots cleared is faster than typing, when reported.
 * Re-checked for 10 to 30 dots (T206) and 10 to 25 (T220): the count does not change how fast an
 * honest answer can be typed, so it stays.
 */
export const FLASH_COUNT_MIN_ANSWER_MS = 800;

/**
 * Second Sense: this many of the four rounds of one run each tapped under this error (ms) look
 * scripted on 10 to 20 s intervals (T164, T183). Re-checked for the 2 s bank (T204) and the 4 s
 * bank (T220): a bigger bank only lets honest errors grow, still far above 25 ms, so the values stay.
 */
export const INNER_CLOCK_PRECISE_ROUNDS = 3;
export const INNER_CLOCK_PRECISE_ERROR_MS = 25;

/** Echo Path: two taps closer than this are faster than a person can move to the next tile (T164). */
export const ECHO_PATH_MIN_TAP_INTERVAL_MS = 80;
/** With at least this many taps, intervals this even (standard deviation, ms) look scripted. */
export const ECHO_PATH_RHYTHM_MIN_TAPS = 10;
export const ECHO_PATH_RHYTHM_MAX_SD_MS = 5;

/**
 * Fair Split: this many cuts of one run within this many points of 50% look computed (T164; three
 * of the five rounds since T196).
 */
export const FAIR_SPLIT_PRECISE_CUTS = 3;
export const FAIR_SPLIT_PRECISE_POINTS = 0.05;
/** A cut the bank survived this soon after its shape appeared is faster than a person can place the line (T196). */
export const FAIR_SPLIT_MIN_CUT_MS = 1500;

/**
 * Confusing Colors (T240): a correct answer sooner than this after its word appeared is faster than a
 * person can read and tap; one lucky anticipation is human, so it takes this many in one run.
 */
export const INK_MIN_REACTION_MS = 180;
export const INK_FAST_ANSWERS = 3;
/**
 * With at least this many answers, reaction times this even (standard deviation, ms) look scripted.
 * Reaction times, not gaps between taps: the run's single 3-2-1 cannot hide a script's rhythm.
 */
export const INK_RHYTHM_MIN_ANSWERS = 12;
export const INK_RHYTHM_MAX_SD_MS = 12;

/**
 * Loading and reading before a run starts (15 s), and the 3-2-1 before its own clock starts
 * (T138), which the server's clock includes and the game's does not.
 */
export const TIMING_LOAD_ALLOWANCE_MS = 15_000 + RUN_COUNTDOWN_MS;
/** Beyond that allowance, a last input more than this far behind the server's clock is a mismatch. */
export const TIMING_MISMATCH_MS = 2_000;
