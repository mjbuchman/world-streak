"use client";

import { useState } from "react";
import { paramsFromSeed, type StackingParams } from "@/challenges/stacking/engine";
import { challengeUi } from "@/components/challenges/challengeUi";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { type FinishedRun, StackingGame } from "@/components/stacking/StackingGame";
import { secureRandomSeed } from "@/lib/random";

const ui = challengeUi("stacking");
const newRun = () => paramsFromSeed(secureRandomSeed());

export function StackingPractice() {
  // The best row reached on this visit; shown in the HUD of later runs.
  const [best, setBest] = useState(0);
  return (
    <PracticeShell<StackingParams, FinishedRun>
      howTo={ui.howTo}
      newRun={newRun}
      game={(params, onFinish) => (
        <StackingGame
          params={params}
          best={best}
          onFinish={(run) => {
            setBest((previous) => Math.max(previous, run.result.score));
            onFinish(run);
          }}
        />
      )}
      result={(_params, { result }) => ({ score: result.score, heading: ui.scoreLabel(result.score) })}
    />
  );
}
