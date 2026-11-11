"use client";

import { useEffect, useRef, useState } from "react";
import { countScore, type FlashCountInputs, type FlashCountParams, paramsFromSeed } from "@/challenges/flash-count/engine";
import { FlashCountGame } from "@/components/flash-count/FlashCountGame";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { ResultHero } from "@/components/ui/ResultHero";
import { Surface } from "@/components/ui/Surface";
import { FLASH_COUNT_HOW_TO } from "@/config/challenges";
import { secureRandomSeed } from "@/lib/random";
import styles from "./practice.module.css";

type Phase = { name: "ready" } | { name: "playing"; params: FlashCountParams } | { name: "done"; params: FlashCountParams; count: number };

export function FlashCountPractice() {
  const [phase, setPhase] = useState<Phase>({ name: "ready" });
  const resultRef = useRef<HTMLHeadingElement>(null);
  // Practice never counts, so a seed from the browser is fine (scored seeds come from the server).
  const play = () => setPhase({ name: "playing", params: paramsFromSeed(secureRandomSeed()) });
  const finish = ({ count }: FlashCountInputs) =>
    setPhase((current) => (current.name === "playing" ? { name: "done", params: current.params, count } : current));

  // The answer field is gone: move focus to the result, so it is announced.
  useEffect(() => {
    if (phase.name === "done") resultRef.current?.focus();
  }, [phase.name]);

  if (phase.name === "playing") return <FlashCountGame params={phase.params} onFinish={finish} />;

  if (phase.name === "done") {
    const error = countScore(phase.params, phase.count);
    return (
      <ResultHero
        heading={error === 0 ? "Exactly right" : `${error}% off`}
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
        <p>{`You said ${phase.count}. There were ${phase.params.dotCount} dots.`}</p>
        <p className={styles.note}>Practice never counts. Play as often as you like.</p>
      </ResultHero>
    );
  }

  return (
    <Surface>
      <p>{`${FLASH_COUNT_HOW_TO} Practice never counts.`}</p>
      <Button onClick={play}>Start</Button>
    </Surface>
  );
}
