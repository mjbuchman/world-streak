"use client";

import { useEffect, useRef, useState } from "react";
import { paramsFromSeed, type StackingParams } from "@/challenges/stacking/engine";
import { reachedRow } from "@/components/stacking/rows";
import { type FinishedRun, StackingGame } from "@/components/stacking/StackingGame";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { ResultHero } from "@/components/ui/ResultHero";
import { Surface } from "@/components/ui/Surface";
import { STACKING_HOW_TO } from "@/config/challenges";
import styles from "./practice.module.css";

type Phase = { name: "ready" } | { name: "playing"; params: StackingParams } | { name: "done"; score: number };

/** Practice never counts, so a fresh seed from the browser is fine (scored seeds come from the server). */
function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

export function StackingPractice() {
  const [phase, setPhase] = useState<Phase>({ name: "ready" });
  // The best row reached on this visit; shown in the HUD of later runs.
  const [best, setBest] = useState(0);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const play = () => setPhase({ name: "playing", params: paramsFromSeed(randomSeed()) });
  const finish = ({ result }: FinishedRun) => {
    setBest((previous) => Math.max(previous, result.score));
    setPhase({ name: "done", score: result.score });
  };

  // The game (which had focus) is gone, so move focus to the result: screen readers announce it,
  // and a Space still held from the last drop lands on the heading rather than on "Play again".
  useEffect(() => {
    if (phase.name === "done") resultRef.current?.focus();
  }, [phase.name]);

  if (phase.name === "playing") return <StackingGame params={phase.params} best={best} onFinish={finish} />;

  if (phase.name === "done") {
    return (
      <ResultHero
        score={phase.score}
        heading={reachedRow(phase.score)}
        headingRef={resultRef}
        tone="practice"
        actions={
          <>
            <Button onClick={play}>Play again</Button>
            <LinkButton href="/" variant="secondary">
              Back to home
            </LinkButton>
          </>
        }
      >
        <p className={styles.note}>Practice never counts. Play as often as you like.</p>
      </ResultHero>
    );
  }

  return (
    <Surface>
      <p>{`${STACKING_HOW_TO} Practice never counts.`}</p>
      <Button onClick={play}>Start</Button>
    </Surface>
  );
}
