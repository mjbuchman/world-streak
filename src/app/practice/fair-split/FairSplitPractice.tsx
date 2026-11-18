"use client";

import { fairSplit, paramsFromSeed, play, type FairSplitInputs, type FairSplitParams } from "@/challenges/fair-split/engine";
import { challengeUi } from "@/components/challenges/challengeUi";
import { FairSplitGame, points } from "@/components/fair-split/FairSplitGame";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { secureRandomSeed } from "@/lib/random";

const ui = challengeUi("fair-split");
const newRun = () => paramsFromSeed(secureRandomSeed());

/** The result: the shapes survived and the bank left, as the engine counts them (T195). */
function result(params: FairSplitParams, inputs: FairSplitInputs) {
  const { survived, left } = play(params, inputs);
  const heading = survived === params.shapes.length ? "Every shape survived" : `${ui.scoreLabel(survived)} survived`;
  return { heading, detail: `${points(left)} of your ${params.bank}-point bank left. Score: ${fairSplit.score(params, inputs)}.` };
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
