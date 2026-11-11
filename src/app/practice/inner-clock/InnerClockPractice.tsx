"use client";

import { useEffect, useRef, useState } from "react";
import { type InnerClockInputs, type InnerClockParams, paramsFromSeed, tapScore } from "@/challenges/inner-clock/engine";
import { InnerClockGame, targetLabel } from "@/components/inner-clock/InnerClockGame";
import { useIsClient } from "@/components/useIsClient";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { ResultHero } from "@/components/ui/ResultHero";
import { Surface } from "@/components/ui/Surface";
import { INNER_CLOCK_HOW_TO } from "@/config/challenges";
import { secureRandomSeed } from "@/lib/random";
import styles from "./practice.module.css";

type Phase =
  | { name: "ready"; params: InnerClockParams }
  | { name: "playing"; params: InnerClockParams }
  | { name: "done"; params: InnerClockParams; tapMs: number | null };

/** Seconds for people: "5.32 s", from ms (rounded to the ms). */
const seconds = (ms: number) => `${Math.round(ms) / 1000} s`;

// The game never reports a tap after the timeout; the checks below follow the engine's rule anyway.

/** The result's heading: how far off, and which way (as the engine rounds it). */
function verdict(params: InnerClockParams, tapMs: number | null): string {
  if (tapMs === null || tapMs > params.timeoutMs) return "Time ran out";
  const error = tapScore(params, tapMs);
  if (error === 0) return "Spot on";
  return `${error} s ${tapMs > params.targetMs ? "late" : "early"}`;
}

function detail(params: InnerClockParams, tapMs: number | null): string {
  if (tapMs === null || tapMs > params.timeoutMs) {
    return `No tap within ${seconds(params.timeoutMs)}, so it counts as ${tapScore(params, null)} s off.`;
  }
  return `You tapped at ${seconds(tapMs)}. The target was ${seconds(params.targetMs)}.`;
}

// Practice never counts, so a seed from the browser is fine (scored seeds come from the server).
const newRun = () => paramsFromSeed(secureRandomSeed());

export function InnerClockPractice() {
  const [phase, setPhase] = useState<Phase>(() => ({ name: "ready", params: newRun() }));
  // The target is random, so the server cannot know the one the browser picked: show it (and
  // allow the start) only once the page runs in the browser.
  const isClient = useIsClient();
  const resultRef = useRef<HTMLHeadingElement>(null);
  const finish = ({ tapMs }: InnerClockInputs) =>
    setPhase((current) => (current.name === "playing" ? { name: "done", params: current.params, tapMs } : current));

  // The tap area (which had focus) is gone: move focus to the result, so it is announced and a
  // Space still held from the tap lands on the heading rather than on "Play again".
  useEffect(() => {
    if (phase.name === "done") resultRef.current?.focus();
  }, [phase.name]);

  if (phase.name === "playing") return <InnerClockGame params={phase.params} onFinish={finish} />;

  if (phase.name === "done") {
    return (
      <ResultHero
        heading={verdict(phase.params, phase.tapMs)}
        headingRef={resultRef}
        tone="practice"
        actions={
          <>
            <Button onClick={() => setPhase({ name: "playing", params: newRun() })}>Play again</Button>
            <LinkButton href="/" variant="secondary">
              Back to home
            </LinkButton>
          </>
        }
      >
        <p>{detail(phase.params, phase.tapMs)}</p>
        <p className={styles.note}>Practice never counts. Play as often as you like.</p>
      </ResultHero>
    );
  }

  return (
    <Surface>
      <p>{`${INNER_CLOCK_HOW_TO} Practice never counts.`}</p>
      <p className={styles.target}>{isClient ? `Your target: ${targetLabel(phase.params.targetMs)}` : " "}</p>
      <Button disabled={!isClient} onClick={() => setPhase({ name: "playing", params: phase.params })}>
        Start
      </Button>
    </Surface>
  );
}
