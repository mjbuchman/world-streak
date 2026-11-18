"use client";

import { echoPath, LIVES, paramsFromSeed, play, type EchoPathInputs, type EchoPathParams } from "@/challenges/echo-path/engine";
import { challengeUi } from "@/components/challenges/challengeUi";
import { EchoPathGame } from "@/components/echo-path/EchoPathGame";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { secureRandomSeed } from "@/lib/random";

const ui = challengeUi("echo-path");
const newRun = () => paramsFromSeed(secureRandomSeed());

/** The result: the longest path repeated (and whether it reached the top) and the lives left, as the engine counts them. */
function result(params: EchoPathParams, inputs: EchoPathInputs) {
  const { longest, lives } = play(params, inputs);
  const total = params.path.length;
  const heading = longest === total ? `You reached the top: ${total} tiles` : longest === 0 ? "No path repeated" : `Longest path: ${longest} of ${total} tiles`;
  return { heading, detail: `${lives} of ${LIVES} lives left. Score: ${echoPath.score(params, inputs)}.` };
}

export function EchoPathPractice() {
  return (
    <PracticeShell<EchoPathParams, EchoPathInputs>
      howTo={ui.howTo}
      newRun={newRun}
      game={(params, onFinish) => <EchoPathGame params={params} onFinish={onFinish} />}
      result={result}
    />
  );
}
