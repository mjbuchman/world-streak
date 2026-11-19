"use client";

import { paramsFromSeed, play, type InnerClockInputs, type InnerClockParams } from "@/challenges/inner-clock/engine";
import { challengeUi } from "@/components/challenges/challengeUi";
import { targetLabel } from "@/components/inner-clock/InnerClockTap";
import { InnerClockGame } from "@/components/inner-clock/InnerClockGame";
import { bankResult } from "@/components/practice/bankResult";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { useIsClient } from "@/components/useIsClient";
import { secureRandomSeed } from "@/lib/random";

const ui = challengeUi("inner-clock");
const newRun = () => paramsFromSeed(secureRandomSeed());

/** "2.8 s", from ms. */
const seconds = (ms: number) => `${ms / 1000} s`;

/** The result: rounds survived and the time bank left, as the engine counts them. */
function result(params: InnerClockParams, inputs: InnerClockInputs) {
  return bankResult({
    ...play(params, inputs),
    total: params.rounds.length,
    everyLabel: "Every round survived",
    scoreLabel: ui.scoreLabel,
    format: seconds,
    bankLabel: `${seconds(params.budgetMs)} time bank`,
  });
}

export function InnerClockPractice() {
  // The targets are random, so the server cannot know the ones the browser picked: show the first
  // (and allow the start) only once the page runs in the browser.
  const isClient = useIsClient();
  return (
    <PracticeShell<InnerClockParams, InnerClockInputs>
      howTo={ui.howTo}
      newRun={newRun}
      preview={(params) => (isClient ? `First target: ${targetLabel(params.rounds[0].targetMs)}` : null)}
      startDisabled={!isClient}
      game={(params, onFinish) => <InnerClockGame params={params} onFinish={onFinish} />}
      result={result}
    />
  );
}
