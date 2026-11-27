"use client";

import { paramsFromSeed, play, WORDS, type InkInputs, type InkParams } from "@/challenges/ink/engine";
import { challengeUi } from "@/components/challenges/challengeUi";
import { InkGame, seconds } from "@/components/ink/InkGame";
import { bankResult } from "@/components/practice/bankResult";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { secureRandomSeed } from "@/lib/random";

const ui = challengeUi("ink");
const newRun = () => paramsFromSeed(secureRandomSeed());

/** The result: words survived and the bank left, as the engine counts them (T252, T256). */
function result(params: InkParams, inputs: InkInputs) {
  const { wordsSurvived, left } = play(params, inputs);
  return bankResult({
    survived: wordsSurvived,
    left,
    total: params.words.length,
    everyLabel: `All ${WORDS} words survived`,
    scoreLabel: ui.scoreLabel,
    format: seconds,
    bankLabel: `${seconds(params.bank)} bank`,
  });
}

export function InkPractice() {
  return (
    <PracticeShell<InkParams, InkInputs>
      howTo={ui.howTo}
      newRun={newRun}
      game={(params, onFinish) => <InkGame params={params} onFinish={onFinish} />}
      result={result}
    />
  );
}
