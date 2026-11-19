"use client";

import type { ReactNode } from "react";
import type { EchoPathInputs, EchoPathParams } from "@/challenges/echo-path/engine";
import { ROUNDS as FAIR_SPLIT_ROUNDS, type FairSplitInputs, type FairSplitParams } from "@/challenges/fair-split/engine";
import { ROUNDS as FLASH_COUNT_ROUNDS, type FlashCountInputs, type FlashCountParams } from "@/challenges/flash-count/engine";
import { ROUNDS as INNER_CLOCK_ROUNDS, type InnerClockInputs, type InnerClockParams } from "@/challenges/inner-clock/engine";
import type { ChallengeType } from "@/challenges/shared/types";
import type { StackingInputs, StackingParams } from "@/challenges/stacking/engine";
import { EchoPathGame } from "@/components/echo-path/EchoPathGame";
import { FairSplitGame } from "@/components/fair-split/FairSplitGame";
import { FlashCountGame } from "@/components/flash-count/FlashCountGame";
import { InnerClockGame } from "@/components/inner-clock/InnerClockGame";
import { reachedRow, targetRow } from "@/components/stacking/rows";
import { StackingGame } from "@/components/stacking/StackingGame";
import { ECHO_PATH_HOW_TO, FAIR_SPLIT_HOW_TO, FLASH_COUNT_HOW_TO, INNER_CLOCK_HOW_TO, practicePath, STACKING_HOW_TO } from "@/config/challenges";

/**
 * A scored run of today's challenge. `params` come from the start endpoint for this challenge
 * and `onFinish` sends the inputs to the submit endpoint; the server scores them.
 */
export type PlayProps<Params, Inputs> = { params: Params; passTarget: number; onFinish: (inputs: Inputs) => void };

type ChallengeUi<Params, Inputs> = {
  /** How to play, before the scored attempt. */
  howTo: string;
  practicePath: string;
  play: (props: PlayProps<Params, Inputs>) => ReactNode;
  /** A score as players read it ("You reached row 7", "0.32 s", "12%"); daily play and practice share it. */
  scoreLabel: (score: number) => string;
  /** The result's line under the verdict: the player's score against today's target. */
  summary: (score: number, passTarget: number) => string;
  /** Today's target alone ("row 10", "5 levels"), for a game with no score on the results page. */
  target: (passTarget: number) => string;
  /**
   * Whether players see the score (T225). The bank games hide it, its fraction being the bank left,
   * and show only the whole rounds got through and pass or fail.
   */
  showScore: boolean;
};

/** Rounds or shapes survived, in words ("1 round", "3 shapes"). */
const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** Whole rounds survived ("3 rounds"), for practice's heading. */
const rounds = (score: number) => counted(score, "round", "rounds");

/**
 * A bank game's target in whole rounds (T225): a score is the rounds survived plus the bank left as
 * a fraction, so "all 4", "3 of 4", or, for a target between two counts, "3 of 4 and part of the bank".
 */
const bankTarget = (all: number, unit: string) => (target: number) => {
  if (target >= all) return `all ${all}`;
  const whole = Math.floor(target);
  return whole === target ? `${whole} of ${all} ${unit}` : `${whole} of ${all} ${unit} and part of the bank`;
};
/**
 * A bank game's line under the verdict: the whole rounds survived against today's target. A perfect
 * run scores one more than the rounds (the whole bank left), hence the cap.
 */
const bankSummary = (all: number, unit: string) => {
  const target = bankTarget(all, unit);
  return (score: number, passTarget: number) =>
    `You got through ${Math.min(Math.floor(score), all)} of ${all} ${unit}. Today's target was ${target(passTarget)}.`;
};

const stacking: ChallengeUi<StackingParams, StackingInputs> = {
  howTo: STACKING_HOW_TO,
  practicePath: practicePath("stacking"),
  play: ({ params, passTarget, onFinish }) => (
    <StackingGame params={params} passTarget={passTarget} onFinish={({ taps }) => onFinish({ tapsMs: taps })} />
  ),
  scoreLabel: reachedRow,
  summary: (score, passTarget) => `${reachedRow(score)}. Today's target was ${targetRow(passTarget)}.`,
  target: targetRow,
  showScore: true,
};

const innerClock: ChallengeUi<InnerClockParams, InnerClockInputs> = {
  howTo: INNER_CLOCK_HOW_TO,
  practicePath: practicePath("inner-clock"),
  play: ({ params, onFinish }) => <InnerClockGame params={params} onFinish={onFinish} />,
  scoreLabel: rounds,
  summary: bankSummary(INNER_CLOCK_ROUNDS, "rounds"),
  target: bankTarget(INNER_CLOCK_ROUNDS, "rounds"),
  showScore: false,
};

const flashCount: ChallengeUi<FlashCountParams, FlashCountInputs> = {
  howTo: FLASH_COUNT_HOW_TO,
  practicePath: practicePath("flash-count"),
  play: ({ params, onFinish }) => <FlashCountGame params={params} onFinish={onFinish} />,
  scoreLabel: rounds,
  summary: bankSummary(FLASH_COUNT_ROUNDS, "rounds"),
  target: bankTarget(FLASH_COUNT_ROUNDS, "rounds"),
  showScore: false,
};

/** Echo Path: the longest path repeated plus the lives left as a fraction ("7.667 tiles"). */
const tiles = (score: number) => counted(score, "tile", "tiles");
const pathOf = (target: number) => `a path of ${tiles(target)}`;

const echoPath: ChallengeUi<EchoPathParams, EchoPathInputs> = {
  howTo: ECHO_PATH_HOW_TO,
  practicePath: practicePath("echo-path"),
  play: ({ params, onFinish }) => <EchoPathGame params={params} onFinish={onFinish} />,
  scoreLabel: tiles,
  summary: (score, passTarget) => `You scored ${tiles(score)}. Today's target was ${pathOf(passTarget)}.`,
  target: pathOf,
  showScore: true,
};

/** Fair Split: whole shapes survived ("4 shapes"), for practice's heading. */
const shapes = (score: number) => counted(score, "shape", "shapes");

const fairSplit: ChallengeUi<FairSplitParams, FairSplitInputs> = {
  howTo: FAIR_SPLIT_HOW_TO,
  practicePath: practicePath("fair-split"),
  play: ({ params, onFinish }) => <FairSplitGame params={params} onFinish={onFinish} />,
  scoreLabel: shapes,
  summary: bankSummary(FAIR_SPLIT_ROUNDS, "shapes"),
  target: bankTarget(FAIR_SPLIT_ROUNDS, "shapes"),
  showScore: false,
};

const CHALLENGE_UI = {
  stacking,
  "inner-clock": innerClock,
  "flash-count": flashCount,
  "echo-path": echoPath,
  "fair-split": fairSplit,
} satisfies Record<ChallengeType, unknown>;

/**
 * The screens for a challenge type. As with `challengeForGameDay`, the params and inputs types are
 * erased: the page hands a challenge only the params its own start returned and passes its own
 * inputs straight to submit, never another challenge's.
 */
export function challengeUi(type: ChallengeType): ChallengeUi<unknown, unknown> {
  return CHALLENGE_UI[type] as unknown as ChallengeUi<unknown, unknown>;
}
