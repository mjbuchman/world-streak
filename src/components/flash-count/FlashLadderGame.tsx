"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  flashLadder,
  layoutFor,
  play,
  REVEAL_MS,
  roundCost,
  type FlashLadderInputs,
  type FlashLadderParams,
} from "@/challenges/flash-count/flashLadder";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { BankGauge } from "@/components/rounds/BankGauge";
import { RoundCountdown } from "@/components/rounds/RoundCountdown";
import { RoundProgress } from "@/components/rounds/RoundProgress";
import { FlashCountGame } from "./FlashCountGame";
import styles from "./FlashLadderGame.module.css";

type Answer = FlashLadderInputs["answers"][number];
type Phase = "countdown" | "round" | "reveal";

/** "1 dot", "3 dots": the bank's reading. */
export const dots = (n: number) => `${n} ${n === 1 ? "dot" : "dots"}`;

type FlashLadderGameProps = {
  params: FlashLadderParams;
  onFinish: (inputs: FlashLadderInputs) => void;
  /** How long the 3-2-1 before every round lasts; 0 skips it (tests of the run alone). */
  countdownMs?: number;
};

/**
 * A Swift Sum run (T185): each round a 3-2-1, then the flash and its answer, then "Right on" or
 * "Off by N" for REVEAL_MS while the dot bank drains by the miss. Answers are timed from the start.
 */
export function FlashLadderGame({ params, onFinish, countdownMs = RUN_COUNTDOWN_MS }: FlashLadderGameProps) {
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current = performance.now();
  }, []);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [phase, setPhase] = useState<Phase>("countdown");
  const finished = flashLadder.finished(params, { answers });
  const { survived, failed } = play(params, { answers });
  const index = answers.length;
  const costs = answers.map(({ count }, i) => roundCost(params.levels[i].dotCount, count));

  // Memoised: the flash restarts whenever its params change, so they must only change per round.
  const showing = useMemo(
    () => (index < params.levels.length ? { ...params.levels[index], dots: layoutFor(params, index) } : null),
    [params, index],
  );

  // The latest callback and answers, so the reveal's timer is not restarted by a re-render.
  const finishRef = useRef(onFinish);
  const answersRef = useRef(answers);
  useEffect(() => {
    finishRef.current = onFinish;
    answersRef.current = answers;
  });

  // Every miss, the last one too, shows for REVEAL_MS. Ending the run only after it means a
  // phone's click, which follows the tap, lands on the reveal rather than the result ("Play again").
  useEffect(() => {
    if (phase !== "reveal") return;
    const timer = setTimeout(() => (finished ? finishRef.current({ answers: answersRef.current }) : setPhase("countdown")), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [phase, finished]);

  const answer = ({ count }: { count: number }) => {
    const atMs = performance.now() - (startedAt.current ?? 0);
    setAnswers((previous) => [...previous, { count, atMs }]);
    setPhase("reveal");
  };

  const total = params.levels.length;
  const lastCost = costs.at(-1);
  return (
    <div className={styles.ladder}>
      {/* A failed run stays on the round that failed; later rounds were never played. */}
      <RoundProgress total={total} current={failed ? survived : Math.min(index, total - 1)} failedRound={failed ? survived : undefined} />
      <BankGauge total={params.bank} spent={costs} format={dots} label="Dot bank" />
      {phase === "countdown" ? (
        <div className={styles.waiting}>
          <RoundCountdown key={index} round={index} ms={countdownMs} onDone={() => setPhase("round")} />
        </div>
      ) : phase === "round" && showing ? (
        <FlashCountGame key={index} params={showing} countdownMs={0} onFinish={answer} />
      ) : (
        <p className={styles.reveal} role="status">
          {lastCost === 0 ? "Right on" : `Off by ${lastCost}`}
        </p>
      )}
    </div>
  );
}
