"use client";

import type { ReactNode } from "react";
import type { FlashCountInputs, FlashCountParams } from "@/challenges/flash-count/engine";
import type { InnerClockInputs, InnerClockParams } from "@/challenges/inner-clock/engine";
import type { ChallengeType } from "@/challenges/shared/types";
import type { StackingInputs, StackingParams } from "@/challenges/stacking/engine";
import { FlashCountGame } from "@/components/flash-count/FlashCountGame";
import { InnerClockGame } from "@/components/inner-clock/InnerClockGame";
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
  /** The result's line under the verdict: the player's score against today's target. */
  summary: (score: number, passTarget: number) => string;
};

const stacking: ChallengeUi<StackingParams, StackingInputs> = {
  howTo: STACKING_HOW_TO,
  practicePath: practicePath("stacking"),
  play: ({ params, passTarget, onFinish }) => (
    <StackingGame params={params} passTarget={passTarget} onFinish={({ taps }) => onFinish({ tapsMs: taps })} />
  ),
  summary: (score, passTarget) => `${reachedRow(score)}. Today's target was ${targetRow(passTarget)}.`,
};

const innerClock: ChallengeUi<InnerClockParams, InnerClockInputs> = {
  howTo: INNER_CLOCK_HOW_TO,
  practicePath: practicePath("inner-clock"),
  play: ({ params, onFinish }) => <InnerClockGame params={params} onFinish={onFinish} />,
  summary: (score, passTarget) => `You were ${score} s off. Today's target was within ${passTarget} s.`,
};

const flashCount: ChallengeUi<FlashCountParams, FlashCountInputs> = {
  howTo: FLASH_COUNT_HOW_TO,
  practicePath: practicePath("flash-count"),
  play: ({ params, onFinish }) => <FlashCountGame params={params} onFinish={onFinish} />,
  summary: (score, passTarget) => `You were ${score}% off. Today's target was within ${passTarget}%.`,
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
