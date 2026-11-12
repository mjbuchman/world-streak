"use client";

import { type InnerClockInputs, type InnerClockParams, paramsFromSeed, tapScore } from "@/challenges/inner-clock/engine";
import { challengeUi } from "@/components/challenges/challengeUi";
import { InnerClockGame, targetLabel } from "@/components/inner-clock/InnerClockGame";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { useIsClient } from "@/components/useIsClient";
import { secureRandomSeed } from "@/lib/random";

const ui = challengeUi("inner-clock");
const newRun = () => paramsFromSeed(secureRandomSeed());

/** Seconds for people: "5.32 s", from ms (rounded to the ms). */
const seconds = (ms: number) => ui.scoreLabel(Math.round(ms) / 1000);

// The game never reports a tap after the timeout; the checks below follow the engine's rule anyway.
const timedOut = (params: InnerClockParams, tapMs: number | null): tapMs is null => tapMs === null || tapMs > params.timeoutMs;

/** The result's heading: how far off, and which way (as the engine rounds it). */
function verdict(params: InnerClockParams, tapMs: number | null): string {
  if (timedOut(params, tapMs)) return "Time ran out";
  const error = tapScore(params, tapMs);
  if (error === 0) return "Spot on";
  return `${ui.scoreLabel(error)} ${tapMs > params.targetMs ? "late" : "early"}`;
}

function detail(params: InnerClockParams, tapMs: number | null): string {
  if (timedOut(params, tapMs)) {
    return `No tap within ${seconds(params.timeoutMs)}, so it counts as ${ui.scoreLabel(tapScore(params, null))} off.`;
  }
  return `You tapped at ${seconds(tapMs)}. The target was ${seconds(params.targetMs)}.`;
}

export function InnerClockPractice() {
  // The target is random, so the server cannot know the one the browser picked: show it (and
  // allow the start) only once the page runs in the browser.
  const isClient = useIsClient();
  return (
    <PracticeShell<InnerClockParams, InnerClockInputs>
      howTo={ui.howTo}
      newRun={newRun}
      preview={(params) => (isClient ? `Your target: ${targetLabel(params.targetMs)}` : null)}
      startDisabled={!isClient}
      game={(params, onFinish) => <InnerClockGame params={params} onFinish={onFinish} />}
      result={(params, { tapMs }) => ({ heading: verdict(params, tapMs), detail: detail(params, tapMs) })}
    />
  );
}
