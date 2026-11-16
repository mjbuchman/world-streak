"use client";

import type { ReactNode } from "react";
import type { EchoPathInputs, EchoPathParams } from "@/challenges/echo-path/engine";
import type { FairSplitInputs, FairSplitParams } from "@/challenges/fair-split/engine";
import type { FlashLadderInputs, FlashLadderParams } from "@/challenges/flash-count/flashLadder";
import type { TimeBankInputs, TimeBankParams } from "@/challenges/inner-clock/timeBank";
import type { ChallengeType } from "@/challenges/shared/types";
import type { StackingInputs, StackingParams } from "@/challenges/stacking/engine";
import { EchoPathGame } from "@/components/echo-path/EchoPathGame";
import { FairSplitGame } from "@/components/fair-split/FairSplitGame";
import { FlashLadderGame } from "@/components/flash-count/FlashLadderGame";
import { TimeBankGame } from "@/components/inner-clock/TimeBankGame";
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
};

/** Time Bank: rounds survived plus the budget left as a fraction ("3.9 rounds"). */
const rounds = (score: number) => `${score} ${score === 1 ? "round" : "rounds"}`;
/** Flash Ladder: levels cleared plus the lives left as a fraction ("4.667 levels"). */
const levels = (score: number) => `${score} ${score === 1 ? "level" : "levels"}`;

const stacking: ChallengeUi<StackingParams, StackingInputs> = {
  howTo: STACKING_HOW_TO,
  practicePath: practicePath("stacking"),
  play: ({ params, passTarget, onFinish }) => (
    <StackingGame params={params} passTarget={passTarget} onFinish={({ taps }) => onFinish({ tapsMs: taps })} />
  ),
  scoreLabel: reachedRow,
  summary: (score, passTarget) => `${reachedRow(score)}. Today's target was ${targetRow(passTarget)}.`,
};

const innerClock: ChallengeUi<TimeBankParams, TimeBankInputs> = {
  howTo: INNER_CLOCK_HOW_TO,
  practicePath: practicePath("inner-clock"),
  play: ({ params, onFinish }) => <TimeBankGame params={params} onFinish={onFinish} />,
  scoreLabel: rounds,
  summary: (score, passTarget) => `You scored ${rounds(score)}. Today's target was ${rounds(passTarget)}.`,
};

const flashCount: ChallengeUi<FlashLadderParams, FlashLadderInputs> = {
  howTo: FLASH_COUNT_HOW_TO,
  practicePath: practicePath("flash-count"),
  play: ({ params, onFinish }) => <FlashLadderGame params={params} onFinish={onFinish} />,
  scoreLabel: levels,
  summary: (score, passTarget) => `You scored ${levels(score)}. Today's target was ${levels(passTarget)}.`,
};

/** Echo Path: the longest path repeated plus the lives left as a fraction ("5.667 steps"). */
const steps = (score: number) => `${score} ${score === 1 ? "step" : "steps"}`;

const echoPath: ChallengeUi<EchoPathParams, EchoPathInputs> = {
  howTo: ECHO_PATH_HOW_TO,
  practicePath: practicePath("echo-path"),
  play: ({ params, onFinish }) => <EchoPathGame params={params} onFinish={onFinish} />,
  scoreLabel: steps,
  summary: (score, passTarget) => `You scored ${steps(score)}. Today's target was ${steps(passTarget)}.`,
};

/** Fair Split: shapes cut plus the lives left as a fraction ("6.333 shapes"). */
const shapes = (score: number) => `${score} ${score === 1 ? "shape" : "shapes"}`;

const fairSplit: ChallengeUi<FairSplitParams, FairSplitInputs> = {
  howTo: FAIR_SPLIT_HOW_TO,
  practicePath: practicePath("fair-split"),
  play: ({ params, onFinish }) => <FairSplitGame params={params} onFinish={onFinish} />,
  scoreLabel: shapes,
  summary: (score, passTarget) => `You scored ${shapes(score)}. Today's target was ${shapes(passTarget)}.`,
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
