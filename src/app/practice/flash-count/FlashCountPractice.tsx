"use client";

import { countScore, type FlashCountInputs, type FlashCountParams, paramsFromSeed } from "@/challenges/flash-count/engine";
import { challengeUi } from "@/components/challenges/challengeUi";
import { FlashCountGame } from "@/components/flash-count/FlashCountGame";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { secureRandomSeed } from "@/lib/random";

const ui = challengeUi("flash-count");
const newRun = () => paramsFromSeed(secureRandomSeed());

export function FlashCountPractice() {
  return (
    <PracticeShell<FlashCountParams, FlashCountInputs>
      howTo={ui.howTo}
      newRun={newRun}
      game={(params, onFinish) => <FlashCountGame params={params} onFinish={onFinish} />}
      result={(params, { count }) => {
        const error = countScore(params, count);
        return {
          heading: error === 0 ? "Exactly right" : `${ui.scoreLabel(error)} off`,
          detail: `You said ${count}. There were ${params.dotCount} dots.`,
        };
      }}
    />
  );
}
