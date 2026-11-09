/**
 * How long after starting a scored attempt it can still be submitted. A run lasts at most a
 * minute, so three minutes leaves room for a slow connection without allowing long replays.
 */
export const ATTEMPT_MAX_AGE_MS = 180_000;

/**
 * How much later than the real elapsed time (server clock, from the attempt's start) the last
 * input may claim to be. Covers the time between the start response and the run starting.
 */
export const INPUT_TIMING_SLACK_MS = 2_000;
