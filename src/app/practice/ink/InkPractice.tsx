"use client";

import { BANK_MS, paramsFromSeed, play, ROUNDS, WORDS_PER_ROUND, type InkInputs, type InkParams } from "@/challenges/ink/engine";
import { HINT, InkGame, seconds } from "@/components/ink/InkGame";
import { bankResult } from "@/components/practice/bankResult";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { secureRandomSeed } from "@/lib/random";

/** The how-to lives here until Ink is registered as a challenge (phase 2). */
const INK_HOW_TO =
  `${HINT} Press Start for ${ROUNDS} rounds of ${WORDS_PER_ROUND} colour words. ` +
  `Wrong, slow and missed answers drain one ${seconds(BANK_MS)} time bank; each round is faster and more words disagree with their ink. ` +
  "Survive all five.";

const rounds = (n: number) => `${n} ${n === 1 ? "round" : "rounds"}`;
const newRun = () => paramsFromSeed(secureRandomSeed());

/** The result: whole rounds survived and the bank left, as the engine counts them (T252). */
function result(params: InkParams, inputs: InkInputs) {
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

export function InkPractice() {
  return (
    <PracticeShell<InkParams, InkInputs>
      howTo={INK_HOW_TO}
      newRun={newRun}
      game={(params, onFinish) => <InkGame params={params} onFinish={onFinish} />}
      result={result}
    />
  );
}
