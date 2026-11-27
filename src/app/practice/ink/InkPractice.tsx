"use client";

import { BANK_MS, paramsFromSeed, play, WORDS, type InkInputs, type InkParams } from "@/challenges/ink/engine";
import { HINT, InkGame, seconds } from "@/components/ink/InkGame";
import { bankResult } from "@/components/practice/bankResult";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { secureRandomSeed } from "@/lib/random";

/** The how-to lives here until Confusing Colors is registered as a challenge (phase 2). */
const INK_HOW_TO =
  `${HINT} Press Start for ${WORDS} colour words in a row. ` +
  `Wrong, slow and missed answers drain one ${seconds(BANK_MS)} time bank; more and more words disagree with their ink. ` +
  `Survive all ${WORDS} words.`;

const words = (n: number) => `${n} of ${WORDS} words`;
const newRun = () => paramsFromSeed(secureRandomSeed());

/** The result: words survived and the bank left, as the engine counts them (T252, T256). */
function result(params: InkParams, inputs: InkInputs) {
  const { wordsSurvived, left } = play(params, inputs);
  return bankResult({
    survived: wordsSurvived,
    left,
    total: params.words.length,
    everyLabel: `All ${WORDS} words survived`,
    scoreLabel: words,
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
