"use client";

import { paramsFromSeed, play, type FairSplitInputs, type FairSplitParams } from "@/challenges/fair-split/engine";
import { challengeUi } from "@/components/challenges/challengeUi";
import { FairSplitGame, points } from "@/components/fair-split/FairSplitGame";
import { bankResult } from "@/components/practice/bankResult";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { secureRandomSeed } from "@/lib/random";

const ui = challengeUi("fair-split");
const newRun = () => paramsFromSeed(secureRandomSeed());

/** The result: the shapes survived and the bank left, as the engine counts them (T195). */
function result(params: FairSplitParams, inputs: FairSplitInputs) {
  return bankResult({
    ...play(params, inputs),
    total: params.shapes.length,
    everyLabel: "Every shape survived",
    scoreLabel: ui.scoreLabel,
    format: points,
    bankLabel: `${params.bank}-point bank`,
  });
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
