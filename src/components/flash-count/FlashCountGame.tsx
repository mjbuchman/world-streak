"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  flashCount,
  layoutFor,
  play,
  REVEAL_MS,
  roundCost,
  type FlashCountInputs,
  type FlashCountParams,
} from "@/challenges/flash-count/engine";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { BankGauge } from "@/components/rounds/BankGauge";
import { RoundCountdown } from "@/components/rounds/RoundCountdown";
import { RoundProgress } from "@/components/rounds/RoundProgress";
import { progressAt, useRevealRounds } from "@/components/rounds/useRevealRounds";
import { FlashCountShowing } from "./FlashCountShowing";
import styles from "./FlashCountGame.module.css";

type Answer = FlashCountInputs["answers"][number];

/** "1 dot", "3 dots": the bank's reading. */
export const dots = (n: number) => `${n} ${n === 1 ? "dot" : "dots"}`;

type FlashCountGameProps = {
  params: FlashCountParams;
  onFinish: (inputs: FlashCountInputs) => void;
  /** How long the 3-2-1 before every round lasts; 0 skips it (tests of the run alone). */
  countdownMs?: number;
};

/**
 * A Swift Sum run (T185): each round a 3-2-1, then the flash and its answer, then "Right on" or
 * "Off by N" for REVEAL_MS while the dot bank drains by the miss. Answers are timed from the start.
 */
export function FlashCountGame({ params, onFinish, countdownMs = RUN_COUNTDOWN_MS }: FlashCountGameProps) {
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current = performance.now();
  }, []);
  const { entries: answers, inputs, phase, record, startRound } = useRevealRounds<Answer, FlashCountInputs>({
    toInputs: (entries) => ({ answers: entries }),
    isFinished: (run) => flashCount.finished(params, run),
    revealMs: REVEAL_MS,
    onFinish,
  });
  const index = answers.length;
  const costs = answers.map(({ count }, i) => roundCost(params.levels[i].dotCount, count));

  // Memoised: the flash restarts whenever its params change, so they must only change per round.
  const showing = useMemo(
    () => (index < params.levels.length ? { ...params.levels[index], dots: layoutFor(params, index) } : null),
    [params, index],
  );

  const answer = ({ count }: { count: number }) => record({ count, atMs: performance.now() - (startedAt.current ?? 0) });

  const lastCost = costs.at(-1);
  return (
    <div className={styles.run}>
      <RoundProgress {...progressAt(index, params.levels.length, play(params, inputs))} />
      <BankGauge total={params.bank} spent={costs} format={dots} label="Dot bank" />
      {phase === "countdown" ? (
        <div className={styles.waiting}>
          <RoundCountdown key={index} round={index} ms={countdownMs} onDone={startRound} />
        </div>
      ) : phase === "round" && showing ? (
        <FlashCountShowing key={index} params={showing} countdownMs={0} onFinish={answer} />
      ) : (
        <p className={styles.reveal} role="status">
          {lastCost === 0 ? "Right on" : `Off by ${lastCost}`}
        </p>
      )}
    </div>
  );
}
