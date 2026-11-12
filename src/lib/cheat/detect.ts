// Cheat checks (T40): pure rules over one scored attempt and the player's recent ones. They
// protect prize entries only. A flag never changes a pass, a fail or the meter: cheating to pass
// only helps the streak, and sabotage must look the same as an honest fail (DESIGN.md).
import { simulate, type StackingParams } from "@/challenges/stacking/engine";
import {
  FLASH_COUNT_MIN_ANSWER_MS,
  INNER_CLOCK_NEAR_PERFECT_COUNT,
  INNER_CLOCK_NEAR_PERFECT_S,
  INNER_CLOCK_WINDOW,
  STACKING_MIN_TAP_INTERVAL_MS,
  STACKING_PERFECT_RUN_ROWS,
  STACKING_RHYTHM_MAX_SD_MS,
  STACKING_RHYTHM_MIN_TAPS,
  TIMING_LOAD_ALLOWANCE_MS,
  TIMING_MISMATCH_MS,
} from "@/config/cheat";

export type FlagReason =
  | "stacking-min-interval"
  | "stacking-robotic-rhythm"
  | "stacking-perfect-run"
  | "inner-clock-implausible"
  | "flash-count-instant"
  | "timing-mismatch";

export type DetectArgs = {
  challengeType: string;
  /** The inputs the server scored (already validated by the challenge's schema). */
  inputs: unknown;
  /** The official score of this attempt. */
  score: number;
  params: unknown;
  /** How long the server saw the attempt running, from start to submit. */
  serverElapsedMs: number;
  /** The player's earlier scored attempts, newest first. */
  history: { challengeType: string; score: number }[];
  /** Swift Sum: ms from the dots clearing to the answer, when the game reports it. */
  answerAfterClearMs?: number | null;
};

const intervals = (taps: readonly number[]) => taps.slice(1).map((tap, i) => tap - taps[i]);

/** NaN for no values: callers check for enough taps first. */
function standardDeviation(values: readonly number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

/** The longest stretch of consecutive rows locked without losing a cell. */
function longestPerfectRun(params: StackingParams, taps: readonly number[]): number {
  let longest = 0;
  let current = 0;
  for (const row of simulate(params, taps).rows) {
    current = row.width > 0 && row.lostColumns.length === 0 ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function stackingFlags(params: StackingParams, taps: readonly number[]): FlagReason[] {
  const flags: FlagReason[] = [];
  const gaps = intervals(taps);
  if (gaps.some((gap) => gap < STACKING_MIN_TAP_INTERVAL_MS)) flags.push("stacking-min-interval");
  if (taps.length >= STACKING_RHYTHM_MIN_TAPS && standardDeviation(gaps) < STACKING_RHYTHM_MAX_SD_MS) {
    flags.push("stacking-robotic-rhythm");
  }
  if (longestPerfectRun(params, taps) >= STACKING_PERFECT_RUN_ROWS) flags.push("stacking-perfect-run");
  return flags;
}

/** This attempt and the latest earlier Second Sense ones, up to INNER_CLOCK_WINDOW in all. */
function innerClockImplausible(score: number, history: DetectArgs["history"]): boolean {
  const earlier = history.filter((attempt) => attempt.challengeType === "inner-clock").map((attempt) => attempt.score);
  const window = [score, ...earlier].slice(0, INNER_CLOCK_WINDOW);
  return window.filter((error) => error < INNER_CLOCK_NEAR_PERFECT_S).length >= INNER_CLOCK_NEAR_PERFECT_COUNT;
}

/**
 * The game's clock starts after loading and the how-to, which the server's clock includes; past
 * that allowance, a last input far behind the server's clock suggests inputs made up offline.
 * Null when the run has no timed last input to compare.
 */
function lastTimedInputMs(challengeType: string, inputs: unknown): number | null {
  if (challengeType === "stacking") return (inputs as { tapsMs: number[] }).tapsMs.at(-1) ?? null;
  if (challengeType === "inner-clock") return (inputs as { tapMs: number | null }).tapMs;
  // Swift Sum's answer is typed after the flash, untimed.
  return null;
}

export function detectFlags(args: DetectArgs): FlagReason[] {
  const flags: FlagReason[] = [];
  if (args.challengeType === "stacking") {
    flags.push(...stackingFlags(args.params as StackingParams, (args.inputs as { tapsMs: number[] }).tapsMs));
  } else if (args.challengeType === "inner-clock") {
    if (innerClockImplausible(args.score, args.history)) flags.push("inner-clock-implausible");
  } else if (args.challengeType === "flash-count") {
    if (args.answerAfterClearMs != null && args.answerAfterClearMs < FLASH_COUNT_MIN_ANSWER_MS) flags.push("flash-count-instant");
  }

  const last = lastTimedInputMs(args.challengeType, args.inputs);
  if (last !== null && args.serverElapsedMs - TIMING_LOAD_ALLOWANCE_MS - last > TIMING_MISMATCH_MS) flags.push("timing-mismatch");
  return flags;
}
