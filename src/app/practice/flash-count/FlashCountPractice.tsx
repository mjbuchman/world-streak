"use client";

import { flashLadder, paramsFromSeed, play, type FlashLadderInputs, type FlashLadderParams } from "@/challenges/flash-count/flashLadder";
import { challengeUi } from "@/components/challenges/challengeUi";
import { dots, FlashLadderGame } from "@/components/flash-count/FlashLadderGame";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { secureRandomSeed } from "@/lib/random";

const ui = challengeUi("flash-count");
const newRun = () => paramsFromSeed(secureRandomSeed());

/** The result: rounds survived and the dot bank left, as the engine counts them. */
function result(params: FlashLadderParams, inputs: FlashLadderInputs) {
  const { survived, left } = play(params, inputs);
  const heading = survived === params.levels.length ? "Every round survived" : `${ui.scoreLabel(survived)} survived`;
  return { heading, detail: `${dots(left)} of your ${params.bank}-dot bank left. Score: ${flashLadder.score(params, inputs)}.` };
}

export function FlashCountPractice() {
  return (
    <PracticeShell<FlashLadderParams, FlashLadderInputs>
      howTo={ui.howTo}
      newRun={newRun}
      game={(params, onFinish) => <FlashLadderGame params={params} onFinish={onFinish} />}
      result={result}
    />
  );
}
