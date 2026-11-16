"use client";

import { fairSplit, LIVES, paramsFromSeed, play, type FairSplitInputs, type FairSplitParams } from "@/challenges/fair-split/engine";
import { challengeUi } from "@/components/challenges/challengeUi";
import { FairSplitGame } from "@/components/fair-split/FairSplitGame";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { secureRandomSeed } from "@/lib/random";

const ui = challengeUi("fair-split");
const newRun = () => paramsFromSeed(secureRandomSeed());

/** The result: the shapes cut and the lives left, as the engine counts them. */
function result(params: FairSplitParams, inputs: FairSplitInputs) {
  const { shape, lives } = play(params, inputs);
  const heading = shape === params.shapes.length ? "Every shape cut" : shape === 0 ? "No shape cut" : `Shapes cut: ${shape}`;
  return { heading, detail: `${lives} of ${LIVES} lives left. Score: ${fairSplit.score(params, inputs)}.` };
}

export function FairSplitPractice() {
  return (
    <PracticeShell<FairSplitParams, FairSplitInputs>
      howTo={ui.howTo}
      newRun={newRun}
      game={(params, onFinish) => <FairSplitGame params={params} onFinish={onFinish} />}
      result={result}
    />
  );
}
