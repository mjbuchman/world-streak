/**
 * How much later than the real elapsed time (server clock, from the attempt's start) the last
 * input may claim to be. Covers the time between the start response and the run starting.
 *
 * There is no maximum run length: a row waits for its tap as long as the player likes (human
 * decision, T87), so only the day's deadline limits when a run can be submitted.
 */
export const INPUT_TIMING_SLACK_MS = 2_000;

/** Games in a day's lineup ("Game 2 of 3"); the database allows positions 1 to 3. */
export const GAMES_PER_DAY = 3;
