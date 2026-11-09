"use client";

import { useEffect, useRef, useState } from "react";
import { paramsFromSeed, type StackingParams } from "@/challenges/stacking/engine";
import { blocks } from "@/components/stacking/blocks";
import { type FinishedRun, StackingGame } from "@/components/stacking/StackingGame";
import styles from "./practice.module.css";

type Phase = { name: "ready" } | { name: "playing"; params: StackingParams } | { name: "done"; score: number };

/** Practice never counts, so a fresh seed from the browser is fine (scored seeds come from the server). */
function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

export function StackingPractice() {
  const [phase, setPhase] = useState<Phase>({ name: "ready" });
  const resultRef = useRef<HTMLHeadingElement>(null);
  const play = () => setPhase({ name: "playing", params: paramsFromSeed(randomSeed()) });
  const finish = ({ result }: FinishedRun) => setPhase({ name: "done", score: result.score });

  // The game (which had focus) is gone, so move focus to the result: screen readers announce it,
  // and a Space still held from the last drop lands on the heading rather than on "Play again".
  useEffect(() => {
    if (phase.name === "done") resultRef.current?.focus();
  }, [phase.name]);

  if (phase.name === "playing") return <StackingGame params={phase.params} onFinish={finish} />;

  return (
    <section className={styles.panel}>
      {phase.name === "done" ? (
        <h2 ref={resultRef} tabIndex={-1} className={styles.result}>
          You stacked {blocks(phase.score)}
        </h2>
      ) : (
        <p className={styles.howTo}>
          A block slides across the top of the tower. Tap, click or press Space to drop it. Any part that
          hangs over the edge is cut off, so the tower gets narrower. Practice never counts.
        </p>
      )}
      <button type="button" className={styles.button} onClick={play}>
        {phase.name === "done" ? "Play again" : "Start"}
      </button>
    </section>
  );
}
