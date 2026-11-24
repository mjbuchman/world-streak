"use client";

import { BANK_MS, paramsFromSeed, play, PROMPTS_PER_ROUND, ROUNDS, type ArrowFlipInputs, type ArrowFlipParams } from "@/challenges/arrow-flip/engine";
import { ArrowFlipGame, seconds } from "@/components/arrow-flip/ArrowFlipGame";
import { bankResult } from "@/components/practice/bankResult";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { secureRandomSeed } from "@/lib/random";

/** The how-to lives here until Arrow Flip is registered as a challenge (phase 2). */
const ARROW_FLIP_HOW_TO =
  `Press Start for ${ROUNDS} rounds of ${PROMPTS_PER_ROUND} prompts. Each prompt shows an arrow, a direction word and a cue: ` +
  "WORD means answer the way the word says, ARROW the way the arrow points. Swipe on the board, tap a button or press an arrow key. " +
  `Wrong, slow and missed answers drain one ${seconds(BANK_MS)} time bank; each round is faster and the word and arrow disagree more often. ` +
  "Survive all five.";

const rounds = (n: number) => `${n} ${n === 1 ? "round" : "rounds"}`;
const newRun = () => paramsFromSeed(secureRandomSeed());

/** The result: whole rounds survived and the bank left, as the engine counts them (T246). */
function result(params: ArrowFlipParams, inputs: ArrowFlipInputs) {
  const { roundsSurvived, left } = play(params, inputs);
  return bankResult({
    survived: roundsSurvived,
    left,
    total: params.rounds.length,
    everyLabel: "Every round survived",
    scoreLabel: rounds,
    format: seconds,
    bankLabel: `${seconds(params.bank)} bank`,
  });
}

export function ArrowFlipPractice() {
  return (
    <PracticeShell<ArrowFlipParams, ArrowFlipInputs>
      howTo={ARROW_FLIP_HOW_TO}
      newRun={newRun}
      game={(params, onFinish) => <ArrowFlipGame params={params} onFinish={onFinish} />}
      result={result}
    />
  );
}
