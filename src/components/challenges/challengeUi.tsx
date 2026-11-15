"use client";

import type { ReactNode } from "react";
import type { FlashCountInputs, FlashCountParams } from "@/challenges/flash-count/engine";
import type { TimeBankInputs, TimeBankParams } from "@/challenges/inner-clock/timeBank";
import type { ChallengeType } from "@/challenges/shared/types";
import type { StackingInputs, StackingParams } from "@/challenges/stacking/engine";
import { FlashCountGame } from "@/components/flash-count/FlashCountGame";
import { TimeBankGame } from "@/components/inner-clock/TimeBankGame";
import { reachedRow, targetRow } from "@/components/stacking/rows";
import { StackingGame } from "@/components/stacking/StackingGame";
import { FLASH_COUNT_HOW_TO, INNER_CLOCK_HOW_TO, practicePath, STACKING_HOW_TO } from "@/config/challenges";

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
const percent = (score: number) => `${score}%`;

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

const flashCount: ChallengeUi<FlashCountParams, FlashCountInputs> = {
  howTo: FLASH_COUNT_HOW_TO,
  practicePath: practicePath("flash-count"),
  play: ({ params, onFinish }) => <FlashCountGame params={params} onFinish={onFinish} />,
  scoreLabel: percent,
  summary: (score, passTarget) => `You were ${percent(score)} off. Today's target was within ${percent(passTarget)}.`,
};

const CHALLENGE_UI = { stacking, "inner-clock": innerClock, "flash-count": flashCount } satisfies Record<ChallengeType, unknown>;

/**
 * The screens for a challenge type. As with `challengeForGameDay`, the params and inputs types are
 * erased: the page hands a challenge only the params its own start returned and passes its own
 * inputs straight to submit, never another challenge's.
 */
export function challengeUi(type: ChallengeType): ChallengeUi<unknown, unknown> {
  return CHALLENGE_UI[type] as unknown as ChallengeUi<unknown, unknown>;
}
