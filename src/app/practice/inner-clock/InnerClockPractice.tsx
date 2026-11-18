"use client";

import { paramsFromSeed, play, timeBank, type TimeBankInputs, type TimeBankParams } from "@/challenges/inner-clock/timeBank";
import { challengeUi } from "@/components/challenges/challengeUi";
import { targetLabel } from "@/components/inner-clock/InnerClockGame";
import { TimeBankGame } from "@/components/inner-clock/TimeBankGame";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { useIsClient } from "@/components/useIsClient";
import { secureRandomSeed } from "@/lib/random";

const ui = challengeUi("inner-clock");
const newRun = () => paramsFromSeed(secureRandomSeed());

/** "2.8 s", from ms. */
const seconds = (ms: number) => `${ms / 1000} s`;

/** The result: rounds survived and the time bank left, as the engine counts them. */
function result(params: TimeBankParams, inputs: TimeBankInputs) {
  const { survived, left } = play(params, inputs);
  const heading = survived === params.rounds.length ? "Every round survived" : `${ui.scoreLabel(survived)} survived`;
  const detail = `${seconds(left)} of your ${seconds(params.budgetMs)} time bank left. Score: ${timeBank.score(params, inputs)}.`;
  return { heading, detail };
}

export function InnerClockPractice() {
  // The targets are random, so the server cannot know the ones the browser picked: show the first
  // (and allow the start) only once the page runs in the browser.
  const isClient = useIsClient();
  return (
    <PracticeShell<TimeBankParams, TimeBankInputs>
      howTo={ui.howTo}
      newRun={newRun}
      preview={(params) => (isClient ? `First target: ${targetLabel(params.rounds[0].targetMs)}` : null)}
      startDisabled={!isClient}
      game={(params, onFinish) => <TimeBankGame params={params} onFinish={onFinish} />}
      result={result}
    />
  );
}
