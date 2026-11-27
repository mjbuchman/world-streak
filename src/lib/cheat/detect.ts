// Cheat checks (T40): pure rules over one scored attempt and the player's recent ones. They
// protect prize entries only. A flag never changes a pass, a fail or the meter: cheating to pass
// only helps the streak, and sabotage must look the same as an honest fail (DESIGN.md).
import { play as playEchoPath, type EchoPathInputs, type EchoPathParams } from "@/challenges/echo-path/engine";
import { play as playFairSplit, type FairSplitInputs, type FairSplitParams } from "@/challenges/fair-split/engine";
import { splitShare } from "@/challenges/fair-split/geometry";
import { play, REVEAL_MS, type FlashCountInputs, type FlashCountParams } from "@/challenges/flash-count/engine";
import { play as playInk, type InkInputs, type InkParams } from "@/challenges/ink/engine";
import { roundErrorMs, type InnerClockInputs, type InnerClockParams } from "@/challenges/inner-clock/engine";
import { challengeForGameDay, isChallengeType } from "@/challenges/registry";
import { simulate, type StackingParams } from "@/challenges/stacking/engine";
import {
  ECHO_PATH_MIN_TAP_INTERVAL_MS,
  ECHO_PATH_RHYTHM_MAX_SD_MS,
  ECHO_PATH_RHYTHM_MIN_TAPS,
  FAIR_SPLIT_MIN_CUT_MS,
  FAIR_SPLIT_PRECISE_CUTS,
  FAIR_SPLIT_PRECISE_POINTS,
  FLASH_COUNT_MIN_ANSWER_MS,
  INK_FAST_ANSWERS,
  INK_MIN_REACTION_MS,
  INK_RHYTHM_MAX_SD_MS,
  INK_RHYTHM_MIN_ANSWERS,
  STACKING_MIN_TAP_INTERVAL_MS,
  STACKING_PERFECT_RUN_ROWS,
  STACKING_RHYTHM_MAX_SD_MS,
  STACKING_RHYTHM_MIN_TAPS,
  INNER_CLOCK_PRECISE_ERROR_MS,
  INNER_CLOCK_PRECISE_ROUNDS,
  TIMING_LOAD_ALLOWANCE_MS,
  TIMING_MISMATCH_MS,
} from "@/config/cheat";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";

export type FlagReason =
  | "stacking-min-interval"
  | "stacking-robotic-rhythm"
  | "stacking-perfect-run"
  // "inner-clock-implausible" was retired with the single-round Second Sense (T140); older flags
  // keep it as stored text. Time Bank's own check is "time-bank-implausible" (T164).
  | "time-bank-implausible"
  | "flash-count-instant"
  | "echo-path-robotic"
  | "fair-split-implausible"
  | "fair-split-instant"
  | "ink-too-fast"
  | "ink-robotic"
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

/**
 * The gaps between Echo Path taps inside each echo of the path. The gap before an echo's first
 * tap holds the pause and the playback, which the game sets, not the player; across a long run
 * those gaps alone would hide a script's even rhythm (T191).
 */
function echoGapsMs(params: EchoPathParams, { taps }: EchoPathInputs): number[] {
  return taps.slice(1).flatMap((tap, i) => (playEchoPath(params, { taps: taps.slice(0, i + 1) }).position > 0 ? [tap.atMs - taps[i].atMs] : []));
}

/** Taps faster than a hand moves, or, within each echo, evenly spaced like a script. */
function echoPathRobotic(params: EchoPathParams, inputs: EchoPathInputs): boolean {
  const tooQuick = intervals(inputs.taps.map((tap) => tap.atMs)).some((gap) => gap < ECHO_PATH_MIN_TAP_INTERVAL_MS);
  // As many gaps as a run of ECHO_PATH_RHYTHM_MIN_TAPS taps has.
  const rhythm = echoGapsMs(params, inputs);
  return tooQuick || (rhythm.length >= ECHO_PATH_RHYTHM_MIN_TAPS - 1 && standardDeviation(rhythm) < ECHO_PATH_RHYTHM_MAX_SD_MS);
}

/** Many Time Bank rounds of one run tapped almost exactly on target. */
function innerClockImplausible(params: InnerClockParams, { tapsMs }: InnerClockInputs): boolean {
  const precise = params.rounds
    .slice(0, tapsMs.length)
    .filter((round, i) => tapsMs[i] !== null && roundErrorMs(round, tapsMs[i], params.budgetMs) < INNER_CLOCK_PRECISE_ERROR_MS);
  return precise.length >= INNER_CLOCK_PRECISE_ROUNDS;
}

/**
 * Each Fair Split cut the game judged: how far from half it was (in points), whether the bank
 * survived it and how long after its shape appeared. Cuts in the pause and the 3-2-1 before a
 * shape, or after the run ended, were never judged, so they are left out (T196).
 */
function judgedCuts(params: FairSplitParams, { cuts }: FairSplitInputs) {
  return cuts.flatMap((cut, i) => {
    const before = playFairSplit(params, { cuts: cuts.slice(0, i), endMs: cut.atMs });
    if (before.finished || cut.atMs < before.appearsAt) return [];
    const after = playFairSplit(params, { cuts: cuts.slice(0, i + 1), endMs: cut.atMs });
    const share = splitShare(params.shapes[before.round].polygon, { x: cut.ax, y: cut.ay }, { x: cut.bx, y: cut.by });
    return [{ offPoints: Math.abs(share * 100 - 50), counted: !after.failed, afterMs: cut.atMs - before.appearsAt }];
  });
}

function fairSplitFlags(params: FairSplitParams, inputs: FairSplitInputs): FlagReason[] {
  const judged = judgedCuts(params, inputs);
  const flags: FlagReason[] = [];
  if (judged.filter((cut) => cut.offPoints <= FAIR_SPLIT_PRECISE_POINTS).length >= FAIR_SPLIT_PRECISE_CUTS) {
    flags.push("fair-split-implausible");
  }
  if (judged.some((cut) => cut.counted && cut.afterMs < FAIR_SPLIT_MIN_CUT_MS)) flags.push("fair-split-instant");
  return flags;
}

/**
 * Each Confusing Colors answer the game counted: how long after its word appeared, and whether it
 * was right. Answers the game ignored (for another word, before the word, after the run) are left out.
 */
function inkReactions(params: InkParams, { answers }: InkInputs) {
  return answers.flatMap((answer, i) => {
    const before = playInk(params, { answers: answers.slice(0, i), endMs: answer.atMs });
    if (before.appearsAt === null || answer.word !== before.costs.length || answer.atMs < before.appearsAt) return [];
    return [{ reactionMs: answer.atMs - before.appearsAt, correct: answer.colour === params.words[answer.word].ink }];
  });
}

function inkFlags(params: InkParams, inputs: InkInputs): FlagReason[] {
  const reactions = inkReactions(params, inputs);
  const flags: FlagReason[] = [];
  if (reactions.filter((r) => r.correct && r.reactionMs < INK_MIN_REACTION_MS).length >= INK_FAST_ANSWERS) flags.push("ink-too-fast");
  if (reactions.length >= INK_RHYTHM_MIN_ANSWERS && standardDeviation(reactions.map((r) => r.reactionMs)) < INK_RHYTHM_MAX_SD_MS) {
    flags.push("ink-robotic");
  }
  return flags;
}

/**
 * The game's clock starts after loading and the how-to, which the server's clock includes; past
 * that allowance, a last input far behind the server's clock suggests inputs made up offline.
 * Null for an unknown game, or a run with no timed input yet (the engines report 0).
 */
function lastTimedInputMs(challengeType: string, inputs: unknown, params: unknown): number | null {
  if (!isChallengeType(challengeType)) return null;
  const last = challengeForGameDay("", challengeType).lastInputMs(inputs, params);
  return last > 0 ? last : null;
}

/**
 * Each Swift Sum answer's time after its flash cleared. The clear time is the earliest the game
 * allows: the previous answer's reveal (if any), the round's 3-2-1, then its flash. Real frames
 * only come later, so an honest answer is never measured as faster than it was. Answer times
 * count from the game's start, before its first 3-2-1 (FlashCountGame, T185).
 */
function flashCountAnswerGapsMs(params: FlashCountParams, { answers }: FlashCountInputs): number[] {
  const gaps: number[] = [];
  for (let i = 0; i < answers.length && i < params.levels.length; i++) {
    if (play(params, { answers: answers.slice(0, i) }).failed) break;
    const shownAtMs = (i === 0 ? 0 : answers[i - 1].atMs + REVEAL_MS) + RUN_COUNTDOWN_MS;
    gaps.push(answers[i].atMs - shownAtMs - params.levels[i].flashMs);
  }
  return gaps;
}

/** The rules of the attempt's own game: one game's rule never looks at another's attempt. */
function gameFlags({ challengeType, inputs, params }: DetectArgs): FlagReason[] {
  switch (challengeType) {
    case "stacking":
      return stackingFlags(params as StackingParams, (inputs as { tapsMs: number[] }).tapsMs);
    case "inner-clock":
      return innerClockImplausible(params as InnerClockParams, inputs as InnerClockInputs) ? ["time-bank-implausible"] : [];
    case "flash-count": {
      const gaps = flashCountAnswerGapsMs(params as FlashCountParams, inputs as FlashCountInputs);
      return gaps.some((gap) => gap < FLASH_COUNT_MIN_ANSWER_MS) ? ["flash-count-instant"] : [];
    }
    case "echo-path":
      return echoPathRobotic(params as EchoPathParams, inputs as EchoPathInputs) ? ["echo-path-robotic"] : [];
    case "fair-split":
      return fairSplitFlags(params as FairSplitParams, inputs as FairSplitInputs);
    case "ink":
      return inkFlags(params as InkParams, inputs as InkInputs);
    default:
      return [];
  }
}

export function detectFlags(args: DetectArgs): FlagReason[] {
  const flags = gameFlags(args);

  const last = lastTimedInputMs(args.challengeType, args.inputs, args.params);
  if (last !== null && args.serverElapsedMs - TIMING_LOAD_ALLOWANCE_MS - last > TIMING_MISMATCH_MS) flags.push("timing-mismatch");
  return flags;
}
