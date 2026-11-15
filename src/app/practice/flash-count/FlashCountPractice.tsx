"use client";

import { flashLadder, LIVES, paramsFromSeed, play, type FlashLadderInputs, type FlashLadderParams } from "@/challenges/flash-count/flashLadder";
import { challengeUi } from "@/components/challenges/challengeUi";
import { FlashLadderGame } from "@/components/flash-count/FlashLadderGame";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { secureRandomSeed } from "@/lib/random";

const ui = challengeUi("flash-count");
const newRun = () => paramsFromSeed(secureRandomSeed());

/** The result: levels cleared and lives left, as the engine counts them. */
function result(params: FlashLadderParams, inputs: FlashLadderInputs) {
  const { cleared, lives } = play(params, inputs);
  const heading = cleared === params.levels.length ? "Every level cleared" : `${ui.scoreLabel(cleared)} cleared`;
  return { heading, detail: `${lives} of ${LIVES} lives left. Score: ${flashLadder.score(params, inputs)}.` };
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
