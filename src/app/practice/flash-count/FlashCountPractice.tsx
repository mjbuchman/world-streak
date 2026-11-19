"use client";

import { paramsFromSeed, play, type FlashCountInputs, type FlashCountParams } from "@/challenges/flash-count/engine";
import { challengeUi } from "@/components/challenges/challengeUi";
import { dots, FlashCountGame } from "@/components/flash-count/FlashCountGame";
import { bankResult } from "@/components/practice/bankResult";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { secureRandomSeed } from "@/lib/random";

const ui = challengeUi("flash-count");
const newRun = () => paramsFromSeed(secureRandomSeed());

/** The result: rounds survived and the dot bank left, as the engine counts them. */
function result(params: FlashCountParams, inputs: FlashCountInputs) {
  return bankResult({
    ...play(params, inputs),
    total: params.levels.length,
    everyLabel: "Every round survived",
    scoreLabel: ui.scoreLabel,
    format: dots,
    bankLabel: `${params.bank}-dot bank`,
  });
}

export function FlashCountPractice() {
  return (
    <PracticeShell<FlashCountParams, FlashCountInputs>
      howTo={ui.howTo}
      newRun={newRun}
      game={(params, onFinish) => <FlashCountGame params={params} onFinish={onFinish} />}
      result={result}
    />
  );
}
