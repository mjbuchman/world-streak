/**
 * How much later than the real elapsed time (server clock, from the attempt's start) the last
 * input may claim to be. Covers the time between the start response and the run starting.
 *
 * There is no maximum run length: a row waits for its tap as long as the player likes (human
 * decision, T87), so only the day's deadline limits when a run can be submitted.
 */
export const INPUT_TIMING_SLACK_MS = 2_000;
